# PlayUp database

PostgreSQL 16.

## Who owns the schema

Alembic, in `backend/migrations`. This directory does **not** create tables:
an `init.sql` running at container start would race the migrations and give
two sources of truth. `db/Dockerfile` only provisions an empty database.

To change the schema, add a revision:

```bash
cd backend
alembic revision -m "what changed"      # or --autogenerate
alembic upgrade head
```

## Seed data

`seed.sql` mirrors `src/dev/seeds.ts` for local development. It must run
*after* the migrations, because it inserts into tables Alembic creates:

```bash
docker compose up -d db backend          # backend migrates on start
docker compose exec -T db psql -U playup -d playup -f /seeds/seed.sql
```

The file is idempotent (`ON CONFLICT DO NOTHING`), so re-running it is safe.
