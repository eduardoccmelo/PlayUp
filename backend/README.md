# PlayUp backend

Python 3.12+, FastAPI, async SQLAlchemy 2, PostgreSQL, and Alembic.

## Local setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --reload
```

The API health check is available at `GET /health`.

## Current foundation

- Typed settings, Argon2 secret hashing, and SHA-256 token hashing.
- PostgreSQL-oriented models for users, memberships, player profiles, games,
  participants, and access requests.
- Wall-clock game time conversion using the group's IANA timezone.
- Pure ordering and team-draw precondition rules with tests.
- Alembic bootstrap revision for the current model foundation.

The next implementation slices are the transactional participant service,
authentication/session routes, access permissions, invites/notifications, and
the full production migration constraints listed in `docs/backend-plan-python.md`.