# PlayUp backend

Python 3.12+, FastAPI, async SQLAlchemy 2, PostgreSQL 16, Alembic.

## Running the whole stack

From the repository root:

```bash
docker compose up -d db backend
# development seed data, applied after the migrations
docker compose exec -T db psql -U playup -d playup -f /seeds/seed.sql
```

The API is on `http://localhost:8000`, health check at `GET /health`,
OpenAPI at `/docs`. Vite proxies `/api/*` to it, so the frontend calls
`/api/v1/...`.

## Running the backend directly

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e '.[dev]'
export PLAYUP_DATABASE_URL=postgresql+psycopg://playup:playup@localhost:5432/playup
alembic upgrade head
uvicorn app.main:app --reload
```

## Tests

The schema relies on partial indexes, generated columns and a deferrable
unique constraint, none of which SQLite can emulate, so the database tests
need a real PostgreSQL:

```bash
export PLAYUP_TEST_DATABASE_URL=postgresql+psycopg://playup:playup@localhost:5432/playup
pytest                     # testcontainers starts one if the variable is unset
ruff check . && mypy app
```

Tests that need a database are marked `db` and skip when none is reachable.
The pure rule tests (`test_ordering`, `test_teams`, `test_time`) always run.

## Layout

```text
app/
  core/      config, argon2/sha256 secrets, wall-clock <-> instant conversion
  db/        DeclarativeBase, async session factory, models/ (one per §4 area)
  domain/    transactions and invariants - the only place business rules live
  api/       deps.py decides authorization; v1/ routers do HTTP only
  schemas/   Pydantic request/response models, camelCase on the wire
```

Routers do HTTP and authorization; `domain/` owns transactions and
invariants; models carry no business logic. Authorization is derived in
`api/deps.py` from `group_memberships` and `game_access_requests` — never
from a path id.

## Schema ownership

Alembic owns every table, enum, index and constraint. `db/` only provisions
an empty database, so there is one source of truth. `migrations/versions/0001_core_schema.py`
holds the full DDL; `app/db/models/` mirrors it, and the two are verified to
agree (Alembic's own autogenerate comparison reports no drift).

## What is implemented

- Schema: all 11 tables, 14 enums, the `game_summary` view, partial indexes,
  generated normalized-name columns, and the deferrable list-order constraint.
- Auth: access codes (Argon2id), opaque sessions (SHA-256), sign-out.
- Groups: create (creator becomes admin with a linked profile), join by code,
  admin join via passcode, passcode change, leave.
- Games: create, list, read with calculated viewer permissions, update
  (recomputing `starts_at`/`ends_at`), cancel with a recorded reason.
- Participants: join, leave, remove, payment, manual reorder, capacity
  change — each one locks the game row, re-settles both lists, renumbers and
  notifies admins.
- Ordering rules 13 and 14, and the team balancer (rules 15, 16) ported from
  the frontend.

## Not yet implemented

Tracked in `docs/backend-plan-python.md`:

- Guest access requests and the approve/reject/approve-all endpoints.
- Invites (`/v1/invites/...`) and `POST /v1/games/lookup`.
- Team draw endpoints (the balancer itself is done and tested).
- Notification read/dismiss endpoints (rows are written already).
- The `min_players` auto-cancellation sweep (rule 17).
- A real `Mailer`; access codes currently come back in the response outside
  production.
