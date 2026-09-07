# PlayUp — especificação de backend

## Objetivo

Este documento descreve um backend relacional para os fluxos atuais do PlayUp:

- admins e participantes em vários grupos;
- convites de grupo para admin ou participante;
- entrada manual por código de grupo;
- convites e entrada manual por código de jogo;
- convidados (*guests*) que só acessam um jogo específico;
- solicitações, aprovações, lista de espera e saída da lista;
- notificações fecháveis por admin.

**Banco recomendado:** PostgreSQL 15+.

Use JSON para o tráfego da API; as relações principais devem ficar em tabelas normalizadas. Isso é essencial para permissões, histórico, notificações e aprovações concorrentes.

---

## Identidade sem e-mail

Não é necessário usar e-mail agora. Na primeira abertura do app, o backend cria um `user` anônimo e devolve uma sessão de longa duração. O app guarda o token com segurança no dispositivo.

```text
Primeira abertura → POST /sessions/anonymous → user + session token
Próximas aberturas → token identifica o mesmo user
```

Limitação assumida: sem login, e-mail ou telefone, o usuário não recupera os grupos/jogos em outro aparelho caso perca o armazenamento local. Mais tarde, uma conta autenticada pode ser vinculada ao mesmo `user_id`, sem alterar o restante do modelo.

---

## Papéis e conceitos

| Conceito | Significado |
|---|---|
| `admin` | Administrador de **um grupo**. Não é um papel global. |
| `participant` | Membro permanente de um grupo, sem poderes administrativos. |
| `guest` | Não pertence ao grupo; pode ter acesso somente a um jogo específico. |
| `player` | Perfil esportivo/nome usado em uma lista de jogo. Não é necessariamente um usuário do app. |

Um usuário pode ser admin no Grupo A, participante no Grupo B e guest no Jogo C.

---

## Modelo de relacionamento

```text
users ──< user_sessions
  │
  ├──< group_memberships >── groups ──< games
  │                                │
  ├──< user_game_accesses >────────┘
  │                                │
  ├──< player_profiles ──< game_participants
  │                                │
  └──< notification_recipients >── notifications

invites ──> groups ou games
```

---

## PostgreSQL DDL

### Extensões e tipos

```sql
create extension if not exists pgcrypto;

create type group_role as enum ('admin', 'participant');
create type game_status as enum ('active', 'cancelled', 'finished', 'deleted');
create type game_access_source as enum ('invite', 'manual_code');
create type game_access_status as enum ('pending', 'approved', 'rejected', 'revoked');
create type game_participant_status as enum (
  'confirmed', 'waiting_list', 'leave_requested', 'left', 'removed'
);
create type invite_type as enum ('group_admin', 'group_participant', 'game_guest');
create type notification_type as enum (
  'game_access_requested', 'player_joined', 'player_left'
);
```

### Usuários e sessões

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  display_name text null,
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
  on user_sessions(user_id)
  where revoked_at is null;
```

O token em texto puro é devolvido apenas uma vez. O banco guarda somente seu hash.

### Grupos e membros

```sql
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  -- Código manual de entrada; guardar hash, pois ele funciona como convite.
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

-- Mantém histórico de saída, mas impede duas associações ativas para o mesmo grupo.
create unique index group_memberships_one_active_idx
  on group_memberships(group_id, user_id)
  where left_at is null;

create index group_memberships_user_active_idx
  on group_memberships(user_id, group_id)
  where left_at is null;
```

`join_code_hash` deve usar Argon2id ou bcrypt. Para procurar um código manual sem armazená-lo em texto puro, envie também um prefixo curto não sensível (por exemplo, os quatro primeiros caracteres) e compare o hash dos candidatos.

### Perfis de jogadores

```sql
create table player_profiles (
  id uuid primary key default gen_random_uuid(),
  -- Perfil interno de grupo ou perfil próprio de um guest.
  group_id uuid null references groups(id) on delete cascade,
  owner_user_id uuid null references users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  level smallint null check (level between 1 and 5),
  mobility text null,
  condition text null,
  position text null,
  created_at timestamptz not null default now(),
  check (group_id is not null or owner_user_id is not null)
);

create index player_profiles_group_idx on player_profiles(group_id, display_name);
create index player_profiles_owner_idx on player_profiles(owner_user_id);
```

Perfis de grupo podem existir sem conta vinculada. Um guest aprovado ganha um perfil próprio (`owner_user_id`) e não vê os perfis internos do grupo.

### Jogos

```sql
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
  on games(group_id, starts_at)
  where status = 'active';
create index games_join_code_prefix_idx on games(join_code_prefix);
```

### Acesso de guest a um jogo

Esta tabela alimenta **Meus jogos** para quem não é membro do grupo. Membros de grupo não precisam de registro aqui: seu acesso aos jogos ativos é derivado de `group_memberships`.

```sql
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
create index user_game_accesses_pending_game_idx
  on user_game_accesses(game_id, created_at)
  where status = 'pending';
```

Ao aprovar, o backend cria/reutiliza um `player_profiles` do guest e concede `status = 'approved'`. A aprovação **não** adiciona automaticamente o guest à lista; ela libera a página do jogo para que ele participe usando seu próprio nome.

### Lista, espera e saída

```sql
create table game_participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references player_profiles(id),
  user_id uuid null references users(id) on delete set null,
  status game_participant_status not null,
  is_paid boolean not null default false,
  joined_at timestamptz not null default now(),
  leave_requested_at timestamptz null,
  left_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (game_id, player_id),
  check (
    (status = 'leave_requested' and leave_requested_at is not null)
    or status <> 'leave_requested'
  )
);

create index game_participants_game_status_idx
  on game_participants(game_id, status, joined_at);
create index game_participants_user_idx
  on game_participants(user_id, game_id);
```

Para evitar ultrapassar `max_players`, a operação de entrada deve ser transacional: bloquear a linha do jogo (`SELECT ... FOR UPDATE`), contar confirmados, inserir como `confirmed` ou `waiting_list`, criar a notificação e confirmar a transação.

### Convites

```sql
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

create index invites_token_prefix_idx on invites(token_prefix);
create index invites_target_idx on invites(group_id, game_id)
  where revoked_at is null;
```

Tipos:

| Tipo | Resultado ao aceitar |
|---|---|
| `group_admin` | pede senha; cria membership `admin` |
| `group_participant` | sem senha; cria membership `participant` |
| `game_guest` | abre jogo readonly; cria acesso `pending` após o nome |

### Notificações dos admins

```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  game_id uuid null references games(id) on delete cascade,
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

create index notification_recipients_inbox_idx
  on notification_recipients(user_id, dismissed_at);
```

Cada admin recebe sua própria linha em `notification_recipients`. Fechar uma mensagem não a fecha para os demais admins.

---

## Regras de negócio obrigatórias

1. Criar grupo torna o criador `admin` imediatamente.
2. Apenas admin ativo pode editar grupo, jogo, jogadores ou criar convites de grupo.
3. Admin e participante ativo podem gerar convite de `game_guest` para um jogo ao qual têm acesso.
4. Participante que é membro do grupo escolhe um perfil do grupo e entra na lista imediatamente; não há aprovação.
5. Guest nunca vê os perfis internos do grupo.
6. Guest por código/link cria `user_game_accesses.status = pending`; o jogo aparece em **Meus jogos**, mas ações ficam bloqueadas.
7. Somente admin do grupo do jogo aprova ou rejeita guest.
8. Guest aprovado só pode ver e agir no jogo aprovado; não obtém `group_membership`.
9. Entradas e saídas efetivadas criam notificação para todos os admins ativos do grupo.
10. Sair do grupo preenche `left_at`; sair da lista atualiza `game_participants` sem apagar histórico.

---

## Rotas/API sugeridas

### Sessão

```text
POST   /v1/sessions/anonymous
DELETE /v1/sessions/current
```

### Grupos

```text
GET    /v1/groups                         # grupos do usuário atual
POST   /v1/groups                         # cria grupo + membership admin
POST   /v1/groups/join                    # código + modo admin/participant
GET    /v1/groups/:groupId
POST   /v1/groups/:groupId/leave
POST   /v1/groups/:groupId/invites
```

`POST /v1/groups/join`:

```json
{
  "code": "GRP-8KQX6D",
  "role": "participant"
}
```

Para `role = "admin"`, inclua `password`.

### Convites

```text
GET    /v1/invites/:token                 # dados seguros para mostrar no modal
POST   /v1/invites/:token/accept
POST   /v1/invites/:token/cancel          # opcional; normalmente só fecha no cliente
```

### Jogos

```text
GET    /v1/groups/:groupId/games
POST   /v1/groups/:groupId/games
GET    /v1/games/:gameId
POST   /v1/games/lookup                   # busca por código manual
GET    /v1/me/games                       # jogos guest pendentes/aprovados + jogos de grupos
POST   /v1/games/:gameId/invites
```

`POST /v1/games/lookup` devolve somente informações públicas do jogo, sem jogadores internos.

### Acesso de guest e lista

```text
POST   /v1/games/:gameId/access-requests
POST   /v1/games/:gameId/access-requests/:requestId/approve
POST   /v1/games/:gameId/access-requests/:requestId/reject
POST   /v1/games/:gameId/participants
POST   /v1/games/:gameId/participants/:participantId/leave-request
POST   /v1/games/:gameId/participants/:participantId/approve-leave
```

### Notificações

```text
GET    /v1/me/notifications
POST   /v1/me/notifications/:notificationId/dismiss
```

---

## Resposta de permissão para o frontend

O backend deve entregar permissões já calculadas; o frontend não deve inferir regras a partir de IDs.

```json
{
  "game": {
    "id": "0dccd083-9ca5-41c9-a83d-0c2a56a6705c",
    "location": "Court 3",
    "startsAt": "2026-09-12T09:00:00Z",
    "status": "active"
  },
  "viewerAccess": {
    "kind": "guest",
    "status": "pending",
    "canViewDetails": true,
    "canViewGroupPlayers": false,
    "canJoin": false,
    "canRequestAccess": false,
    "canRequestLeave": false
  }
}
```

Após aprovação, `status` vira `approved`, `canJoin` e `canRequestLeave` viram `true`; `canViewGroupPlayers` permanece `false`.

---

## Segurança e implementação

- Use UUIDs e tokens criptograficamente aleatórios; nunca IDs incrementais em links.
- Armazene senhas e tokens somente como hash (Argon2id preferencialmente).
- Valide todas as permissões no servidor, nunca apenas no frontend.
- Convites devem aceitar expiração, revogação e limite de usos.
- Registre quem aprovou ou rejeitou cada solicitação.
- Use transações para entrada, saída, lista de espera e cancelamento automático.
- Adicione RLS (*row-level security*) se usar Supabase/Postgres exposto diretamente; caso use uma API própria, mantenha essas regras na camada de serviço.

