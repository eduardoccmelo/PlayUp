# PlayUp — backend plan (Python)

**Status:** unified plan. Supersedes `backend-schema.md` and `playup-sql-schema-plan.html`, merging every feature that existed in only one of them.
**Stack:** Python 3.12 + FastAPI + SQLAlchemy 2.0 + PostgreSQL 16.
**Sibling document:** `backend-plan-typescript.md` — identical schema, rules, API and migration; only the implementation chapters differ.
**Portuguese companion:** short summary at the end. English is the source of truth for implementation decisions.

---

## 1. Why this document exists

Two earlier documents planned the same backend from different ends:

| | `playup-sql-schema-plan.html` (1 Sep 2026) | `backend-schema.md` |
|---|---|---|
| Framing | Honest translation of `localStorage` → SQL | Product spec for the flows we want |
| Strengths | Teams, list ordering, wall-clock time, money, migration steps, engine notes | Identity, roles, guests, invites, notifications, API, permissions |
| Weakness | No users, no invites, no notifications | Silently dropped teams, list order, timezone, archival, cancel reasons |

They also **contradict each other** on eight concrete columns. This plan resolves each contradiction explicitly, keeps everything that was exclusive to either side, and adds the few pieces the current code needs that neither document had.

### Drift already in the code

`src/types.ts` has moved on since both documents were written. These already exist in the prototype and must be in the schema:

- `CurrentUser` with `email`, `emailVerified`, `adminGroupIds` — the `backend-schema.md` identity model, partially built.
- `Player.ownerUserId` — the HTML's "nullable `person_id` escape hatch", already taken.
- `ParticipationRequest.requesterUserId` and `type: "join" | "leave" | "payment"` — requests are no longer only about joining. **Neither document models this.**
- `ParticipationRequest.paymentConfirmed` — payment requests carry a proposed state.
- `GameSession.cancellationHours` — auto-cancellation is per game, not a fixed four hours.
- `GameSession.endTime` and `durationInMinutes` / `endTimeFromDuration` — end time is first-class.
- `CurrentUser.devGodMode` — prototype-only. **Does not migrate.** See §4.12.

---

## 2. Decisions that settle the contradictions

Each row is a conflict between the two source documents. The winner and the reason are recorded so nobody re-opens them by accident.

| # | Conflict | HTML said | MD said | **Decision** | Why |
|---|---|---|---|---|---|
| 1 | Players per-group or global | per-group, nullable `person_id` later | global `users` + per-group profiles | **Both: global `users` + per-group `player_profiles` with `owner_user_id`** | The escape hatch is already taken in `types.ts`. Level/mobility/condition stay per group — the same person can be a 4 in one group and a 2 in another. |
| 2 | Time | `date` + `time` + `groups.timezone`; `timestamptz` "would silently shift every existing game" | `starts_at timestamptz` | **Wall-clock is the source of truth; `starts_at`/`ends_at timestamptz` are maintained derived columns** | The HTML is right about correctness: a game means "19:00 where the group plays". The MD is right that cross-group queries (`GET /v1/me/games`) need a sortable instant. Store both, compute the instants on write from `(game_date, start_time, groups.timezone)`. |
| 3 | Keys | `bigserial` for players/games, `uuid` for groups | `uuid` everywhere, never expose sequential ids | **`uuid` everywhere** | Sequential ids in URLs let anyone enumerate other groups' games. |
| 4 | Group/game codes | `short_code text UNIQUE` — the 8-char id in URLs today | `join_code_hash` + `join_code_prefix` | **Split the two roles: `public_slug` (non-secret, keeps today's URLs working) + `join_code_hash`/`join_code_prefix` (the credential)** | The prototype conflates "how to address a group" with "how to prove you may join it". Only the second is a secret. |
| 5 | Waiting list | `list_kind` enum + mandatory `position`, deferrable unique | `status` enum only | **Both: `status` for lifecycle + `list_position` for order** | `joined_at` cannot express "overflow pushed to the front of the waitlist" or "roster re-sorted so paid players come first". Order is data. |
| 6 | Money | `court_cost_cents integer`, currency enum | `numeric(12,2)`, `char(3)` | **`court_cost_cents integer` + `currency_code` enum** | Integer cents avoids float drift; the enum matches `GameSession["currency"]` exactly and gives the DB something to validate. |
| 7 | Paid state | `paid_at timestamptz` | `is_paid boolean` | **`paid_at timestamptz`** | Strict superset. The API still exposes `isPaid`. |
| 8 | Cancellation | `cancelled_at` + `cancel_reason IN ('manual','min_players')` | `status` enum + `auto_cancellation_hours` | **All three: `status`, `cancelled_at`, `cancel_reason`, `auto_cancellation_hours`** | Status covers finished/deleted, which the HTML lacked; the reason distinguishes an organizer cancelling from the automatic under-minimum sweep, which the MD lacked. |
| 9 | Player attributes | `NOT NULL` PG enums, Portuguese labels | nullable free `text` | **`NOT NULL` enums with defaults; `level` stays nullable** | The labels are a closed domain (`rapido`/`neutro`/`lento`). `level` is nullable because guest and admin-created profiles may be unrated — but team drawing requires it (§5, rule 16). |
| 10 | Requests | group-scoped, name-only, no account | game-scoped, `user_id NOT NULL`, one row per pair forever | **One table, `user_id` nullable, uniqueness only over *open* requests** | An unauthenticated person entering a game code must be able to ask by name; a rejected person must be able to ask again. The MD's `unique (game_id, user_id)` blocks the second forever. |

Also folded in without conflict: name normalisation uses the MD's generated column (case **and** repeated whitespace), which is stricter than the HTML's `lower(name)` and matches `normalizeText` in `src/utils/game.ts`.

---

## 3. Relationship model

```text
users ──< user_sessions
  ├──< group_memberships >── groups ──< games
  ├──< game_access_requests >─────────┘
  ├──< player_profiles ──< game_participants
  └──< notification_recipients >── notifications

invites ──> groups | games
```

`player_profiles` is the join between a permanent identity and a sports persona. A profile with `group_id` and no `owner_user_id` is an admin-created player. With both, it is a member's own profile. With `owner_user_id` and no `group_id`, it is an approved guest.

---

## 4. Schema

### 4.1 Extensions and enums

```sql
create extension if not exists pgcrypto;
create extension if not exists citext;

create type group_role         as enum ('admin', 'participant');
create type game_status        as enum ('active', 'cancelled', 'finished', 'deleted');
create type cancel_reason      as enum ('manual', 'min_players');
create type player_mobility    as enum ('rapido', 'neutro', 'lento');
create type player_condition   as enum ('boa', 'neutro', 'ruim');
create type player_position    as enum ('goleiro', 'defesa', 'ataque', 'neutro');
create type currency_code      as enum ('EUR', 'USD', 'GBP', 'BRL');
create type participant_status as enum ('confirmed', 'waiting_list', 'left', 'removed');
create type team_side          as enum ('A', 'B');
create type request_kind       as enum ('join', 'leave', 'payment');
create type access_source      as enum ('invite', 'manual_code', 'admin_added');
create type access_status      as enum ('pending', 'approved', 'rejected', 'revoked');
create type invite_type        as enum ('group_admin', 'group_participant', 'game_guest');
create type notification_type  as enum (
  'game_access_requested', 'player_joined', 'player_left',
  'payment_status_changed', 'waiting_list_promoted', 'game_cancelled'
);
```

The enums are prefixed (`player_position`, not `position`) because `POSITION` is an SQL function and `condition` is a keyword in adjacent dialects. The TypeScript `Position` type maps to the `field_position` column.

### 4.2 Users and sessions

```sql
create table users (
  id                      uuid primary key default gen_random_uuid(),
  display_name            text not null check (char_length(trim(display_name)) between 1 and 80),
  display_name_normalized text generated always as (
    lower(regexp_replace(trim(display_name), '[[:space:]]+', ' ', 'g'))
  ) stored,
  email                   citext not null unique,
  email_verified_at       timestamptz null,
  access_code_hash        text not null,
  access_code_updated_at  timestamptz not null default now(),
  is_staff                boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table user_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  token_hash   text not null unique,
  device_label text null,
  expires_at   timestamptz null,
  revoked_at   timestamptz null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index user_sessions_active_idx on user_sessions(user_id) where revoked_at is null;
```

Identity flow, unchanged from `backend-schema.md`:

```text
First use  → name + email → access code sent by email → session
New device → email + access code → session for the same user
```

The access code behaves like a password: only its hash is stored, it is never shown again after issuance, and regeneration invalidates the previous code. Display names may repeat across users; uniqueness is enforced per group and per active game list.

### 4.3 Groups and memberships

```sql
create table groups (
  id                      uuid primary key default gen_random_uuid(),
  public_slug             text not null unique,   -- non-secret; today's 8-char URL id
  name                    text not null check (char_length(trim(name)) between 1 and 80),
  join_code_hash          text not null unique,
  join_code_prefix        text not null,
  organizer_passcode_hash text not null,
  timezone                text not null default 'Europe/Lisbon',
  created_by_user_id      uuid not null references users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  archived_at             timestamptz null
);

create index groups_join_code_prefix_idx on groups(join_code_prefix);

create table group_memberships (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references groups(id) on delete cascade,
  user_id   uuid not null references users(id) on delete cascade,
  role      group_role not null,
  joined_at timestamptz not null default now(),
  left_at   timestamptz null
);

create unique index group_memberships_one_active_idx
  on group_memberships(group_id, user_id) where left_at is null;
create index group_memberships_user_active_idx
  on group_memberships(user_id, group_id) where left_at is null;
```

`timezone` is an IANA name and is validated against `zoneinfo.available_timezones()` at the service layer. It is what makes decision 2 safe when the server runs in another region.

### 4.4 Player profiles

```sql
create table player_profiles (
  id                      uuid primary key default gen_random_uuid(),
  group_id                uuid null references groups(id) on delete cascade,
  owner_user_id           uuid null references users(id) on delete set null,
  display_name            text not null check (char_length(trim(display_name)) between 1 and 80),
  display_name_normalized text generated always as (
    lower(regexp_replace(trim(display_name), '[[:space:]]+', ' ', 'g'))
  ) stored,
  level                   smallint null check (level between 1 and 5),
  mobility                player_mobility  not null default 'neutro',
  condition               player_condition not null default 'neutro',
  field_position          player_position  not null default 'neutro',
  legacy_ref              text null,      -- old per-group numeric id, migration only
  archived_at             timestamptz null,
  created_at              timestamptz not null default now(),
  check (group_id is not null or owner_user_id is not null)
);

create unique index player_profiles_group_name_idx
  on player_profiles(group_id, display_name_normalized)
  where group_id is not null and archived_at is null;
create unique index player_profiles_one_owned_per_group_idx
  on player_profiles(group_id, owner_user_id)
  where group_id is not null and owner_user_id is not null;
create unique index player_profiles_legacy_ref_idx
  on player_profiles(group_id, legacy_ref) where legacy_ref is not null;
```

`archived_at` (HTML-only) retires a player without losing game history. The name index excludes archived rows, so a retired name can be reused — the HTML's index would have blocked it forever.

### 4.5 Games

```sql
create table games (
  id                      uuid primary key default gen_random_uuid(),
  group_id                uuid not null references groups(id) on delete cascade,
  public_slug             text not null unique,
  join_code_hash          text not null unique,
  join_code_prefix        text not null,

  game_date               date not null,
  start_time              time not null,
  end_time                time null,             -- null when the slot crosses midnight
  duration_minutes        integer not null check (duration_minutes > 0),
  starts_at               timestamptz not null,  -- derived from date+time+group timezone
  ends_at                 timestamptz not null,  -- derived; = starts_at + duration

  location                text not null default '',
  court_number            text not null default '',
  court_cost_cents        integer not null default 0 check (court_cost_cents >= 0),
  currency                currency_code not null default 'EUR',
  max_players             integer not null check (max_players >= 2),
  min_players             integer null check (min_players >= 2),
  auto_cancellation_hours integer null check (auto_cancellation_hours > 0),

  status                  game_status not null default 'active',
  cancelled_at            timestamptz null,
  cancel_reason           cancel_reason null,

  payment_info            text not null default '',
  player_notice           text not null default '',

  teams_drawn_at          timestamptz null,
  team_a_score            numeric(5,2) null,
  team_b_score            numeric(5,2) null,

  legacy_ref              text null,             -- migration only
  created_by_user_id      uuid not null references users(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  check (min_players is null or min_players <= max_players),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  check (cancel_reason is null or status = 'cancelled'),
  check ((teams_drawn_at is null) or (team_a_score is not null and team_b_score is not null))
);

create index games_group_start_idx on games(group_id, game_date, start_time);
create index games_group_active_idx on games(group_id, starts_at) where status = 'active';
create index games_starts_at_idx on games(starts_at) where status = 'active';
create index games_join_code_prefix_idx on games(join_code_prefix);
create unique index games_legacy_ref_idx on games(group_id, legacy_ref) where legacy_ref is not null;
```

`starts_at`/`ends_at` cannot be Postgres generated columns — the conversion depends on another table's `timezone` and `AT TIME ZONE` is stable, not immutable. They are recomputed in the same transaction as any write to `game_date`, `start_time`, `duration_minutes`, or the group's `timezone` (see §6.2). `games_group_start_idx` serves in-group listing from wall-clock; `games_starts_at_idx` serves "My next games" across groups.

### 4.6 Game list, waiting list, teams, payments

```sql
create table game_participants (
  id                      uuid primary key default gen_random_uuid(),
  game_id                 uuid not null references games(id) on delete cascade,
  player_id               uuid not null references player_profiles(id) on delete restrict,
  user_id                 uuid null references users(id) on delete set null,
  display_name_snapshot   text not null check (char_length(trim(display_name_snapshot)) between 1 and 80),
  display_name_normalized text generated always as (
    lower(regexp_replace(trim(display_name_snapshot), '[[:space:]]+', ' ', 'g'))
  ) stored,
  status                  participant_status not null,
  list_position           integer null check (list_position >= 0),
  paid_at                 timestamptz null,
  team                    team_side null,
  level_at_draw           smallint null check (level_at_draw between 1 and 5),
  joined_at               timestamptz not null default now(),
  left_at                 timestamptz null,
  updated_at              timestamptz not null default now(),

  constraint game_participants_one_per_player unique (game_id, player_id),
  constraint game_participants_list_order
    unique (game_id, status, list_position) deferrable initially deferred,
  check ((status in ('confirmed', 'waiting_list')) = (list_position is not null)),
  check ((status in ('left', 'removed')) = (left_at is not null)),
  check (team is null or status = 'confirmed')
);

create index game_participants_game_status_idx
  on game_participants(game_id, status, list_position);
create unique index game_participants_active_name_idx
  on game_participants(game_id, display_name_normalized)
  where status in ('confirmed', 'waiting_list');
```

This one table replaces `playerIds`, `waitlistIds`, `paidPlayerIds` and `teams` — four views of a single relationship. `paidPlayerIds` is always a subset of `playerIds`, which the prototype prunes by hand at three separate call sites; as a `paid_at` column on the membership row, that entire class of bug disappears.

Three things worth spelling out:

- **`list_position` is `NULL` exactly when the row is inactive.** That is what lets `unique (game_id, status, list_position)` be a real deferrable constraint: `NULL`s never collide, so any number of `left`/`removed` rows coexist, while active rows are strictly ordered. A partial unique *index* could not be deferrable, and renumbering a list needs deferral.
- **`on delete restrict` on `player_id`** — the HTML declared `ON DELETE CASCADE` here while also adding `archived_at` to keep history. Those cancel out. Archive players; never delete them.
- **`level_at_draw`** snapshots the level each player had when teams were drawn, for the same reason the HTML snapshots `team_a_score`: `generateBalancedTeams` is nondeterministic (random tie-breaks, a random pick among near-equal alternatives, a final shuffle per side), so the draw cannot be recomputed, and editing a level afterwards must not rewrite history.

### 4.7 Access requests and grants

One table replaces the HTML's `participation_requests` and the MD's `user_game_accesses`, and additionally carries the `join | leave | payment` request kinds that already exist in `types.ts`.

```sql
create table game_access_requests (
  id                        uuid primary key default gen_random_uuid(),
  group_id                  uuid not null references groups(id) on delete cascade,
  game_id                   uuid null references games(id) on delete cascade,
  user_id                   uuid null references users(id) on delete cascade,
  kind                      request_kind not null default 'join',
  source                    access_source not null,
  status                    access_status not null default 'pending',
  requested_name            text not null check (char_length(trim(requested_name)) between 1 and 80),
  requested_name_normalized text generated always as (
    lower(regexp_replace(trim(requested_name), '[[:space:]]+', ' ', 'g'))
  ) stored,
  payment_confirmed         boolean not null default false,
  resolved_player_id        uuid null references player_profiles(id) on delete set null,
  reviewed_by_user_id       uuid null references users(id),
  reviewed_at               timestamptz null,
  rejection_reason          text null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  check ((status = 'pending') = (reviewed_at is null)),
  check (kind = 'join' or game_id is not null)
);

create unique index game_access_requests_open_user_idx
  on game_access_requests(game_id, user_id, kind)
  where status = 'pending' and game_id is not null and user_id is not null;
create unique index game_access_requests_open_name_idx
  on game_access_requests(group_id, requested_name_normalized, kind)
  where status = 'pending';
create index game_access_requests_user_idx
  on game_access_requests(user_id, status, created_at desc);
create index game_access_requests_pending_group_idx
  on game_access_requests(group_id, created_at) where status = 'pending';
```

An `approved` row with `kind = 'join'` **is** the guest's access grant — it powers "My next games" for people who are not group members. Group members derive access from active membership and never need a row here. Uniqueness is over open requests only, so a rejected person can ask again.

### 4.8 Invitations

```sql
create table invites (
  id                 uuid primary key default gen_random_uuid(),
  token_hash         text not null unique,
  token_prefix       text not null,
  type               invite_type not null,
  group_id           uuid null references groups(id) on delete cascade,
  game_id            uuid null references games(id) on delete cascade,
  created_by_user_id uuid not null references users(id),
  expires_at         timestamptz null,
  max_uses           integer null check (max_uses is null or max_uses > 0),
  use_count          integer not null default 0 check (use_count >= 0),
  revoked_at         timestamptz null,
  created_at         timestamptz not null default now(),
  check (
    (type in ('group_admin', 'group_participant') and group_id is not null and game_id is null)
    or (type = 'game_guest' and game_id is not null and group_id is null)
  ),
  check (max_uses is null or use_count <= max_uses)
);

create index invites_token_prefix_idx on invites(token_prefix);
```

### 4.9 Notifications

```sql
create table notifications (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references groups(id) on delete cascade,
  game_id       uuid null references games(id) on delete cascade,
  request_id    uuid null references game_access_requests(id) on delete cascade,
  type          notification_type not null,
  actor_user_id uuid null references users(id) on delete set null,
  player_id     uuid null references player_profiles(id) on delete set null,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index notifications_group_created_idx on notifications(group_id, created_at desc);

create table notification_recipients (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  dismissed_at    timestamptz null,
  primary key (notification_id, user_id)
);

create index notification_recipients_open_idx
  on notification_recipients(user_id) where dismissed_at is null;
```

Every active group admin gets their own recipient row, so dismissing affects only that admin. *Approve all* approves every pending request in one transaction; *dismiss all* sets `dismissed_at` for the current admin only.

### 4.10 Derived, so deliberately not stored

Price per player, paid and unpaid counts, `hasGameEnded`, `isVisibleToParticipants`, and duration when `end_time` is present. All cheap in a query; expose them through a view:

```sql
create view game_summary as
select g.id as game_id,
       g.group_id,
       count(*) filter (where p.status = 'confirmed')     as confirmed_count,
       count(*) filter (where p.status = 'waiting_list')  as waiting_count,
       count(*) filter (where p.status = 'confirmed' and p.paid_at is not null) as paid_count,
       case when count(*) filter (where p.status = 'confirmed') > 0
            then g.court_cost_cents::numeric / count(*) filter (where p.status = 'confirmed')
            else g.court_cost_cents::numeric end          as price_per_player_cents,
       g.ends_at <= now()                                  as has_ended,
       g.ends_at > now() - interval '24 hours'             as visible_to_participants
from games g
left join game_participants p on p.game_id = g.id
group by g.id;
```

Rounding happens at the presentation edge, never in storage.

### 4.11 Deliberate additions

Clearly marked, because they were in neither document:

1. `public_slug` separated from `join_code_hash` (decision 4).
2. `starts_at` / `ends_at` as maintained derived columns (decision 2).
3. `game_access_requests.kind` and `payment_confirmed` — required by `types.ts` today.
4. `legacy_ref` on `player_profiles` and `games` — makes the localStorage import idempotent and re-runnable.
5. `level_at_draw` — completes the HTML's own argument about snapshotting the draw.
6. `on delete restrict` for `game_participants.player_id`, and the name index skipping archived rows.
7. The `game_summary` view.
8. `users.is_staff` — the honest replacement for `devGodMode`.

### 4.12 What does not migrate

`CurrentUser.devGodMode` is a browser-side bypass. On a shared server it is a privilege-escalation switch. It becomes `users.is_staff`, defaults to `false`, is settable only by a direct database operator, and grants read-only support access — never write access to another group's data. The frontend keeps its dev flag for local work only, and the server ignores it.

---

## 5. Mandatory business rules

Rules 1–12 come from `backend-schema.md`; 13–18 come from the HTML's rationale sections and had no counterpart there.

1. Creating a group creates an active admin membership for its creator.
2. Only active group admins may edit groups, games and players; remove others; or create group invitations.
3. Active group members may invite a guest to a game they can access.
4. A group member joins using their linked profile, without approval. A full game places them on the waiting list.
5. Guests never receive the group directory.
6. A game code or link creates a pending request. The game appears in *My next games*, but its actions are blocked.
7. Only a group admin may approve or reject guest access.
8. Approval grants the guest that one game, never a group membership.
9. Join, leave and payment changes notify all active group admins.
10. A participant may update only their own payment state.
11. Names are unique, ignoring case and repeated whitespace, within each group and each active game list.
12. Changing a group passcode requires the current passcode and does not invalidate existing memberships.
13. **The waiting list is FIFO and its order is authoritative.** Promotion takes the head; overflow from a shrunken roster is pushed to the front; new entries append to the tail. Renumber the affected list in the same transaction as any insert, removal or reorder.
14. **The roster is re-sorted so paid players come first**, preserving relative order within each block. This is a stored order, not a display-time sort.
15. **Teams are stored, never recomputed.** Once `teams_drawn_at` is set, `team`, `level_at_draw`, `team_a_score` and `team_b_score` are immutable except by an explicit re-draw, which overwrites all of them together.
16. **Drawing teams requires every confirmed player to have a `level`.** The service rejects the draw and names the unrated players.
17. **Cancellation records its cause.** `manual` for an organizer, `min_players` for the automatic sweep that runs `auto_cancellation_hours` before `starts_at` (default 4) when confirmed players are below `min_players`.
18. **Players are archived, not deleted.** Deleting a profile with game history is refused by the database.

---

## 6. HTTP API

### 6.1 Endpoints

```text
POST   /v1/auth/start
POST   /v1/auth/verify
POST   /v1/me/access-code/regenerate
GET    /v1/me
PATCH  /v1/me
DELETE /v1/sessions/current

GET    /v1/groups
POST   /v1/groups
POST   /v1/groups/join
GET    /v1/groups/{group_id}
PATCH  /v1/groups/{group_id}
POST   /v1/groups/{group_id}/passcode
POST   /v1/groups/{group_id}/leave
POST   /v1/groups/{group_id}/invites
GET    /v1/invites/{token}
POST   /v1/invites/{token}/accept

GET    /v1/groups/{group_id}/players
POST   /v1/groups/{group_id}/players
PATCH  /v1/groups/{group_id}/players/{player_id}
POST   /v1/groups/{group_id}/players/{player_id}/archive

GET    /v1/groups/{group_id}/games
POST   /v1/groups/{group_id}/games
GET    /v1/games/{game_id}
PATCH  /v1/games/{game_id}
POST   /v1/games/{game_id}/cancel
GET    /v1/me/games
POST   /v1/games/lookup
POST   /v1/games/{game_id}/invites

POST   /v1/games/{game_id}/requests
POST   /v1/games/{game_id}/requests/{request_id}/approve
POST   /v1/games/{game_id}/requests/{request_id}/reject
POST   /v1/games/{game_id}/requests/approve-all

POST   /v1/games/{game_id}/participants
POST   /v1/games/{game_id}/participants/reorder
PATCH  /v1/games/{game_id}/participants/{participant_id}/payment
POST   /v1/games/{game_id}/participants/{participant_id}/leave
DELETE /v1/games/{game_id}/participants/{participant_id}

POST   /v1/games/{game_id}/teams/draw
GET    /v1/games/{game_id}/teams
PUT    /v1/games/{game_id}/teams/scores

GET    /v1/me/notifications
POST   /v1/me/notifications/{notification_id}/dismiss
POST   /v1/me/notifications/dismiss-all
```

`POST /v1/groups/join` accepts a code and a role; admin mode also requires the current group passcode. `POST /v1/games/lookup` returns public game information only and must never expose the group player directory to a guest. The teams and reorder endpoints are new — they cover HTML-only features the MD's API had no route for.

### 6.2 Transactional operations

Every one of these takes `SELECT ... FROM games WHERE id = :id FOR UPDATE` first, then does its work, then commits:

- **Join** — lock the game, count confirmed, insert as `confirmed` or `waiting_list` at the tail, renumber, notify admins.
- **Leave / remove** — mark `left`/`removed`, set `left_at`, null `list_position`, promote the waiting-list head, renumber both lists, notify.
- **Payment change** — set or clear `paid_at`, re-sort the roster paid-first, renumber, notify.
- **Roster capacity change** — if `max_players` shrinks, move the tail of the roster to the *front* of the waiting list, renumber both.
- **Approve all** — approve every pending request in one transaction; a single failure rolls the batch back.
- **Auto-cancellation sweep** — one transaction per game: recheck `min_players`, set `status`, `cancelled_at`, `cancel_reason = 'min_players'`, notify.
- **Any write touching date, time, duration or group timezone** — recompute `starts_at`/`ends_at` in the same statement.

### 6.3 Permission payload

Return calculated permissions. The frontend must not infer authorization from ids or UI state.

```json
{
  "game": { "id": "uuid", "location": "Court 3", "status": "active" },
  "viewerAccess": {
    "kind": "guest",
    "status": "pending",
    "canViewDetails": true,
    "canViewGroupPlayers": false,
    "canJoin": false,
    "canLeave": false,
    "canUpdateOwnPayment": false,
    "canDrawTeams": false,
    "canManageGame": false
  }
}
```

After approval, `canJoin`, `canLeave` and `canUpdateOwnPayment` become `true` while `canViewGroupPlayers` stays `false`.

---

## 7. Python implementation

### 7.1 Stack

| Concern | Choice | Note |
|---|---|---|
| Runtime | Python 3.12+ | `StrEnum`, `zoneinfo` in stdlib |
| Framework | FastAPI | OpenAPI for free; the frontend can generate its client |
| ORM / SQL | SQLAlchemy 2.0, async, typed `Mapped[...]` | Needed for `FOR UPDATE`, partial indexes, deferrable constraints |
| Driver | psycopg 3 (async) | Best native enum and `date`/`time` handling; `asyncpg` also fine |
| Migrations | Alembic | Owns all enum types and every index in §4 |
| Validation | Pydantic v2 + `pydantic-settings` | Request/response models, camelCase alias generator |
| Password hashing | `argon2-cffi` (Argon2id) | Group passcodes, access codes |
| Token hashing | `hashlib.sha256` | Session and invite tokens are already 256-bit random; Argon2 there only costs latency |
| Email | `aiosmtplib` behind a `Mailer` protocol | Console mailer in dev |
| Tests | `pytest`, `pytest-asyncio`, `testcontainers[postgres]` | Real Postgres — the schema leans on partial indexes and deferrable constraints that SQLite cannot emulate |
| Lint / types | `ruff`, `mypy --strict` | |
| Serving | `uvicorn` behind `gunicorn` `UvicornWorker` | |

### 7.2 Layout

```text
backend/
  pyproject.toml
  alembic.ini
  migrations/versions/
  app/
    main.py                  # FastAPI app, lifespan, error handlers
    core/
      config.py              # pydantic-settings
      security.py            # argon2 + token hashing, code generation
      time.py                # wall-clock ↔ instant conversion
    db/
      base.py                # DeclarativeBase + MetaData naming_convention
      session.py             # async engine, session factory
      models/                # one module per §4 subsection
    domain/
      enums.py               # StrEnums mirroring the PG enums
      groups.py  games.py  participants.py
      requests.py  invites.py  notifications.py
      teams.py               # port of generateBalancedTeams
      ordering.py            # list renumbering
    api/
      deps.py                # current_user, require_group_admin, ...
      v1/                    # one router per resource
    schemas/                 # Pydantic request/response models
  tests/
```

Rule: routers do HTTP and authorization; `domain/` owns transactions and invariants; models never contain business logic. Authorization is decided in `deps.py` from `group_memberships` and `game_access_requests`, never from a path id.

### 7.3 Python-specific gotchas

**Enums.** Mirror the labels exactly and let Alembic own the type:

```python
class ParticipantStatus(StrEnum):
    CONFIRMED = "confirmed"
    WAITING_LIST = "waiting_list"
    LEFT = "left"
    REMOVED = "removed"

status: Mapped[ParticipantStatus] = mapped_column(
    Enum(ParticipantStatus, name="participant_status",
         native_enum=True, create_type=False,
         values_callable=lambda e: [m.value for m in e]),
    nullable=False,
)
```

Without `values_callable`, SQLAlchemy sends the *member names* (`CONFIRMED`) instead of the values (`confirmed`). Without `create_type=False`, the type is created twice.

**Generated columns** are read-only — declare them so SQLAlchemy never writes them:

```python
display_name_normalized: Mapped[str] = mapped_column(
    Text,
    Computed("lower(regexp_replace(trim(display_name), '[[:space:]]+', ' ', 'g'))", persisted=True),
)
```

**Deferrable constraint** in the table args:

```python
__table_args__ = (
    UniqueConstraint("game_id", "player_id", name="game_participants_one_per_player"),
    UniqueConstraint("game_id", "status", "list_position",
                     name="game_participants_list_order",
                     deferrable=True, initially="DEFERRED"),
)
```

Because it is `INITIALLY DEFERRED`, renumbering needs no `SET CONSTRAINTS`: write the intermediate states freely, and the check runs at commit.

**Naming convention** on the `MetaData`, or Alembic autogenerate will invent names that do not match §4:

```python
NAMING = {
    "ix": "%(table_name)s_%(column_0_N_name)s_idx",
    "uq": "%(table_name)s_%(column_0_N_name)s_key",
    "ck": "%(table_name)s_%(constraint_name)s_check",
    "fk": "%(table_name)s_%(column_0_name)s_fkey",
    "pk": "%(table_name)s_pkey",
}
```

**Time.** Wall-clock in, instant derived:

```python
from zoneinfo import ZoneInfo

def to_instant(game_date: date, start: time, tz: str) -> datetime:
    return datetime.combine(game_date, start, tzinfo=ZoneInfo(tz)).astimezone(UTC)
```

`date` and `time` round-trip as `datetime.date` / `datetime.time`. Serialise them as `"YYYY-MM-DD"` and `"HH:MM"` so `GameSession.date` and `.time` in the frontend need no change.

**Money.** `court_cost_cents` is `int`. Never build a `float` from it. `numeric(5,2)` scores arrive as `Decimal`; Pydantic serialises them as strings by default — keep that.

**Partial indexes** are index-only, so declare them with `Index(..., postgresql_where=...)`, and never rely on `unique=True` on the column for those cases.

**The join transaction**, as the shape everything else follows:

```python
async def join_game(session: AsyncSession, game_id: UUID, profile: PlayerProfile) -> GameParticipant:
    async with session.begin():
        game = (await session.execute(
            select(Game).where(Game.id == game_id).with_for_update()
        )).scalar_one()

        if game.status != GameStatus.ACTIVE:
            raise GameNotJoinable(game.status)

        confirmed = (await session.execute(
            select(func.count()).select_from(GameParticipant).where(
                GameParticipant.game_id == game_id,
                GameParticipant.status == ParticipantStatus.CONFIRMED,
            )
        )).scalar_one()

        status = (ParticipantStatus.CONFIRMED if confirmed < game.max_players
                  else ParticipantStatus.WAITING_LIST)
        row = GameParticipant(
            game_id=game_id, player_id=profile.id, user_id=profile.owner_user_id,
            display_name_snapshot=profile.display_name, status=status,
            list_position=await next_position(session, game_id, status),
        )
        session.add(row)
        await renumber(session, game_id, status)
        await notify_admins(session, game, NotificationType.PLAYER_JOINED, player=profile)
        return row
```

`with_for_update()` on the game row is what serialises concurrent joins — the count is only correct while that lock is held.

**Testing.** Spin a real Postgres per session with `testcontainers`, run Alembic to head, and wrap each test in a rolled-back transaction. Cover at least: two simultaneous joins on the last slot, promotion after a leave, a `max_players` reduction pushing overflow to the front of the waitlist, a re-draw overwriting teams, and a rejected request being re-submitted.

---

## 8. Migration from localStorage

Source keys: `playup.groups.v1` (a `PlayerGroup[]`), `playup.active-group.v1`, `playup.current-user.v1`.

Ship a one-shot importer: the browser `POST`s its `playup.groups.v1` blob to `POST /v1/import/legacy`, which validates it and runs **one transaction per group**:

1. **User** — from `playup.current-user.v1`, create or match `users` by email. Issue a fresh access code by email. Ignore `devGodMode` (§4.12).
2. **Group** — insert with `public_slug` = today's group id so URLs already in circulation still resolve. Hash `organizerPasscode` into `organizer_passcode_hash`, or force a reset on first login — it was readable in DevTools, so treating it as compromised is the safer default. Issue a **new** join code; set `timezone` from the importer's `Intl.DateTimeFormat().resolvedOptions().timeZone`. Create an active `admin` membership for the user, and a `participant` membership for anyone in `adminGroupIds` accordingly.
3. **Players** — insert with `legacy_ref` = the old numeric id. Map `Player.ownerUserId` to `owner_user_id`. Keep the `{ old id → uuid }` map in memory.
4. **Games** — insert with `legacy_ref` = the old numeric id; compute `starts_at`/`ends_at` from `date` + `time` + the group timezone; `courtCost` → `round(courtCost * 100)`; `cancelled: true` → `status='cancelled'`, `cancelled_at = now()`, `cancel_reason = 'manual'` (the old boolean cannot distinguish the two causes — this is a known, one-way loss); `cancellationHours` → `auto_cancellation_hours`; `disclaimer` → `player_notice`.
5. **Participants** — walk the three id arrays: `list_position` = array index, `status = 'confirmed'` for `playerIds` and `'waiting_list'` for `waitlistIds`, `paid_at = now()` where the id is in `paidPlayerIds`, `team` from `teams.teamA`/`teams.teamB`, `level_at_draw` from the player's current level, `teams_drawn_at = now()` and `team_a_score`/`team_b_score` from `teams.sumA`/`sumB` when `teams` is not null.
6. **Requests** — `ParticipationRequest` → `game_access_requests`: `type` → `kind` (default `join`), `requesterUserId` → `user_id`, `paymentConfirmed` → `payment_confirmed`, `playerId` → `resolved_player_id`, `source = 'manual_code'`, `status = 'pending'`.

The numeric ids from `nextIdentifier` are unique only within a group, so they cannot survive as primary keys — building those maps is the substance of the migration. `legacy_ref` makes a re-run a no-op instead of a duplicate.

The invite-code formats in `src/utils/inviteCodes.ts` are prototype-only and must not survive:

| Use | Prototype | Production |
|---|---|---|
| Join a group as participant | `PUG-<groupId>` | random invite token, or hashed group join code |
| Invite a group admin | `PUA-ADMIN-<groupId>` | random invite token **plus** the group passcode |
| Open a specific game | `PUG-GAME-<groupId>-<gameId>` | random invite token, or hashed game join code |

---

## 9. Security notes

- UUID primary keys and cryptographically random tokens; never expose sequential ids.
- Argon2id for group passcodes and user access codes; SHA-256 for high-entropy session and invite tokens. Store hashes only.
- A short non-secret `*_prefix` narrows candidate rows before the hash comparison, so code lookup stays one indexed read.
- Authorization is decided on the server, from memberships and grants — never from a path id or a frontend flag.
- Invites support expiry, revocation and usage limits, checked inside the accept transaction.
- Record the admin who approved or rejected each request (`reviewed_by_user_id`, `reviewed_at`).
- Rate-limit `POST /v1/auth/start`, `/v1/auth/verify`, `/v1/groups/join` and `/v1/games/lookup` per IP and per email; these are the code-guessing surfaces.
- If Postgres is ever exposed directly, add row-level security mirroring §5. With a dedicated API, keep the same rules in the service layer.

## 10. Engine notes

Postgres is the target. If SQLite or MySQL is ever needed: neither has `CREATE TYPE`, so use `text` with `CHECK (... IN (...))`, which behaves identically and is easier to extend. SQLite lacks deferrable unique constraints — renumber via a temporary negative offset, or enforce list order in application code. MySQL wants `ENUM(...)` inline and a case-insensitive collation instead of the normalized-name indexes, and has no partial indexes, so the "unique among open/active rows" indexes have to move into application code.

## 11. Build order

1. Migrations for §4.2–4.4 + auth, sessions, groups, memberships. Ship login on two devices.
2. Players and games, including the `starts_at` derivation and the timezone column.
3. Participants: join, leave, waiting list, renumbering, payments. The hardest part — do it with the concurrency tests from §7.3.
4. Requests, invites, notifications, guest access, the permission payload.
5. Teams: draw, snapshot, scores, re-draw.
6. Auto-cancellation sweep as a scheduled job.
7. The legacy importer, then cut the frontend over.

---

## Complemento em português

Este plano unifica os dois documentos anteriores. O inglês continua sendo a referência de implementação.

- **Backend em Python:** FastAPI + SQLAlchemy 2.0 + PostgreSQL. Existe uma versão equivalente em TypeScript (`backend-plan-typescript.md`) com o mesmo banco e as mesmas regras.
- **Identidade:** cada pessoa tem nome, e-mail e um código de acesso enviado por e-mail; o código pode ser regenerado e é guardado apenas como hash. Uma pessoa pode ser admin de um grupo e apenas participante de outro — admin nunca é papel global.
- **Perfis por grupo:** nível, mobilidade, condição e posição continuam por grupo. A mesma pessoa pode ser nível 4 num grupo e 2 noutro, mas com uma única conta.
- **Horário:** o jogo é guardado como data + hora local mais o fuso do grupo. As colunas `starts_at`/`ends_at` são derivadas, só para ordenar "meus próximos jogos". Guardar apenas `timestamptz` deslocaria todos os jogos existentes.
- **Lista de espera:** a ordem é dado, não detalhe visual. É FIFO, com `list_position` explícito, renumerado dentro da mesma transação.
- **Times:** o sorteio é aleatório, então os times e os placares ficam gravados — nunca recalculados.
- **Cancelamento:** guarda o motivo (`manual` ou `min_players`).
- **Jogadores são arquivados, nunca apagados**, para não perder histórico.
- **Convidado (guest):** pede entrada com o nome, fica pendente e só usa as ações do jogo depois da aprovação de um admin. Nunca recebe a lista de jogadores do grupo.
- **Dinheiro** em centavos inteiros; arredondamento só na apresentação.
- Os códigos locais previsíveis (`PUG-`, `PUA-ADMIN-`) existem só no protótipo; o backend usará tokens aleatórios com hash.
