FROM postgres:16

# The database name and role are fixed; the password always comes from the
# environment (compose sets it from POSTGRES_PASSWORD in .env), so no
# credential is baked into the image.
ENV POSTGRES_DB=playup \
    POSTGRES_USER=playup

# No schema here on purpose: Alembic owns every table, enum, index and
# constraint (backend/migrations). The backend runs `alembic upgrade head`
# on start, so this image only has to provide an empty database.
#
# Development seed data lives in seed.sql and is applied after the
# migrations - see the README.
