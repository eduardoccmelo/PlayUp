-- Development data mirrored from PlayUp/src/dev/seeds.ts.
-- This file runs only when PostgreSQL initializes an empty data directory.

INSERT INTO users (id, display_name, email, email_verified_at, access_code_hash)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'PlayUp Seed Admin',
  'seed-admin@playup.local',
  now(),
  'seed-development-only'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO groups (
  id, public_slug, name, join_code_hash, join_code_prefix,
  organizer_passcode_hash, timezone, created_by_user_id
)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'seed-dev', 'Test Group',
   encode(digest('seed-group-test', 'sha256'), 'hex'), 'seed-group',
   'seed-development-only', 'Europe/Lisbon', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002', 'city-night-7f3a', 'City Night Football',
   encode(digest('seed-group-city-night', 'sha256'), 'hex'), 'seed-city',
   'seed-development-only', 'Europe/Lisbon', '00000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', 'weekend-friends-b9c2', 'Weekend Friends',
   encode(digest('seed-group-weekend', 'sha256'), 'hex'), 'seed-weekend',
   'seed-development-only', 'Europe/Lisbon', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (public_slug) DO NOTHING;

INSERT INTO group_memberships (group_id, user_id, role)
SELECT id, '00000000-0000-0000-0000-000000000001', 'admin'
FROM groups
WHERE public_slug IN ('seed-dev', 'city-night-7f3a', 'weekend-friends-b9c2')
  AND NOT EXISTS (
    SELECT 1 FROM group_memberships membership
    WHERE membership.group_id = groups.id
      AND membership.user_id = '00000000-0000-0000-0000-000000000001'
      AND membership.left_at IS NULL
  );

INSERT INTO player_profiles (
  id, group_id, display_name, level, mobility, condition, field_position, legacy_ref
)
SELECT seed.id::uuid, groups.id, seed.display_name, seed.level, seed.mobility::player_mobility,
       seed.condition::player_condition, seed.field_position::player_position, seed.legacy_ref
FROM (VALUES
  ('20000000-0000-0000-0000-000000000001', 'seed-dev', 'Alex Morgan', 5, 'rapido', 'boa', 'ataque', '1'),
  ('20000000-0000-0000-0000-000000000002', 'seed-dev', 'Ben Carter', 4, 'neutro', 'boa', 'defesa', '2'),
  ('20000000-0000-0000-0000-000000000003', 'seed-dev', 'Charlie Adams', 3, 'rapido', 'neutro', 'neutro', '3'),
  ('20000000-0000-0000-0000-000000000004', 'seed-dev', 'Daniel Reed', 2, 'lento', 'ruim', 'defesa', '4'),
  ('20000000-0000-0000-0000-000000000005', 'seed-dev', 'Ethan Walker', 4, 'rapido', 'neutro', 'ataque', '5'),
  ('20000000-0000-0000-0000-000000000006', 'seed-dev', 'Finn Murphy', 3, 'neutro', 'boa', 'neutro', '6'),
  ('20000000-0000-0000-0000-000000000007', 'seed-dev', 'George Clark', 5, 'neutro', 'ruim', 'goleiro', '7'),
  ('20000000-0000-0000-0000-000000000008', 'seed-dev', 'Henry Lewis', 1, 'lento', 'neutro', 'goleiro', '8'),
  ('20000000-0000-0000-0000-000000000009', 'seed-dev', 'Isaac Hill', 2, 'neutro', 'boa', 'ataque', '9'),
  ('20000000-0000-0000-0000-000000000010', 'seed-dev', 'Jack Turner', 5, 'rapido', 'boa', 'ataque', '10'),
  ('20000000-0000-0000-0000-000000000011', 'seed-dev', 'Liam Scott', 3, 'lento', 'boa', 'defesa', '11'),
  ('20000000-0000-0000-0000-000000000012', 'seed-dev', 'Mason Young', 4, 'lento', 'neutro', 'neutro', '12'),
  ('20000000-0000-0000-0000-000000000013', 'seed-dev', 'Noah Brooks', 2, 'rapido', 'ruim', 'defesa', '13'),
  ('20000000-0000-0000-0000-000000000014', 'seed-dev', 'Oliver Price', 3, 'neutro', 'neutro', 'ataque', '14'),
  ('20000000-0000-0000-0000-000000000015', 'seed-dev', 'Owen Taylor', 1, 'lento', 'ruim', 'neutro', '15'),
  ('20000000-0000-0000-0000-000000000101', 'city-night-7f3a', 'Bruno Silva', 4, 'rapido', 'boa', 'ataque', '101'),
  ('20000000-0000-0000-0000-000000000102', 'city-night-7f3a', 'Camila Rocha', 3, 'neutro', 'boa', 'defesa', '102'),
  ('20000000-0000-0000-0000-000000000103', 'city-night-7f3a', 'Diego Lima', 5, 'rapido', 'neutro', 'goleiro', '103'),
  ('20000000-0000-0000-0000-000000000104', 'city-night-7f3a', 'Fernanda Alves', 2, 'lento', 'ruim', 'defesa', '104'),
  ('20000000-0000-0000-0000-000000000105', 'city-night-7f3a', 'Gabriel Costa', 4, 'neutro', 'boa', 'ataque', '105'),
  ('20000000-0000-0000-0000-000000000106', 'city-night-7f3a', 'Helena Souza', 3, 'rapido', 'neutro', 'neutro', '106'),
  ('20000000-0000-0000-0000-000000000201', 'weekend-friends-b9c2', 'Igor Nunes', 1, 'lento', 'ruim', 'goleiro', '201'),
  ('20000000-0000-0000-0000-000000000202', 'weekend-friends-b9c2', 'Juliana Freitas', 5, 'rapido', 'boa', 'ataque', '202'),
  ('20000000-0000-0000-0000-000000000203', 'weekend-friends-b9c2', 'Kai Mendes', 3, 'neutro', 'neutro', 'defesa', '203'),
  ('20000000-0000-0000-0000-000000000204', 'weekend-friends-b9c2', 'Larissa Melo', 4, 'rapido', 'boa', 'defesa', '204'),
  ('20000000-0000-0000-0000-000000000205', 'weekend-friends-b9c2', 'Marcos Vinicius', 2, 'neutro', 'neutro', 'ataque', '205'),
  ('20000000-0000-0000-0000-000000000206', 'weekend-friends-b9c2', 'Nina Prado', 3, 'lento', 'boa', 'neutro', '206')
) AS seed(id, public_slug, display_name, level, mobility, condition, field_position, legacy_ref)
JOIN groups ON groups.public_slug = seed.public_slug
ON CONFLICT (id) DO NOTHING;

INSERT INTO games (
  id, group_id, public_slug, join_code_hash, join_code_prefix,
  game_date, start_time, end_time, duration_minutes, starts_at, ends_at,
  location, court_number, court_cost_cents, currency, max_players, min_players,
  auto_cancellation_hours, status, payment_info, player_notice, legacy_ref, created_by_user_id
)
VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'seed-dev-game-1', encode(digest('seed-game-1', 'sha256'), 'hex'), 'seed-game', current_date - 7, '19:00', '20:15', 75, ((current_date - 7) + time '19:00') AT TIME ZONE 'Europe/Lisbon', (((current_date - 7) + time '19:00') AT TIME ZONE 'Europe/Lisbon') + interval '75 minutes', 'Riverside Arena', '1', 12000, 'EUR', 12, NULL, 2, 'finished', 'Bank transfer', 'Finished test game', '1', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'seed-dev-game-2', encode(digest('seed-game-2', 'sha256'), 'hex'), 'seed-game', current_date + 1, '19:30', '20:45', 75, ((current_date + 1) + time '19:30') AT TIME ZONE 'Europe/Lisbon', (((current_date + 1) + time '19:30') AT TIME ZONE 'Europe/Lisbon') + interval '75 minutes', 'Riverside Arena', '2', 12000, 'EUR', 12, 10, 2, 'active', 'Bank transfer', 'Please arrive 15 minutes early', '2', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'seed-dev-game-3', encode(digest('seed-game-3', 'sha256'), 'hex'), 'seed-game', current_date + 365, '18:00', '19:30', 90, ((current_date + 365) + time '18:00') AT TIME ZONE 'Europe/Lisbon', (((current_date + 365) + time '18:00') AT TIME ZONE 'Europe/Lisbon') + interval '90 minutes', 'PlayUp Sports Club', 'A', 15000, 'EUR', 14, NULL, 2, 'active', 'Bank transfer', 'Please confirm your attendance early', '3', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'city-night-game-201', encode(digest('seed-game-201', 'sha256'), 'hex'), 'seed-game', current_date + 2, '20:00', '21:15', 75, ((current_date + 2) + time '20:00') AT TIME ZONE 'Europe/Lisbon', (((current_date + 2) + time '20:00') AT TIME ZONE 'Europe/Lisbon') + interval '75 minutes', 'Urban Sports Center', 'B', 10000, 'EUR', 6, 4, 2, 'active', 'Pix ou transferência', 'Dados de demonstração', '201', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'city-night-game-202', encode(digest('seed-game-202', 'sha256'), 'hex'), 'seed-game', current_date + 6, '20:00', '21:15', 75, ((current_date + 6) + time '20:00') AT TIME ZONE 'Europe/Lisbon', (((current_date + 6) + time '20:00') AT TIME ZONE 'Europe/Lisbon') + interval '75 minutes', 'Urban Sports Center', 'A', 10000, 'EUR', 6, 4, 2, 'active', 'Pix ou transferência', 'Dados de demonstração', '202', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'weekend-friends-game-301', encode(digest('seed-game-301', 'sha256'), 'hex'), 'seed-game', current_date + 3, '20:00', '21:15', 75, ((current_date + 3) + time '20:00') AT TIME ZONE 'Europe/Lisbon', (((current_date + 3) + time '20:00') AT TIME ZONE 'Europe/Lisbon') + interval '75 minutes', 'Green Field Club', '3', 10000, 'EUR', 6, 4, 2, 'active', 'Pix ou transferência', 'Dados de demonstração', '301', '00000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003', 'weekend-friends-game-302', encode(digest('seed-game-302', 'sha256'), 'hex'), 'seed-game', current_date + 9, '20:00', '21:15', 75, ((current_date + 9) + time '20:00') AT TIME ZONE 'Europe/Lisbon', (((current_date + 9) + time '20:00') AT TIME ZONE 'Europe/Lisbon') + interval '75 minutes', 'Green Field Club', '1', 10000, 'EUR', 6, 4, 2, 'active', 'Pix ou transferência', 'Dados de demonstração', '302', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Positions are stored, contiguous and 0-based, and paid players come
-- first within the roster - the same invariants the backend maintains.
WITH selected(legacy_ref, status, list_position, paid) AS (
  VALUES
  ('1', 'confirmed', 0, true),
  ('2', 'confirmed', 1, true),
  ('3', 'confirmed', 2, true),
  ('4', 'confirmed', 3, true),
  ('5', 'confirmed', 4, true),
  ('6', 'confirmed', 5, true),
  ('7', 'confirmed', 6, true),
  ('8', 'confirmed', 7, true),
  ('9', 'confirmed', 8, true),
  ('10', 'confirmed', 9, true),
  ('11', 'confirmed', 10, true),
  ('12', 'confirmed', 11, true)
)
INSERT INTO game_participants (game_id, player_id, display_name_snapshot, status, list_position, paid_at)
SELECT '30000000-0000-0000-0000-000000000001', p.id, p.display_name, s.status::participant_status, s.list_position,
       CASE WHEN s.paid THEN now() END
FROM selected s
JOIN player_profiles p
  ON p.legacy_ref = s.legacy_ref AND p.group_id = '10000000-0000-0000-0000-000000000001'
ON CONFLICT (game_id, player_id) DO NOTHING;

WITH selected(legacy_ref, status, list_position, paid) AS (
  VALUES
  ('1', 'confirmed', 0, true),
  ('2', 'confirmed', 1, true),
  ('3', 'confirmed', 2, true),
  ('4', 'confirmed', 3, true),
  ('5', 'confirmed', 4, true),
  ('6', 'confirmed', 5, true),
  ('7', 'confirmed', 6, true),
  ('8', 'confirmed', 7, true),
  ('9', 'confirmed', 8, false),
  ('10', 'confirmed', 9, false),
  ('11', 'waiting_list', 0, false),
  ('12', 'waiting_list', 1, false)
)
INSERT INTO game_participants (game_id, player_id, display_name_snapshot, status, list_position, paid_at)
SELECT '30000000-0000-0000-0000-000000000002', p.id, p.display_name, s.status::participant_status, s.list_position,
       CASE WHEN s.paid THEN now() END
FROM selected s
JOIN player_profiles p
  ON p.legacy_ref = s.legacy_ref AND p.group_id = '10000000-0000-0000-0000-000000000001'
ON CONFLICT (game_id, player_id) DO NOTHING;

WITH selected(legacy_ref, status, list_position, paid) AS (
  VALUES
  ('1', 'confirmed', 0, true),
  ('2', 'confirmed', 1, true),
  ('3', 'confirmed', 2, true),
  ('4', 'confirmed', 3, true),
  ('5', 'confirmed', 4, false),
  ('6', 'confirmed', 5, false)
)
INSERT INTO game_participants (game_id, player_id, display_name_snapshot, status, list_position, paid_at)
SELECT '30000000-0000-0000-0000-000000000003', p.id, p.display_name, s.status::participant_status, s.list_position,
       CASE WHEN s.paid THEN now() END
FROM selected s
JOIN player_profiles p
  ON p.legacy_ref = s.legacy_ref AND p.group_id = '10000000-0000-0000-0000-000000000001'
ON CONFLICT (game_id, player_id) DO NOTHING;

WITH demo(game_id, group_id, refs, wait_refs) AS (
  VALUES
    ('30000000-0000-0000-0000-000000000004'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, ARRAY['101','102','103','104'], ARRAY['105']),
    ('30000000-0000-0000-0000-000000000005'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, ARRAY['101','103','105','106'], ARRAY[]::text[]),
    ('30000000-0000-0000-0000-000000000006'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, ARRAY['201','202','203','204','205','206'], ARRAY[]::text[]),
    ('30000000-0000-0000-0000-000000000007'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, ARRAY['202','204','206'], ARRAY[]::text[])
)
INSERT INTO game_participants (game_id, player_id, display_name_snapshot, status, list_position, paid_at)
SELECT d.game_id, p.id, p.display_name, 'confirmed', row_number() OVER (PARTITION BY d.game_id ORDER BY array_position(d.refs, p.legacy_ref)) - 1,
       CASE WHEN array_position(d.refs, p.legacy_ref) < cardinality(d.refs) THEN now() END
FROM demo d JOIN player_profiles p ON p.group_id = d.group_id AND p.legacy_ref = ANY(d.refs)
ON CONFLICT (game_id, player_id) DO NOTHING;

WITH demo(game_id, group_id, refs) AS (
  VALUES ('30000000-0000-0000-0000-000000000004'::uuid, '10000000-0000-0000-0000-000000000002'::uuid, ARRAY['105'])
)
INSERT INTO game_participants (game_id, player_id, display_name_snapshot, status, list_position)
SELECT d.game_id, p.id, p.display_name, 'waiting_list', 0
FROM demo d JOIN player_profiles p ON p.group_id = d.group_id AND p.legacy_ref = ANY(d.refs)
ON CONFLICT (game_id, player_id) DO NOTHING;
