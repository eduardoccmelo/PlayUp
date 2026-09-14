# PlayUp — backend specification

**Portuguese companion:** a concise Portuguese summary is included at the end. English is the source of truth for implementation decisions.

## Scope

This document specifies a relational backend for the current PlayUp flow:

- one profile can be an admin in one group and a participant in another;
- a group participant may create and organize an individual game without becoming an admin of that group;
- group invitations for admins and participants, plus manual group-code entry;
- game invitations and manual game-code entry;
- guests who can access only a specific game;
- game-only access, waiting lists, payment state, and self-removal;
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
| game organizer | The game creator. A group admin organizes every game; a participant organizes only games they created. |
| guest | Not a group member; may access one invited game only. |
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

create type group_role as enum ('owner', 'admin', 'participant');
create type game_status as enum ('active', 'cancelled', 'finished', 'deleted');
create type game_access_source as enum ('invite', 'manual_code');
create type game_access_status as enum ('active', 'revoked');
create type game_participant_status as enum (
  'confirmed', 'waiting_list', 'left', 'removed'
);
create type invite_type as enum ('group_admin', 'group_participant', 'game_guest');
create type game_creator_role as enum ('admin', 'participant');
create type team_balance_trigger as enum ('automatic', 'organizer', 'late_rebalance');
create type notification_type as enum (
  'player_joined', 'player_left', 'payment_status_changed'
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

~~~sql
create table email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  code_hash text not null,
  purpose text not null check (purpose in ('sign_up', 'sign_in', 'change_email', 'invite_acceptance')),
  invite_id uuid null,
  expires_at timestamptz not null,
  consumed_at timestamptz null,
  created_at timestamptz not null default now()
);
~~~

Each verification code is single-use and expires after five minutes. The invite itself may remain active indefinitely; the token proves control of the email for that one acceptance. Session tokens and verification codes are accepted or returned only in dedicated flows; the database stores hashes only. Display names may repeat between users, but uniqueness within a group and an active game list is mandatory.

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
create unique index group_memberships_one_active_owner_idx
  on group_memberships(group_id) where role = 'owner' and left_at is null;
create index group_memberships_user_active_idx
  on group_memberships(user_id, group_id) where left_at is null;
~~~

Every group has exactly one active `owner`; additional administrators use role `admin`. The owner is the creator-level role: only that user may delete the group or change its passcode. An admin may rename the group but cannot remove/demote the owner. When an owner leaves, transfer the sole owner role transactionally to the most active remaining member (confirmed participations), then the oldest active membership on a tie. Reject the leave when no successor exists.

Use Argon2id (preferred) or bcrypt for group codes and organizer passcodes. A short, non-sensitive prefix narrows candidates before comparing hashes.

### Player profiles

~~~sql
create table player_profiles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid null references groups(id) on delete cascade,
  owner_user_id uuid null references users(id) on delete set null,
  created_by_user_id uuid null references users(id) on delete set null,
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

Group profiles may exist without an account. `is_guest = true` identifies a manually created/admin-managed **Guest** with no linked user account; the UI must label it `Convidado`/`Guest`. `created_by_user_id` records the user accountable for that manual creation. When a user joins a group, the service creates or links one owned profile in that group; Join then uses it automatically. A verified user who enters by game code receives or reuses an owned profile with game-only access and cannot browse the group directory; it is not a manual Guest.

### Admin skill voting

Level and mobility are group-wide, governed attributes. Store each admin ballot separately; never let a client overwrite the aggregate without recording the vote.

~~~sql
create type player_skill_attribute as enum ('level', 'mobility');

create table player_skill_votes (
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null references player_profiles(id) on delete cascade,
  admin_user_id uuid not null references users(id) on delete cascade,
  attribute player_skill_attribute not null,
  value smallint not null,
  updated_at timestamptz not null default now(),
  primary key (group_id, player_id, admin_user_id, attribute),
  check (
    (attribute = 'level' and value between 1 and 5)
    or (attribute = 'mobility' and value between 1 and 3)
  )
);
~~~

Only active admins may vote. An admin cannot read, write, or manually override their own `level` or `mobility`; they may still edit their own position and condition. Votes remain open indefinitely: every valid vote immediately recomputes the average over submitted ballots, rounded half-up, and updates the group player profile. Missing/admin-absent ballots never block team balancing. A later vote changes the aggregate immediately and leaves an audit trail through `updated_at` (or a separate append-only audit table in production).

When an active admin manually creates a player, persist `created_by_user_id` and insert that creator's initial level and mobility ballots in the same transaction. A manual player created by a non-admin for a game-only roster remains a guest for that game and must not create a group-wide ballot.

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
  balance_window_starts_at timestamptz not null,
  balance_window_ends_at timestamptz not null,
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
  created_by_role game_creator_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_players is null or min_players <= max_players),
  check (balance_window_starts_at < balance_window_ends_at)
);

create index games_group_active_idx
  on games(group_id, starts_at) where status = 'active';
create index games_join_code_prefix_idx on games(join_code_prefix);

create table game_schedule_changes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  previous_starts_at timestamptz not null,
  current_starts_at timestamptz not null,
  changed_by_user_id uuid not null references users(id),
  changed_at timestamptz not null default now(),
  check (previous_starts_at <> current_starts_at)
);

create index game_schedule_changes_game_idx
  on game_schedule_changes(game_id, changed_at desc);

create table user_game_accesses (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  source game_access_source not null,
  status game_access_status not null default 'active',
  requested_player_name text not null check (char_length(requested_player_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create index user_game_accesses_user_idx
  on user_game_accesses(user_id, status, created_at desc);
~~~

This table powers My next games for people who are not group members. Group members derive access from active membership. A verified game invite/code creates or reuses a game-only profile, immediately adds that profile to the main list or waiting list, and never adds it to the group directory.

`created_by_role` is captured from the creator's active group membership when the game is created. It is not a global user role. An active group admin can manage all group games. An active participant can create a game and is the organizer only of a game where `created_by_user_id` is their user id and `created_by_role = 'participant'`; they do not acquire group-admin powers. A schedule edit must update `games.starts_at` and both balance-window columns while inserting one `game_schedule_changes` row in the same transaction. This preserves who moved the game and whether the latest start is earlier.

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
  trigger_type team_balance_trigger not null,
  triggered_by_user_id uuid null references users(id),
  window_opened_by_schedule_change_id uuid null references game_schedule_changes(id),
  standard_balance_number smallint null check (standard_balance_number between 1 and 2),
  algorithm_version text not null,
  team_a_score numeric(8,2) not null,
  team_b_score numeric(8,2) not null,
  generated_at timestamptz not null default now(),
  invalidated_at timestamptz null,
  check (
    (trigger_type = 'organizer' and triggered_by_user_id is not null and standard_balance_number is not null)
    or (trigger_type = 'automatic' and triggered_by_user_id is null and standard_balance_number is not null)
    or (trigger_type = 'late_rebalance' and triggered_by_user_id is not null and standard_balance_number is null)
  ),
  check (
    window_opened_by_schedule_change_id is null
    or trigger_type = 'late_rebalance'
  )
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

Only paid confirmed participants are eligible for teams; unpaid and waiting-list entries are always excluded. Manual balancing is available from two paid confirmed participants. When the main list reaches `max_players` and every confirmed participant is paid, generate the next available standard balance automatically.

The standard quota is determined by `games.created_by_role`: two standard balances for an admin-created game and one for a participant-created game. Automatic and organizer-triggered balances share that quota. Persist the count even if a roster or payment change invalidates a snapshot. Compare a substitution by its balance signature, not its player ID: `position`, effective level, mobility, and condition. Rebalance only when the multiset of these signatures changes; a different person with an identical signature or any list reorder must neither create a snapshot nor consume quota. On creation, persist `balance_window_starts_at = starts_at - interval '15 minutes'` and `balance_window_ends_at = starts_at`; update both columns atomically when the scheduled date/time is rescheduled. This moves the final window but never resets the standard count or changes existing balance records. Once the standard quota is exhausted, allow exactly one `late_rebalance` record only within the current window; it does not increment the standard count. If the active window came from an earlier start, expose the responsible admin in the availability notice and persist that schedule-change ID in `window_opened_by_schedule_change_id` when the final rebalance is used. The button must be disabled outside that window and after a `late_rebalance` record exists for the game.

Record the triggering user for an organizer-triggered or late rebalance. For admin-created games, expose the latest trigger and standard count to administrators. For participant-created games, the API must not expose admin/player-skill information to the participant organizer. A new snapshot supersedes the active one and must prefer a different comparably fair player split when one exists; merely swapping Team A and Team B is not a new balance.

### Invitations and notifications

~~~sql
create table invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  token_prefix text not null,
  type invite_type not null,
  group_id uuid null references groups(id) on delete cascade,
  game_id uuid null references games(id) on delete cascade,
  target_user_id uuid null references users(id) on delete cascade,
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

An admin-panel promotion invitation is a `group_admin` invite with a non-null `target_user_id`; redeem it only for that active group participant, after email verification and group-passcode confirmation. General admin links may keep `target_user_id` null for the existing shared-link flow.

Every active group admin receives their own recipient row. Dismissing a message affects only that admin. Dismiss all sets `dismissed_at` only for the current admin's recipient rows.

## Mandatory business rules

1. Creating a group creates an active **owner** membership for its creator.
2. Only active group owners/admins may manage the group player directory and statistics, manage any group game, create group-admin invitations, or manage admins. Admins may rename the group; only the active **owner** may change its passcode or delete it after passcode confirmation. Admins may not remove/demote the owner.
3. When an owner leaves, ownership transfers to the active member with the most confirmed game participations; ties are resolved by oldest membership. The owner cannot leave when no eligible successor exists.
4. An active group participant may create a game. They may manage only a game they created (roster, payments, player creation, and balancing), without access to group administration, statistics, player skills, or other games' management.
5. Active group members may invite a guest to a game they can access.
6. A group member joins using their linked profile, without approval. A full game places them in the waiting list.
7. Guests never receive the group directory.
8. A game code/link requires a verified profile and immediately adds its game-only profile to the main list or waiting list. It never grants group membership or group-directory access.
9. A game-only user may update only their own payment and remove only their own entry.
10. Join, leave, and payment changes notify all active group admins.
11. A participant may update only their own payment state, except while acting as organizer of their own game under rule 4.
12. Names are unique, ignoring case and repeated spaces, inside each group and active game list.
13. Changing a group passcode requires the current passcode and does not invalidate existing memberships.
14. Balancing includes only paid confirmed main-list participants. Standard quota: two balances for an admin-created game, one for a participant-created game; automatic and manual balances share it. One final manual rebalance is available only in the 15-minute window before the current scheduled start. A date/time reschedule moves that window atomically, but roster/payment/date/time changes never reset a quota or create an additional final rebalance.
15. Finished games are immutable to both admins and participants except for deletion by the authorized owner. Their API representation is read-only and may include the latest valid team-balance snapshot.
16. Admin skill votes are incremental: each vote recalculates the current level/mobility average; no unanimous or complete quorum is required. A player never votes on or sees their own level/mobility in game-management lists.

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
PATCH  /v1/games/:gameId
DELETE /v1/games/:gameId
POST   /v1/games/lookup
GET    /v1/me/games
POST   /v1/games/:gameId/invites
POST   /v1/games/join-by-code
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

Group join accepts a code and role. Admin mode also requires the current group passcode. `POST /v1/groups/:groupId/games` is available to any active group member and records `created_by_user_id` plus `created_by_role`. `PATCH`/roster/payment/team routes authorize a group admin for any group game, or the creator for their participant-created game. Game lookup returns public game information only and must not expose the group player directory or player skills to a guest or participant organizer.

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
    "kind": "participant_organizer",
    "status": "active",
    "canViewDetails": true,
    "canViewGroupPlayers": false,
    "canViewPlayerSkills": false,
    "canManageGame": true,
    "canEditGroup": false,
    "canJoin": true,
    "canLeave": true,
    "canUpdateOwnPayment": true
  }
}
~~~

For a verified game-only user, `kind` is `guest`, `status` is `active`, `canUpdateOwnPayment` is true, and all group capabilities stay false. For an admin, `canManageGame` and group capabilities are true. For a participant organizer, `canManageGame` is true only on their own game while all group capabilities remain false.

## Security and implementation notes

- Use UUIDs and cryptographically random tokens; never expose sequential database IDs.
- Store passcodes and tokens only with Argon2id (preferred) or bcrypt hashes.
- Enforce authorization on the server, never only in the frontend.
- Keep invitations independently revocable and optionally usage-limited. An invitation may be permanent; only the e-mail verification token expires after five minutes.
- Record the admin who triggered a manual team balance and all payment-status notifications.
- Use transactions for joins, leaves, waiting-list promotion, payment state, and auto-cancellation.
- If Postgres is directly exposed, apply row-level security. With a dedicated API, keep the same rules in the service layer.

---

## Complemento em português

Este documento fica em inglês como referência principal de implementação. Resumo das decisões:

- Cada pessoa terá um perfil com **nome, e-mail e código de acesso** enviado por e-mail. Cada código é de uso único, pode ser regenerado e expira após cinco minutos; ele não é uma senha permanente.
- Uma pessoa pode ser admin de um grupo e somente participante de outro. Admin não é um papel global.
- Participante de um grupo entra no jogo com o próprio perfil, sem aprovação. Se estiver cheio, entra na lista de espera.
- Usuário verificado com acesso somente ao jogo recebe esse escopo ao usar o convite/código do jogo; entra diretamente na lista principal ou de espera e não ganha grupo. Já **Convidado/Guest** é o jogador criado manualmente, sem conta/e-mail, e deve ser identificado na lista.
- A pessoa pode sair apenas da própria entrada; admin remove outras pessoas pelo gerenciamento.
- Nomes não podem repetir dentro de um grupo nem de uma lista ativa de jogo.
- Um participante do grupo pode criar e organizar somente o próprio jogo, sem se tornar admin do grupo. Admin gerencia todos os jogos; organizador participante administra apenas lista, pagamentos, criação de jogadores e times do seu jogo. Atributos técnicos e estatísticas do grupo permanecem ocultos para ele.
- O balanceamento manual exige pelo menos dois jogadores pagos da lista principal; com lista cheia e todos pagos, os times são gerados automaticamente. Jogadores não pagos e da lista de espera não entram no cálculo. Jogos criados por admin permitem duas gerações regulares; jogos criados por participante permitem uma. Automático e manual compartilham esse limite. Depois há somente um rebalanceamento manual final na janela de 15 minutos antes do horário vigente do jogo. Remarcar data ou horário desloca essa janela, mas nunca reinicia a cota nem concede outro rebalanceamento final. A remarcação registra horário anterior, novo horário e admin responsável; quando ela antecipa o início, o aviso e o histórico do rebalanceamento final mostram essa autoria. Em uma substituição, a comparação ignora a ID e usa posição, nível efetivo, velocidade e condição: só não há novo balanceamento quando o multiconjunto dessas assinaturas for igual. Novo balanceamento deve mudar a composição quando existir alternativa justa, e não apenas trocar os times de lado.
- Jogos finalizados são somente leitura para admins e participantes; a API pode exibir o último snapshot válido dos times.
- O protótipo usa códigos locais previsíveis apenas para teste; o backend deverá usar tokens aleatórios hasheados.
