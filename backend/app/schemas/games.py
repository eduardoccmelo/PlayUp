from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.domain.enums import (
    CancelReason,
    CurrencyCode,
    GameStatus,
    ParticipantStatus,
    TeamSide,
)
from app.schemas.common import CamelModel


class CreateGameRequest(CamelModel):
    game_date: date
    start_time: time
    duration_minutes: int = Field(gt=0)
    max_players: int = Field(ge=2)
    min_players: int | None = Field(default=None, ge=2)
    location: str = ""
    court_number: str = ""
    court_cost_cents: int = Field(default=0, ge=0)
    currency: CurrencyCode = CurrencyCode.EUR
    auto_cancellation_hours: int | None = Field(default=None, gt=0)
    payment_info: str = ""
    player_notice: str = ""


class UpdateGameRequest(CamelModel):
    game_date: date | None = None
    start_time: time | None = None
    duration_minutes: int | None = Field(default=None, gt=0)
    max_players: int | None = Field(default=None, ge=2)
    min_players: int | None = Field(default=None, ge=2)
    location: str | None = None
    court_number: str | None = None
    court_cost_cents: int | None = Field(default=None, ge=0)
    payment_info: str | None = None
    player_notice: str | None = None


class ParticipantResponse(CamelModel):
    id: UUID
    player_id: UUID
    display_name: str
    status: ParticipantStatus
    list_position: int | None
    paid: bool
    team: TeamSide | None


class GameResponse(CamelModel):
    id: UUID
    group_id: UUID
    public_slug: str
    game_date: date
    start_time: time
    end_time: time | None
    duration_minutes: int
    starts_at: datetime
    ends_at: datetime
    location: str
    court_number: str
    court_cost_cents: int
    currency: CurrencyCode
    max_players: int
    min_players: int | None
    status: GameStatus
    cancel_reason: CancelReason | None
    payment_info: str
    player_notice: str
    teams_drawn_at: datetime | None
    team_a_score: Decimal | None
    team_b_score: Decimal | None


class ViewerAccessResponse(CamelModel):
    """§6.3 - every capability the viewer has, decided by the backend."""

    kind: str
    status: str | None
    can_view_details: bool
    can_view_group_players: bool
    can_join: bool
    can_leave: bool
    can_update_own_payment: bool
    can_draw_teams: bool
    can_manage_game: bool


class GameDetailResponse(CamelModel):
    game: GameResponse
    viewer_access: ViewerAccessResponse
    confirmed: list[ParticipantResponse]
    waiting_list: list[ParticipantResponse]


class CreateGameResponse(CamelModel):
    game: GameResponse
    join_code: str


class JoinGameRequest(CamelModel):
    player_id: UUID | None = None
    display_name: str | None = None


class PaymentRequest(CamelModel):
    paid: bool


class ReorderRequest(CamelModel):
    status: ParticipantStatus
    ordered_ids: list[UUID]


class CancelGameRequest(CamelModel):
    reason: CancelReason = CancelReason.MANUAL
