FROM postgres:16

ENV POSTGRES_DB=playup \
    POSTGRES_USER=playup \
    POSTGRES_PASSWORD=playup

# No schema here on purpose: Alembic owns every table, enum, index and
# constraint (backend/migrations). The backend runs `alembic upgrade head`
# on start, so this image only has to provide an empty database.
#
# Development seed data lives in seed.sql and is applied after the
# migrations - see the README.
