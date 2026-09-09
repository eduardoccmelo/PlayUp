# PlayUp — backend specification

**Portuguese companion:** a concise Portuguese summary is included at the end. English is the source of truth for implementation decisions.

## Scope

This document specifies a relational backend for the current PlayUp flow:

- one profile can be an admin in one group and a participant in another;
- group invitations for admins and participants, plus manual group-code entry;
- game invitations and manual game-code entry;
- guests who can access only a specific game;
- access requests, approval, waiting lists, payment state, and self-removal;
- admin notifications, including payment updates and bulk actions.

**Recommended database:** PostgreSQL 15+. Use JSON for API transport, but keep permissions, memberships, history, and state transitions normalized in relational tables.

## Identity and cross-device access

~~~text
First use → name + email → access code sent by email → session
New device → email + access code → session for the same user
~~~

The access code behaves like a password: only its hash is stored, it is never shown after issuance, and regeneration invalidates the previous code. Until email delivery exists, the prototype may continue to use local browser storage; that is not the production identity model.

## Roles and terms

| Term | Meaning |
|---|---|
| admin | Administrator of one group; never a global role. |
| participant | Permanent group member without administration rights. |
| guest | Not a group member; may access one approved game only. |
| player | Sports profile/name on a game list. It may be linked to a user or created by an admin. |

A user may be an admin in Group A, a participant in Group B, and a guest in Game C.

## Relationship model

~~~text
users ──< user_sessions
  ├──< group_memberships >── groups ──< games
  ├──< user_game_accesses >────────┘
  ├──< player_profiles ──< game_participants
  └──< notification_recipients >── notifications

invites ──> groups or games
~~~

## PostgreSQL DDL

### Extensions and enums

~~~sql
create extension if not exists pgcrypto;
create extension if not exists citext;

create type group_role as enum ('admin', 'participant');
create type game_status as enum ('active', 'cancelled', 'finished', 'deleted');
create type game_access_source as enum ('invite', 'manual_code');
create type game_access_status as enum ('pending', 'approved', 'rejected', 'revoked');
create type game_participant_status as enum (
  'confirmed', 'waiting_list', 'left', 'removed'
);
create type invite_type as enum ('group_admin', 'group_participant', 'game_guest');
create type notification_type as enum (
  'game_access_requested', 'player_joined', 'player_left', 'payment_status_changed'
);
~~~

### Users and sessions

~~~sql
create table users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  display_name_normalized text generated always as (
    lower(regexp_replace(trim(display_name), '[[:space:]]+', ' ', 'g'))
  ) stored,
  email citext not null unique,
  email_verified_at timestamptz null,
  access_code_hash text not null,
  access_code_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  device_label text null,
  expires_at timestamptz null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index user_sessions_active_idx
  on user_sessions(user_id) where revoked_at is null;
~~~

Session tokens and access codes are accepted or returned only in dedicated flows; the database stores hashes only. Display names may repeat between users, but uniqueness within a group and an active game list is mandatory.

### Groups and memberships

~~~sql
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  join_code_hash text not null unique,
  join_code_prefix text not null,
  organizer_password_hash text not null,
  created_by_user_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null
);

create index groups_join_code_prefix_idx on groups(join_code_prefix);

create table group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role group_role not null,
  joined_at timestamptz not null default now(),
  left_at timestamptz null
);

create unique index group_memberships_one_active_idx
  on group_memberships(group_id, user_id) where left_at is null;
create index group_memberships_user_active_idx
  on group_memberships(user_id, group_id) where left_at is null;
~~~

Use Argon2id (preferred) or bcrypt for group codes and organizer passcodes. A short, non-sensitive prefix narrows candidates before comparing hashes.

### Player profiles

~~~sql
create table player_profiles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid null references groups(id) on delete cascade,
  owner_user_id uuid null references users(id) on delete set null,
  is_guest boolean not null default false,
  display_name text not null check (char_length(display_name) between 1 and 80),
  display_name_normalized text generated always as (
    lower(regexp_replace(trim(display_name), '[[:space:]]+', ' ', 'g'))
  ) stored,
  level smallint null check (level between 1 and 5),
  mobility text null,
  condition text null,
  position text null,
  created_at timestamptz not null default now(),
  check (group_id is not null or owner_user_id is not null)
);

create unique index player_profiles_group_name_unique_idx
  on player_profiles(group_id, display_name_normalized) where group_id is not null;
create unique index player_profiles_one_owned_group_profile_idx
  on player_profiles(group_id, owner_user_id)
  where group_id is not null and owner_user_id is not null;
~~~

Group profiles may exist without an account. `is_guest = true` identifies a manually created/admin-managed player with no linked user account. When a user joins a group, the service creates or links one owned profile in that group; Join then uses it automatically. An approved guest receives an owned profile and cannot browse the group directory.

### Games and access

~~~sql
create table games (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  join_code_hash text not null unique,
  join_code_prefix text not null,
  location text not null,
  court_number text null,
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes > 0),
  court_cost numeric(12,2) not null default 0 check (court_cost >= 0),
  currency char(3) not null default 'EUR',
  max_players integer not null check (max_players >= 2),
  min_players integer null check (min_players >= 2),
  auto_cancellation_hours integer null check (auto_cancellation_hours > 0),
  payment_info text null,
  player_notice text null,
  status game_status not null default 'active',
  created_by_user_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_players is null or min_players <= max_players)
);

create index games_group_active_idx
  on games(group_id, starts_at) where status = 'active';
create index games_join_code_prefix_idx on games(join_code_prefix);

create table user_game_accesses (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  source game_access_source not null,
  status game_access_status not null default 'pending',
  requested_player_name text not null check (char_length(requested_player_name) between 1 and 80),
  reviewed_by_user_id uuid null references users(id),
  reviewed_at timestamptz null,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, user_id),
  check (
    (status in ('approved', 'rejected', 'revoked') and reviewed_at is not null)
    or status = 'pending'
  )
);

create index user_game_accesses_user_idx
  on user_game_accesses(user_id, status, created_at desc);
~~~

This table powers My next games for people who are not group members. Group members derive access from active membership. A guest request creates a pending row; approval creates or reuses the guest profile but does not add them to the game list.

### Game list, waiting list, and payments

~~~sql
create table game_participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references player_profiles(id),
  user_id uuid null references users(id) on delete set null,
  display_name_snapshot text not null check (char_length(trim(display_name_snapshot)) between 1 and 80),
  display_name_normalized text generated always as (
    lower(regexp_replace(trim(display_name_snapshot), '[[:space:]]+', ' ', 'g'))
  ) stored,
  status game_participant_status not null,
  is_paid boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (game_id, player_id),
  check ((status in ('left', 'removed')) = (left_at is not null))
);

create index game_participants_game_status_idx
  on game_participants(game_id, status, joined_at);
create unique index game_participants_active_name_unique_idx
  on game_participants(game_id, display_name_normalized)
  where status in ('confirmed', 'waiting_list');
~~~

Joining must be transactional: lock the game row, count confirmed players, insert as confirmed or waiting_list, create notifications, then commit. A player leaves only their own entry and does so immediately; an admin may remove another player only from game management.

### Participation statistics

The statistics screen must count a participation only once a non-cancelled game transitions to `finished`, using its confirmed main-list participants. Keep a denormalized counter for fast group-level reads; the game-participant rows remain the source of truth and can rebuild the counter if necessary.

~~~sql
create table player_participation_stats (
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null references player_profiles(id) on delete cascade,
  participation_count integer not null default 0 check (participation_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (group_id, player_id)
);
~~~

When a game is marked `finished`, lock it and insert/upsert one row per confirmed participant, incrementing `participation_count` exactly once. Store a completion marker or enforce the transition in the same transaction so retries cannot double-count. `GET /v1/groups/:groupId/statistics` returns total games, active games, and players ordered by `participation_count DESC`.

### Team-balance snapshots

~~~sql
create table game_team_balances (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  generated_by_user_id uuid not null references users(id),
  algorithm_version text not null,
  team_a_score numeric(8,2) not null,
  team_b_score numeric(8,2) not null,
  generated_at timestamptz not null default now(),
  invalidated_at timestamptz null
);

create unique index game_team_balances_one_active_idx
  on game_team_balances(game_id) where invalidated_at is null;

create table game_team_balance_members (
  team_balance_id uuid not null references game_team_balances(id) on delete cascade,
  participant_id uuid not null references game_participants(id) on delete cascade,
  team_number smallint not null check (team_number in (1, 2)),
  score_snapshot numeric(8,2) not null,
  primary key (team_balance_id, participant_id)
);
~~~

### Team-balancing guard

Manual team balancing is available with at least two paid confirmed participants; unpaid and waiting-list entries are always excluded. When the main list reaches `max_players` and every confirmed participant is paid, generate a balance automatically. If a listed player leaves or becomes unpaid, invalidate any stored team snapshot. A rebalance creates a new snapshot and must prefer a different comparably fair member split when one exists; merely swapping Team A and Team B is not a new balance.

### Invitations and notifications

~~~sql
create table invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  token_prefix text not null,
  type invite_type not null,
  group_id uuid null references groups(id) on delete cascade,
  game_id uuid null references games(id) on delete cascade,
  created_by_user_id uuid not null references users(id),
  expires_at timestamptz null,
  max_uses integer null check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  check (
    (type in ('group_admin', 'group_participant') and group_id is not null and game_id is null)
    or (type = 'game_guest' and game_id is not null and group_id is null)
  )
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  game_id uuid null references games(id) on delete cascade,
  game_access_id uuid null references user_game_accesses(id) on delete cascade,
  type notification_type not null,
  actor_user_id uuid null references users(id) on delete set null,
  player_id uuid null references player_profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table notification_recipients (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  dismissed_at timestamptz null,
  primary key (notification_id, user_id)
);
~~~

Every active group admin receives their own recipient row. Dismissing a message affects only that admin. Approve all must approve pending requests in one transaction; dismiss all sets dismissed_at only for the current admin.

## Mandatory business rules

1. Creating a group creates an active admin membership for its creator.
2. Only active group admins may edit groups, games, and players; remove others; or create group invitations.
3. Active group members may invite a guest to a game they can access.
4. A group member joins using their linked profile, without approval. A full game places them in the waiting list.
5. Guests never receive the group directory.
6. A game code/link creates pending access. The game appears in My next games, but its actions are blocked.
7. Only a group admin may approve or reject guest access.
8. Approval grants the guest only that game, never a group membership.
9. Join, leave, and payment changes notify all active group admins.
10. A participant may update only their own payment state.
11. Names are unique, ignoring case and repeated spaces, inside each group and active game list.
12. Changing a group passcode requires the current passcode and does not invalidate existing memberships.
13. Team balancing includes only paid confirmed main-list participants; waiting-list and unpaid participants never count. At least two paid participants are required for a manual balance; a full, fully paid list balances automatically.
14. Finished games are immutable to both admins and participants except for deletion by an authorized admin. Their API representation is read-only and may include the latest valid team-balance snapshot.

## Suggested HTTP API

~~~text
POST   /v1/auth/start
POST   /v1/auth/verify
POST   /v1/me/access-code/regenerate
GET    /v1/me
PATCH  /v1/me
DELETE /v1/sessions/current

GET    /v1/groups
POST   /v1/groups
POST   /v1/groups/join
GET    /v1/groups/:groupId
PATCH  /v1/groups/:groupId
POST   /v1/groups/:groupId/leave
POST   /v1/groups/:groupId/invites
GET    /v1/invites/:token
POST   /v1/invites/:token/accept

GET    /v1/groups/:groupId/games
POST   /v1/groups/:groupId/games
GET    /v1/games/:gameId
POST   /v1/games/lookup
GET    /v1/me/games
POST   /v1/games/:gameId/invites
POST   /v1/games/:gameId/access-requests
POST   /v1/games/:gameId/access-requests/:requestId/approve
POST   /v1/games/:gameId/access-requests/:requestId/reject
POST   /v1/games/:gameId/access-requests/approve-all
POST   /v1/games/:gameId/participants
PATCH  /v1/games/:gameId/participants/:participantId/payment
POST   /v1/games/:gameId/participants/:participantId/leave
DELETE /v1/games/:gameId/participants/:participantId
POST   /v1/games/:gameId/team-balance
GET    /v1/groups/:groupId/statistics
GET    /v1/me/notifications
POST   /v1/me/notifications/:notificationId/dismiss
POST   /v1/me/notifications/dismiss-all
~~~

Group join accepts a code and role. Admin mode also requires the current group passcode. Game lookup returns public game information only and must not expose the group player directory to a guest.

## Temporary local-code convention

These formats exist only in the current local-storage prototype. They are not production-safe tokens and must not expose real IDs after backend implementation.

| Use | Local prototype | Production |
|---|---|---|
| Join a group as participant | PUG-<groupId> | random invite token or hashed group code |
| Invite a group admin | PUA-ADMIN-<groupId> | random invite token plus group passcode |
| Open a specific game | PUG-GAME-<groupId>-<gameId> | random invite token or hashed game code |

The frontend currently accepts a code only when it matches an existing local/seeded group or game. The backend will verify hash, expiry, revocation, use limits, and caller permissions.

## Permission response for the frontend

Return calculated permissions; the frontend must not infer authorization from IDs or UI state.

~~~json
{
  "game": { "id": "uuid", "location": "Court 3", "status": "active" },
  "viewerAccess": {
    "kind": "guest",
    "status": "pending",
    "canViewDetails": true,
    "canViewGroupPlayers": false,
    "canJoin": false,
    "canLeave": false,
    "canUpdateOwnPayment": false
  }
}
~~~

After approval, canJoin and canLeave become true while canViewGroupPlayers remains false.

## Security and implementation notes

- Use UUIDs and cryptographically random tokens; never expose sequential database IDs.
- Store passcodes and tokens only with Argon2id (preferred) or bcrypt hashes.
- Enforce authorization on the server, never only in the frontend.
- Support invitation expiry, revocation, and usage limits.
- Record the admin who approved or rejected each request.
- Use transactions for joins, leaves, waiting-list promotion, payment state, and auto-cancellation.
- If Postgres is directly exposed, apply row-level security. With a dedicated API, keep the same rules in the service layer.

---

## Complemento em português

Este documento fica em inglês como referência principal de implementação. Resumo das decisões:

- Cada pessoa terá um perfil com **nome, e-mail e código de acesso** enviado por e-mail; o código pode ser regenerado.
- Uma pessoa pode ser admin de um grupo e somente participante de outro. Admin não é um papel global.
- Participante de um grupo entra no jogo com o próprio perfil, sem aprovação. Se estiver cheio, entra na lista de espera.
- Guest recebe acesso apenas ao jogo convidado: solicita entrada com o nome, fica pendente e só usa as ações do jogo após aprovação de um admin.
- A pessoa pode sair apenas da própria entrada; admin remove outras pessoas pelo gerenciamento.
- Nomes não podem repetir dentro de um grupo nem de uma lista ativa de jogo.
- O balanceamento manual exige pelo menos dois jogadores pagos da lista principal; com lista cheia e todos pagos, os times são gerados automaticamente. Jogadores não pagos e da lista de espera não entram no cálculo. Novo balanceamento deve mudar a composição quando existir alternativa justa, e não apenas trocar os times de lado.
- Jogos finalizados são somente leitura para admins e participantes; a API pode exibir o último snapshot válido dos times.
- O protótipo usa códigos locais previsíveis apenas para teste; o backend deverá usar tokens aleatórios hasheados.
