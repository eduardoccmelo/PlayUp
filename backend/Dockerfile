FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY pyproject.toml README.md ./
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
RUN pip install --no-cache-dir . \
 && adduser --system --group --no-create-home app \
 && chown -R app:app /app
USER app

EXPOSE 8000
# Migrations run before the server starts, so a fresh database and an
# upgraded image both come up consistent. Single instance only: with
# several replicas, run `alembic upgrade head` once, separately.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
