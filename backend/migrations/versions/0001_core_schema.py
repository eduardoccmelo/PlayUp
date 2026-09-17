"""Create the PlayUp core schema.

This migration is the single source of truth for the PostgreSQL schema:
extensions, enum types, tables, CHECK constraints, partial indexes, the
deferrable list-order constraint, and the game_summary view.

Revision ID: 0001_core_schema
Revises:
"""

from alembic import op

revision = "0001_core_schema"
down_revision = None
branch_labels = None
depends_on = None


EXTENSIONS = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
"""

ENUMS = """
CREATE TYPE group_role AS ENUM ('admin', 'participant');
CREATE TYPE game_status AS ENUM ('active', 'cancelled', 'finished', 'deleted');
CREATE TYPE cancel_reason AS ENUM ('manual', 'min_players');
CREATE TYPE player_mobility AS ENUM ('rapido', 'neutro', 'lento');
CREATE TYPE player_condition AS ENUM ('boa', 'neutro', 'ruim');
CREATE TYPE player_position AS ENUM ('goleiro', 'defesa', 'ataque', 'neutro');
CREATE TYPE currency_code AS ENUM ('EUR', 'USD', 'GBP', 'BRL');
CREATE TYPE participant_status AS ENUM ('confirmed', 'waiting_list', 'left', 'removed');
CREATE TYPE team_side AS ENUM ('A', 'B');
CREATE TYPE request_kind AS ENUM ('join', 'leave', 'payment');
CREATE TYPE access_source AS ENUM ('invite', 'manual_code', 'admin_added');
CREATE TYPE access_status AS ENUM ('pending', 'approved', 'rejected', 'revoked');
CREATE TYPE invite_type AS ENUM ('group_admin', 'group_participant', 'game_guest');
CREATE TYPE notification_type AS ENUM (
  'game_access_requested', 'player_joined', 'player_left',
  'payment_status_changed', 'waiting_list_promoted', 'game_cancelled'
);
"""

TABLES = """
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL
    CONSTRAINT users_display_name_length_check
    CHECK (char_length(trim(display_name)) BETWEEN 1 AND 80),
  display_name_normalized text GENERATED ALWAYS AS
    (lower(regexp_replace(trim(display_name), '[[:space:]]+', ' ', 'g'))) STORED,
  email citext NOT NULL UNIQUE,
  email_verified_at timestamptz,
  access_code_hash text NOT NULL,
  access_code_updated_at timestamptz NOT NULL DEFAULT now(),
  is_staff boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  device_label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_sessions_active_idx ON user_sessions(user_id) WHERE revoked_at IS NULL;

CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_slug text NOT NULL UNIQUE,
  name text NOT NULL
    CONSTRAINT groups_name_length_check
    CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
  join_code_hash text NOT NULL UNIQUE,
  join_code_prefix text NOT NULL,
  organizer_passcode_hash text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Lisbon',
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);
CREATE INDEX groups_join_code_prefix_idx ON groups(join_code_prefix);

CREATE TABLE group_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role group_role NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz
);
CREATE UNIQUE INDEX group_memberships_one_active_idx
  ON group_memberships(group_id, user_id) WHERE left_at IS NULL;
CREATE INDEX group_memberships_user_active_idx
  ON group_memberships(user_id, group_id) WHERE left_at IS NULL;

CREATE TABLE player_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  owner_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name text NOT NULL
    CONSTRAINT player_profiles_display_name_length_check
    CHECK (char_length(trim(display_name)) BETWEEN 1 AND 80),
  display_name_normalized text GENERATED ALWAYS AS
    (lower(regexp_replace(trim(display_name), '[[:space:]]+', ' ', 'g'))) STORED,
  level smallint
    CONSTRAINT player_profiles_level_range_check CHECK (level BETWEEN 1 AND 5),
  mobility player_mobility NOT NULL DEFAULT 'neutro',
  condition player_condition NOT NULL DEFAULT 'neutro',
  field_position player_position NOT NULL DEFAULT 'neutro',
  legacy_ref text,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_profiles_has_an_owner_check
    CHECK (group_id IS NOT NULL OR owner_user_id IS NOT NULL)
);
CREATE UNIQUE INDEX player_profiles_group_name_idx
  ON player_profiles(group_id, display_name_normalized)
  WHERE group_id IS NOT NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX player_profiles_one_owned_per_group_idx
  ON player_profiles(group_id, owner_user_id)
  WHERE group_id IS NOT NULL AND owner_user_id IS NOT NULL;
CREATE UNIQUE INDEX player_profiles_legacy_ref_idx
  ON player_profiles(group_id, legacy_ref) WHERE legacy_ref IS NOT NULL;

CREATE TABLE games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  public_slug text NOT NULL UNIQUE,
  join_code_hash text NOT NULL UNIQUE,
  join_code_prefix text NOT NULL,
  game_date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  duration_minutes integer NOT NULL
    CONSTRAINT games_duration_positive_check CHECK (duration_minutes > 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  location text NOT NULL DEFAULT '',
  court_number text NOT NULL DEFAULT '',
  court_cost_cents integer NOT NULL DEFAULT 0
    CONSTRAINT games_cost_not_negative_check CHECK (court_cost_cents >= 0),
  currency currency_code NOT NULL DEFAULT 'EUR',
  max_players integer NOT NULL
    CONSTRAINT games_max_players_min_two_check CHECK (max_players >= 2),
  min_players integer
    CONSTRAINT games_min_players_min_two_check
    CHECK (min_players IS NULL OR min_players >= 2),
  auto_cancellation_hours integer
    CONSTRAINT games_auto_cancellation_positive_check
    CHECK (auto_cancellation_hours IS NULL OR auto_cancellation_hours > 0),
  status game_status NOT NULL DEFAULT 'active',
  cancelled_at timestamptz,
  cancel_reason cancel_reason,
  payment_info text NOT NULL DEFAULT '',
  player_notice text NOT NULL DEFAULT '',
  teams_drawn_at timestamptz,
  team_a_score numeric(5,2),
  team_b_score numeric(5,2),
  legacy_ref text,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT games_min_le_max_check
    CHECK (min_players IS NULL OR min_players <= max_players),
  CONSTRAINT games_cancelled_at_matches_check
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  CONSTRAINT games_cancel_reason_requires_cancel_check
    CHECK (cancel_reason IS NULL OR status = 'cancelled'),
  CONSTRAINT games_scores_require_draw_check
    CHECK ((teams_drawn_at IS NULL)
           OR (team_a_score IS NOT NULL AND team_b_score IS NOT NULL))
);
CREATE INDEX games_group_start_idx ON games(group_id, game_date, start_time);
CREATE INDEX games_group_active_idx ON games(group_id, starts_at) WHERE status = 'active';
CREATE INDEX games_starts_at_idx ON games(starts_at) WHERE status = 'active';
CREATE INDEX games_join_code_prefix_idx ON games(join_code_prefix);
CREATE UNIQUE INDEX games_legacy_ref_idx
  ON games(group_id, legacy_ref) WHERE legacy_ref IS NOT NULL;

CREATE TABLE game_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES player_profiles(id) ON DELETE RESTRICT,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  display_name_snapshot text NOT NULL
    CONSTRAINT game_participants_display_name_length_check
    CHECK (char_length(trim(display_name_snapshot)) BETWEEN 1 AND 80),
  display_name_normalized text GENERATED ALWAYS AS
    (lower(regexp_replace(trim(display_name_snapshot), '[[:space:]]+', ' ', 'g'))) STORED,
  status participant_status NOT NULL,
  list_position integer
    CONSTRAINT game_participants_list_position_not_negative_check
    CHECK (list_position >= 0),
  paid_at timestamptz,
  team team_side,
  level_at_draw smallint
    CONSTRAINT game_participants_level_at_draw_range_check
    CHECK (level_at_draw BETWEEN 1 AND 5),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_participants_one_per_player UNIQUE (game_id, player_id),
  CONSTRAINT game_participants_list_order UNIQUE (game_id, status, list_position)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT game_participants_position_matches_status_check
    CHECK ((status IN ('confirmed', 'waiting_list')) = (list_position IS NOT NULL)),
  CONSTRAINT game_participants_left_at_matches_status_check
    CHECK ((status IN ('left', 'removed')) = (left_at IS NOT NULL)),
  CONSTRAINT game_participants_team_requires_confirmed_check
    CHECK (team IS NULL OR status = 'confirmed')
);
CREATE INDEX game_participants_game_status_idx
  ON game_participants(game_id, status, list_position);
CREATE UNIQUE INDEX game_participants_active_name_idx
  ON game_participants(game_id, display_name_normalized)
  WHERE status IN ('confirmed', 'waiting_list');

CREATE TABLE game_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  kind request_kind NOT NULL DEFAULT 'join',
  source access_source NOT NULL,
  status access_status NOT NULL DEFAULT 'pending',
  requested_name text NOT NULL
    CONSTRAINT game_access_requests_requested_name_length_check
    CHECK (char_length(trim(requested_name)) BETWEEN 1 AND 80),
  requested_name_normalized text GENERATED ALWAYS AS
    (lower(regexp_replace(trim(requested_name), '[[:space:]]+', ' ', 'g'))) STORED,
  payment_confirmed boolean NOT NULL DEFAULT false,
  resolved_player_id uuid REFERENCES player_profiles(id) ON DELETE SET NULL,
  reviewed_by_user_id uuid REFERENCES users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_access_requests_reviewed_at_matches_check
    CHECK ((status = 'pending') = (reviewed_at IS NULL)),
  CONSTRAINT game_access_requests_non_join_needs_game_check
    CHECK (kind = 'join' OR game_id IS NOT NULL)
);
CREATE UNIQUE INDEX game_access_requests_open_user_idx
  ON game_access_requests(game_id, user_id, kind)
  WHERE status = 'pending' AND game_id IS NOT NULL AND user_id IS NOT NULL;
CREATE UNIQUE INDEX game_access_requests_open_name_idx
  ON game_access_requests(group_id, requested_name_normalized, kind)
  WHERE status = 'pending';
CREATE INDEX game_access_requests_user_idx
  ON game_access_requests(user_id, status, created_at DESC);
CREATE INDEX game_access_requests_pending_group_idx
  ON game_access_requests(group_id, created_at) WHERE status = 'pending';

CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  type invite_type NOT NULL,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz,
  max_uses integer
    CONSTRAINT invites_max_uses_positive_check CHECK (max_uses IS NULL OR max_uses > 0),
  use_count integer NOT NULL DEFAULT 0
    CONSTRAINT invites_use_count_not_negative_check CHECK (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invites_use_count_within_max_check
    CHECK (max_uses IS NULL OR use_count <= max_uses),
  CONSTRAINT invites_target_matches_type_check
    CHECK ((type IN ('group_admin', 'group_participant')
            AND group_id IS NOT NULL AND game_id IS NULL)
           OR (type = 'game_guest' AND game_id IS NOT NULL AND group_id IS NULL))
);
CREATE INDEX invites_token_prefix_idx ON invites(token_prefix);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  game_id uuid REFERENCES games(id) ON DELETE CASCADE,
  request_id uuid REFERENCES game_access_requests(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  player_id uuid REFERENCES player_profiles(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_group_created_idx ON notifications(group_id, created_at DESC);

CREATE TABLE notification_recipients (
  notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dismissed_at timestamptz,
  PRIMARY KEY (notification_id, user_id)
);
CREATE INDEX notification_recipients_open_idx
  ON notification_recipients(user_id) WHERE dismissed_at IS NULL;
"""

VIEW = """
CREATE VIEW game_summary AS
SELECT g.id AS game_id,
       g.group_id,
       count(*) FILTER (WHERE p.status = 'confirmed') AS confirmed_count,
       count(*) FILTER (WHERE p.status = 'waiting_list') AS waiting_count,
       count(*) FILTER (WHERE p.status = 'confirmed' AND p.paid_at IS NOT NULL) AS paid_count,
       CASE WHEN count(*) FILTER (WHERE p.status = 'confirmed') > 0
            THEN g.court_cost_cents::numeric
                 / count(*) FILTER (WHERE p.status = 'confirmed')
            ELSE g.court_cost_cents::numeric END AS price_per_player_cents,
       g.ends_at <= now() AS has_ended,
       g.ends_at > now() - interval '24 hours' AS visible_to_participants
FROM games g
LEFT JOIN game_participants p ON p.game_id = g.id
GROUP BY g.id;
"""

DROP = """
DROP VIEW IF EXISTS game_summary;
DROP TABLE IF EXISTS notification_recipients;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS invites;
DROP TABLE IF EXISTS game_access_requests;
DROP TABLE IF EXISTS game_participants;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS player_profiles;
DROP TABLE IF EXISTS group_memberships;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;
DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS invite_type;
DROP TYPE IF EXISTS access_status;
DROP TYPE IF EXISTS access_source;
DROP TYPE IF EXISTS request_kind;
DROP TYPE IF EXISTS team_side;
DROP TYPE IF EXISTS participant_status;
DROP TYPE IF EXISTS currency_code;
DROP TYPE IF EXISTS player_position;
DROP TYPE IF EXISTS player_condition;
DROP TYPE IF EXISTS player_mobility;
DROP TYPE IF EXISTS cancel_reason;
DROP TYPE IF EXISTS game_status;
DROP TYPE IF EXISTS group_role;
"""


def upgrade() -> None:
    op.execute(EXTENSIONS)
    op.execute(ENUMS)
    op.execute(TABLES)
    op.execute(VIEW)


def downgrade() -> None:
    op.execute(DROP)
