"""End-to-end HTTP tests: sign in, create a group and game, fill it up."""

from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.db


@pytest.fixture
async def client(clean_database: str) -> AsyncIterator[AsyncClient]:
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http


async def sign_in(client: AsyncClient, email: str, name: str) -> str:
    start = await client.post(
        "/v1/auth/start", json={"email": email, "displayName": name}
    )
    assert start.status_code == 200, start.text
    code = start.json()["accessCode"]
    assert code, "development must return the access code"

    verify = await client.post(
        "/v1/auth/verify", json={"email": email, "accessCode": code}
    )
    assert verify.status_code == 200, verify.text
    return verify.json()["token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_health(client: AsyncClient) -> None:
    assert (await client.get("/health")).json() == {"status": "ok"}


async def test_an_unauthenticated_request_is_rejected(client: AsyncClient) -> None:
    assert (await client.get("/v1/groups")).status_code == 401


async def test_a_wrong_access_code_is_rejected(client: AsyncClient) -> None:
    await client.post("/v1/auth/start", json={"email": "a@example.com"})
    response = await client.post(
        "/v1/auth/verify", json={"email": "a@example.com", "accessCode": "WRONGWRO"}
    )
    assert response.status_code == 401


async def test_creating_a_group_makes_the_creator_an_admin(client: AsyncClient) -> None:
    """Rule 1."""
    token = await sign_in(client, "organizer@example.com", "Organizer")
    created = await client.post(
        "/v1/groups",
        json={"name": "City Night", "organizerPasscode": "hunter2"},
        headers=auth(token),
    )
    assert created.status_code == 201, created.text
    assert created.json()["joinCode"]

    groups = await client.get("/v1/groups", headers=auth(token))
    assert [group["role"] for group in groups.json()] == ["admin"]


async def test_a_participant_cannot_create_a_game(client: AsyncClient) -> None:
    """Rule 2."""
    admin_token = await sign_in(client, "organizer@example.com", "Organizer")
    created = await client.post(
        "/v1/groups",
        json={"name": "City Night", "organizerPasscode": "hunter2"},
        headers=auth(admin_token),
    )
    group_id = created.json()["group"]["id"]
    join_code = created.json()["joinCode"]

    member_token = await sign_in(client, "member@example.com", "Member")
    joined = await client.post(
        "/v1/groups/join",
        json={"joinCode": join_code, "displayName": "Member"},
        headers=auth(member_token),
    )
    assert joined.status_code == 200, joined.text

    response = await client.post(
        f"/v1/groups/{group_id}/games",
        json={
            "gameDate": "2026-06-01",
            "startTime": "19:00:00",
            "durationMinutes": 75,
            "maxPlayers": 4,
        },
        headers=auth(member_token),
    )
    assert response.status_code == 403


async def test_joining_as_admin_requires_the_passcode(client: AsyncClient) -> None:
    admin_token = await sign_in(client, "organizer@example.com", "Organizer")
    created = await client.post(
        "/v1/groups",
        json={"name": "City Night", "organizerPasscode": "hunter2"},
        headers=auth(admin_token),
    )
    join_code = created.json()["joinCode"]
    other = await sign_in(client, "other@example.com", "Other")

    refused = await client.post(
        "/v1/groups/join",
        json={
            "joinCode": join_code,
            "displayName": "Other",
            "role": "admin",
            "organizerPasscode": "wrong",
        },
        headers=auth(other),
    )
    assert refused.status_code == 403

    accepted = await client.post(
        "/v1/groups/join",
        json={
            "joinCode": join_code,
            "displayName": "Other",
            "role": "admin",
            "organizerPasscode": "hunter2",
        },
        headers=auth(other),
    )
    assert accepted.status_code == 200
    assert accepted.json()["role"] == "admin"


async def test_a_game_reports_the_viewers_calculated_permissions(
    client: AsyncClient,
) -> None:
    """§6.3 - the frontend is told what it may do, it never infers it."""
    token = await sign_in(client, "organizer@example.com", "Organizer")
    created = await client.post(
        "/v1/groups",
        json={"name": "City Night", "organizerPasscode": "hunter2"},
        headers=auth(token),
    )
    group_id = created.json()["group"]["id"]

    game = await client.post(
        f"/v1/groups/{group_id}/games",
        json={
            "gameDate": "2026-06-01",
            "startTime": "19:00:00",
            "durationMinutes": 75,
            "maxPlayers": 2,
            "location": "Riverside Arena",
        },
        headers=auth(token),
    )
    assert game.status_code == 201, game.text
    game_id = game.json()["game"]["id"]

    detail = await client.get(f"/v1/games/{game_id}", headers=auth(token))
    access = detail.json()["viewerAccess"]
    assert access["kind"] == "admin"
    assert access["canManageGame"] is True
    assert access["canViewGroupPlayers"] is True


async def test_an_outsider_cannot_see_a_game(client: AsyncClient) -> None:
    token = await sign_in(client, "organizer@example.com", "Organizer")
    created = await client.post(
        "/v1/groups",
        json={"name": "City Night", "organizerPasscode": "hunter2"},
        headers=auth(token),
    )
    group_id = created.json()["group"]["id"]
    game = await client.post(
        f"/v1/groups/{group_id}/games",
        json={
            "gameDate": "2026-06-01",
            "startTime": "19:00:00",
            "durationMinutes": 75,
            "maxPlayers": 2,
        },
        headers=auth(token),
    )
    game_id = game.json()["game"]["id"]

    outsider = await sign_in(client, "outsider@example.com", "Outsider")
    response = await client.get(f"/v1/games/{game_id}", headers=auth(outsider))
    assert response.status_code == 403


async def test_a_member_joins_a_full_game_onto_the_waiting_list(
    client: AsyncClient,
) -> None:
    """Rule 4, over HTTP."""
    admin_token = await sign_in(client, "organizer@example.com", "Organizer")
    created = await client.post(
        "/v1/groups",
        json={"name": "City Night", "organizerPasscode": "hunter2"},
        headers=auth(admin_token),
    )
    group_id = created.json()["group"]["id"]
    join_code = created.json()["joinCode"]

    # The schema refuses a game smaller than two players, so fill both slots
    # and let a third member overflow.
    game = await client.post(
        f"/v1/groups/{group_id}/games",
        json={
            "gameDate": "2026-06-01",
            "startTime": "19:00:00",
            "durationMinutes": 75,
            "maxPlayers": 2,
        },
        headers=auth(admin_token),
    )
    game_id = game.json()["game"]["id"]

    first = await client.post(
        f"/v1/games/{game_id}/participants", json={}, headers=auth(admin_token)
    )
    assert first.status_code == 201, first.text

    tokens = []
    for index in (1, 2):
        token = await sign_in(client, f"member{index}@example.com", f"Member {index}")
        joined = await client.post(
            "/v1/groups/join",
            json={"joinCode": join_code, "displayName": f"Member {index}"},
            headers=auth(token),
        )
        assert joined.status_code == 200, joined.text
        tokens.append(token)

    second = await client.post(
        f"/v1/games/{game_id}/participants", json={}, headers=auth(tokens[0])
    )
    assert second.status_code == 201, second.text
    third = await client.post(
        f"/v1/games/{game_id}/participants", json={}, headers=auth(tokens[1])
    )
    assert third.status_code == 201, third.text

    assert [p["displayName"] for p in third.json()["confirmed"]] == [
        "Organizer",
        "Member 1",
    ]
    assert [p["displayName"] for p in third.json()["waitingList"]] == ["Member 2"]


async def test_a_game_smaller_than_two_players_is_rejected(client: AsyncClient) -> None:
    token = await sign_in(client, "organizer@example.com", "Organizer")
    created = await client.post(
        "/v1/groups",
        json={"name": "City Night", "organizerPasscode": "hunter2"},
        headers=auth(token),
    )
    group_id = created.json()["group"]["id"]

    response = await client.post(
        f"/v1/groups/{group_id}/games",
        json={
            "gameDate": "2026-06-01",
            "startTime": "19:00:00",
            "durationMinutes": 75,
            "maxPlayers": 1,
        },
        headers=auth(token),
    )
    assert response.status_code == 422


async def test_a_member_cannot_change_someone_elses_payment(
    client: AsyncClient,
) -> None:
    """Rule 10."""
    admin_token = await sign_in(client, "organizer@example.com", "Organizer")
    created = await client.post(
        "/v1/groups",
        json={"name": "City Night", "organizerPasscode": "hunter2"},
        headers=auth(admin_token),
    )
    group_id = created.json()["group"]["id"]
    join_code = created.json()["joinCode"]
    game = await client.post(
        f"/v1/groups/{group_id}/games",
        json={
            "gameDate": "2026-06-01",
            "startTime": "19:00:00",
            "durationMinutes": 75,
            "maxPlayers": 4,
        },
        headers=auth(admin_token),
    )
    game_id = game.json()["game"]["id"]
    admin_join = await client.post(
        f"/v1/games/{game_id}/participants", json={}, headers=auth(admin_token)
    )
    admin_participant = admin_join.json()["confirmed"][0]["id"]

    member_token = await sign_in(client, "member@example.com", "Member")
    await client.post(
        "/v1/groups/join",
        json={"joinCode": join_code, "displayName": "Member"},
        headers=auth(member_token),
    )
    await client.post(
        f"/v1/games/{game_id}/participants", json={}, headers=auth(member_token)
    )

    refused = await client.patch(
        f"/v1/games/{game_id}/participants/{admin_participant}/payment",
        json={"paid": True},
        headers=auth(member_token),
    )
    assert refused.status_code == 403


async def test_signing_out_invalidates_the_token(client: AsyncClient) -> None:
    token = await sign_in(client, "organizer@example.com", "Organizer")
    assert (await client.delete("/v1/sessions/current", headers=auth(token))).status_code == 204
    assert (await client.get("/v1/me", headers=auth(token))).status_code == 401
