# Deploying PlayUp on an AWS EC2 instance

One instance, Docker Compose, three containers: PostgreSQL, the FastAPI
backend, and nginx serving the built frontend and proxying `/api/*` to the
backend. Nothing but nginx is reachable from outside the Docker network.

```text
internet ──:80──> frontend (nginx) ──/api/*──> backend:8000 ──> db:5432
```

## 1. Instance

- Ubuntu 24.04 LTS, `t3.small` or larger (the Node build step needs ~1 GB free RAM; on a `t3.micro` add 1 GB of swap first).
- Security group inbound: **80** (and **443** once TLS is added) from anywhere, **22** from your IP only. Do not open 5432 or 8000.
- Install Docker Engine + Compose plugin from Docker's repository (the Ubuntu `docker.io` package ships an old Compose):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER" && newgrp docker
docker compose version   # needs >= 2.20
```

## 2. First deploy

```bash
git clone https://github.com/eduardoccmelo/PlayUp.git
cd PlayUp
cp .env.example .env
# set POSTGRES_PASSWORD (openssl rand -base64 32); keep PLAYUP_ENVIRONMENT=production
nano .env

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose ps           # all three "healthy"
curl -s http://localhost/api/health   # {"status":"ok"}
```

The backend runs `alembic upgrade head` on every start, so the schema is
created on the first boot and upgraded on later ones. The database lives in
the `playup-db` named volume and survives `down`/`up`.

**Do not load `db/seed.sql` in production.** It creates demo users and groups
with placeholder credentials.

## 3. Updating

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker image prune -f
```

Compose only recreates containers whose image or config changed. The
backend re-runs migrations on start.

## 4. Operating

| Task | Command |
|---|---|
| Logs | `docker compose logs -f backend` |
| Backup | `docker compose exec -T db pg_dump -U playup -Fc playup > playup-$(date +%F).dump` |
| Restore | `docker compose exec -T db pg_restore -U playup -d playup --clean < playup.dump` |
| psql | `docker compose exec db psql -U playup -d playup` |
| Stop | `docker compose -f docker-compose.yml -f docker-compose.prod.yml down` |

Container logs rotate at 10 MB x 3 files (set in `docker-compose.prod.yml`).
Put the backup command in cron and copy the dump off the instance (S3 via
`aws s3 cp`); a named volume on one EBS disk is not a backup.

## 5. Things to know before real users

- **Sign-in has no mailer yet.** In production the access code is *not*
  returned by the API; it is written to the backend log
  (`docker compose logs backend | grep "Access code"`). Until a mailer exists,
  only someone with server access can complete a sign-in. Do **not** work
  around this with `PLAYUP_ENVIRONMENT=development` on a public host: that
  returns the code to whoever asks, so anyone could sign in as any email.
- **No TLS.** Put Caddy or an Application Load Balancer with an ACM
  certificate in front of port 80, then set `WEB_PORT=8080` (or bind to
  `127.0.0.1:8080`) so nginx is only reachable through the proxy.
- **No rate limiting** on `/v1/auth/*` or `/v1/groups/join` yet
  (`docs/backend-plan-python.md` §9). Add it in nginx (`limit_req`) or the
  app before the instance is public.
- **The frontend does not call the API yet.** `src/services/apiClient.ts`
  exists but nothing imports it; the UI still runs on `localStorage`. The
  deployed site is therefore the browser-only prototype plus a working API
  at `/api/v1/*` for the cut-over.
- **Single instance only.** Migrations run inside the backend container's
  start command; with more than one backend replica, run them once
  separately and drop them from the `CMD`.
