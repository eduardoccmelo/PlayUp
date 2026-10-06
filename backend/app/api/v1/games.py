from uuid import UUID

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import (
    GameManagerDep,
    GameViewerDep,
    GroupAdminDep,
    GroupMemberDep,
    SessionDep,
    ViewerDep,
)
from app.db.models import Game, GameParticipant, PlayerProfile
from app.domain import games as games_domain
from app.domain import participants as participants_domain
from app.domain.enums import ParticipantStatus
from app.domain.errors import NotFound, PermissionDenied
from app.schemas.games import (
    CancelGameRequest,
    CreateGameRequest,
    CreateGameResponse,
    GameDetailResponse,
    GameResponse,
    JoinGameRequest,
    ParticipantResponse,
    PaymentRequest,
    ReorderRequest,
    UpdateGameRequest,
    ViewerAccessResponse,
)

router = APIRouter(tags=["games"])

#: Fields a PATCH may change without touching the schedule.
PLAIN_GAME_FIELDS = (
    "location", "court_number", "court_cost_cents", "min_players",
    "payment_info", "player_notice",
)
#: Changing any of these forces starts_at/ends_at to be recomputed.
SCHEDULE_FIELDS = ("game_date", "start_time", "duration_minutes")


def _participant_response(row: GameParticipant) -> ParticipantResponse:
    return ParticipantResponse(
        id=row.id,
        player_id=row.player_id,
        display_name=row.display_name_snapshot,
        status=row.status,
        list_position=row.list_position,
        paid=row.paid_at is not None,
        team=row.team,
    )


async def _lists(
    session: SessionDep, game_id: UUID
) -> tuple[list[GameParticipant], list[GameParticipant]]:
    rows = (
        (
            await session.execute(
                select(GameParticipant)
                .where(GameParticipant.game_id == game_id)
                .order_by(GameParticipant.list_position)
            )
        )
        .scalars()
        .all()
    )
    confirmed = [r for r in rows if r.status is ParticipantStatus.CONFIRMED]
    waiting = [r for r in rows if r.status is ParticipantStatus.WAITING_LIST]
    return confirmed, waiting


@router.get("/groups/{group_id}/games", response_model=list[GameResponse])
async def list_games(context: GroupMemberDep, session: SessionDep) -> list[GameResponse]:
    rows = (
        (
            await session.execute(
                select(Game)
                .where(Game.group_id == context.group.id)
                .order_by(Game.starts_at)
            )
        )
        .scalars()
        .all()
    )
    return [GameResponse.model_validate(row) for row in rows]


@router.post("/groups/{group_id}/games", response_model=CreateGameResponse, status_code=201)
async def create_game(
    body: CreateGameRequest, context: GroupAdminDep, session: SessionDep
) -> CreateGameResponse:
    created = await games_domain.create_game(
        session,
        group_id=context.group.id,
        created_by_user_id=context.viewer.user.id,
        game_date=body.game_date,
        start_time=body.start_time,
        duration_minutes=body.duration_minutes,
        max_players=body.max_players,
        min_players=body.min_players,
        location=body.location,
        court_number=body.court_number,
        court_cost_cents=body.court_cost_cents,
        currency=body.currency,
        auto_cancellation_hours=body.auto_cancellation_hours,
        payment_info=body.payment_info,
        player_notice=body.player_notice,
    )
    return CreateGameResponse(
        game=GameResponse.model_validate(created.game), join_code=created.join_code
    )


@router.get("/games/{game_id}", response_model=GameDetailResponse)
async def read_game(context: GameViewerDep, session: SessionDep) -> GameDetailResponse:
    confirmed, waiting = await _lists(session, context.game.id)
    return GameDetailResponse(
        game=GameResponse.model_validate(context.game),
        viewer_access=ViewerAccessResponse.model_validate(context.access),
        confirmed=[_participant_response(row) for row in confirmed],
        waiting_list=[_participant_response(row) for row in waiting],
    )


@router.patch("/games/{game_id}", response_model=GameResponse)
async def update_game(
    body: UpdateGameRequest, context: GameManagerDep, session: SessionDep
) -> GameResponse:
    game = context.game
    changes = body.model_dump(exclude_unset=True)

    for field in PLAIN_GAME_FIELDS:
        if field in changes:
            setattr(game, field, changes[field])

    if any(field in changes for field in SCHEDULE_FIELDS):
        for field in SCHEDULE_FIELDS:
            if field in changes:
                setattr(game, field, changes[field])
        from app.domain.groups import get_group

        games_domain.recompute_schedule(game, await get_group(session, game.group_id))

    if "max_players" in changes:
        game.max_players = changes["max_players"]
        await session.flush()
        # Rule 13: a shrink pushes the roster tail to the waiting-list front.
        await participants_domain.resettle_after_capacity_change(session, game_id=game.id)

    await session.flush()
    return GameResponse.model_validate(game)


@router.post("/games/{game_id}/cancel", response_model=GameResponse)
async def cancel_game(
    body: CancelGameRequest, context: GameManagerDep, session: SessionDep
) -> GameResponse:
    game = await games_domain.cancel_game(
        session, game_id=context.game.id, reason=body.reason
    )
    return GameResponse.model_validate(game)


@router.post("/games/{game_id}/participants", response_model=GameDetailResponse, status_code=201)
async def join_game(
    body: JoinGameRequest, context: GameViewerDep, session: SessionDep, viewer: ViewerDep
) -> GameDetailResponse:
    if not context.access.can_join and not context.access.can_manage_game:
        raise PermissionDenied("You cannot join that game")

    player_id = body.player_id
    if player_id is None:
        # A member joins through their linked profile in this group (rule 4).
        profile = (
            await session.execute(
                select(PlayerProfile).where(
                    PlayerProfile.group_id == context.game.group_id,
                    PlayerProfile.owner_user_id == viewer.user.id,
                )
            )
        ).scalar_one_or_none()
        if profile is None:
            raise NotFound("You have no player profile in that group")
        player_id = profile.id
    elif not context.access.can_manage_game:
        # Only an admin may add someone else; everyone else joins as themselves.
        profile = await session.get(PlayerProfile, player_id)
        if profile is None or profile.owner_user_id != viewer.user.id:
            raise PermissionDenied("You may only add yourself to that game")

    profile = await session.get(PlayerProfile, player_id)
    if profile is None:
        raise NotFound("Player profile not found")

    await participants_domain.join_game(
        session,
        game_id=context.game.id,
        player_id=player_id,
        user_id=viewer.user.id,
        display_name=body.display_name or profile.display_name,
    )
    confirmed, waiting = await _lists(session, context.game.id)
    return GameDetailResponse(
        game=GameResponse.model_validate(context.game),
        viewer_access=ViewerAccessResponse.model_validate(context.access),
        confirmed=[_participant_response(row) for row in confirmed],
        waiting_list=[_participant_response(row) for row in waiting],
    )


async def _owned_participant(
    session: SessionDep, game_id: UUID, participant_id: UUID
) -> GameParticipant:
    row = await session.get(GameParticipant, participant_id)
    if row is None or row.game_id != game_id:
        raise NotFound("Participant is not on this game's list")
    return row


@router.patch(
    "/games/{game_id}/participants/{participant_id}/payment",
    response_model=list[ParticipantResponse],
)
async def update_payment(
    participant_id: UUID,
    body: PaymentRequest,
    context: GameViewerDep,
    session: SessionDep,
    viewer: ViewerDep,
) -> list[ParticipantResponse]:
    row = await _owned_participant(session, context.game.id, participant_id)
    # Rule 10: a participant may change only their own payment state.
    own = row.user_id == viewer.user.id
    if not context.access.can_manage_game and not (
        own and context.access.can_update_own_payment
    ):
        raise PermissionDenied("You may only update your own payment")

    await participants_domain.set_payment(
        session,
        game_id=context.game.id,
        participant_id=participant_id,
        paid=body.paid,
        actor_user_id=viewer.user.id,
    )
    confirmed, waiting = await _lists(session, context.game.id)
    return [_participant_response(r) for r in [*confirmed, *waiting]]


@router.post(
    "/games/{game_id}/participants/{participant_id}/leave",
    response_model=list[ParticipantResponse],
)
async def leave_game(
    participant_id: UUID, context: GameViewerDep, session: SessionDep, viewer: ViewerDep
) -> list[ParticipantResponse]:
    row = await _owned_participant(session, context.game.id, participant_id)
    own = row.user_id == viewer.user.id
    if not context.access.can_manage_game and not (own and context.access.can_leave):
        raise PermissionDenied("You may only remove yourself from that game")

    await participants_domain.leave_game(
        session,
        game_id=context.game.id,
        participant_id=participant_id,
        actor_user_id=viewer.user.id,
        removed=not own,
    )
    confirmed, waiting = await _lists(session, context.game.id)
    return [_participant_response(r) for r in [*confirmed, *waiting]]


@router.delete(
    "/games/{game_id}/participants/{participant_id}",
    response_model=list[ParticipantResponse],
)
async def remove_participant(
    participant_id: UUID, context: GameManagerDep, session: SessionDep
) -> list[ParticipantResponse]:
    await _owned_participant(session, context.game.id, participant_id)
    await participants_domain.leave_game(
        session,
        game_id=context.game.id,
        participant_id=participant_id,
        actor_user_id=context.user_id,
        removed=True,
    )
    confirmed, waiting = await _lists(session, context.game.id)
    return [_participant_response(r) for r in [*confirmed, *waiting]]


@router.post(
    "/games/{game_id}/participants/reorder", response_model=list[ParticipantResponse]
)
async def reorder(
    body: ReorderRequest, context: GameManagerDep, session: SessionDep
) -> list[ParticipantResponse]:
    await participants_domain.reorder_list(
        session,
        game_id=context.game.id,
        status=body.status,
        ordered_ids=body.ordered_ids,
    )
    confirmed, waiting = await _lists(session, context.game.id)
    return [_participant_response(r) for r in [*confirmed, *waiting]]
