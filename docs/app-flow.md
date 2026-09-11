# PlayUp application flow

**Português:** [resumo em português](#resumo-em-português). This is the product-flow companion to the backend schema.

## Entry and profile

```mermaid
flowchart TD
  A[Open PlayUp] --> B{Local session exists?}
  B -- No --> C[Create profile or sign in]
  C --> D[Email + access code verification]
  D --> E[My groups and My next games]
  B -- Yes --> E
  E --> F[Profile settings / logout]
  F --> A
```

The local front end generates a new six-digit demo verification code for every request and expires it after five minutes. The backend replaces this with real email delivery, one-time token hashes, and sessions. Logout clears the local session; a future sign-in restores the account data from the backend.

## Groups and game access

```mermaid
flowchart TD
  A[Dashboard] --> B[My groups and My next games]
  B --> D[Create group]
  B --> E[Join group: invitation link or group code]
  E --> F{Access type}
  F -- Admin code + passcode --> G[Admin membership]
  F -- Participant code --> H[Participant membership]
  G --> I[Group management]
  H --> J[Group game list]
  B --> K[Add game: invitation link or game code]
  K --> L{Member of the game's group?}
  L -- Yes --> J
  L -- No --> M[Verify name + email]
  M --> O[Game-only access and direct list entry]
```

There is no global “admin account” mode. A user can be an admin in Group A, a participant in Group B, and have guest-only access to Game C.

## Authority inside a group

| Capability | Group admin | Group participant | Guest |
| --- | --- | --- | --- |
| View active group games | Yes | Yes | Only their invited game |
| Create a game | Yes | Yes | No |
| Edit group, use Admin panel, or see statistics | Yes | No | No |
| Delete group | Owner only | No | No |
| Maintain group player directory and attributes | Yes | No | No |
| Manage any group game | Yes | No | No |
| Manage a game created by themselves | Yes | Yes | No |
| Join/leave own game entry and update own payment | Yes | Yes | Yes |

When a participant creates a game, the game records `createdByUserId` and `createdByRole: participant`. The creator becomes that game’s organizer only. They can create players, add/remove players in that game, mark payments, and balance teams. They do **not** become a group admin, cannot see player skill attributes, cannot see group statistics, and cannot manage games created by someone else. A group admin retains full management of every game in the group.

## Group admin panel and skill voting

The group creator is stored as `owner`; other administrators are `admin`. Both can operate the group today, but only the owner may delete the group (with the group passcode) and the owner cannot be removed through the admin panel. When an owner leaves, ownership transfers to the most active remaining member, then to the oldest membership on a tie. Admins can create an individual invitation for an existing participant to become an admin. Acceptance preserves that person's player membership and adds the admin role.

Admins vote independently on every group player's level (1–5) and mobility (1–3). A vote is saved immediately and the current mean is applied immediately, rounding `.5` upward. A missing vote never blocks the current value or team balancing; that admin may vote later and update the aggregate. An admin never sees, votes on, or manually edits their own level/mobility. They may edit only their own position and condition. Players' own level and mobility are also hidden from their row in game-management lists.

## Game roster flow

```mermaid
flowchart TD
  A[Join a game] --> B{Group member?}
  B -- Yes --> C[Use linked player profile]
  B -- No --> D[Verify name + email and create game-only profile]
  D --> G{Main list has capacity?}
  C --> G
  G -- Yes --> H[Confirmed / payment pending]
  G -- No --> I[Waiting list]
  H --> J[Player may mark only their own payment]
  H --> K[Player may leave their own entry]
  K --> L[First waiting player promoted automatically]
```

Names are unique case-insensitively within a group and an active game list. A group member joins immediately; an invited non-member verifies their identity and is placed directly on the main or waiting list. Game-only access never grants group membership.

## Team balancing

1. Only **paid, confirmed main-list players** are eligible. Waiting-list and unpaid players are excluded.
2. At least two eligible players are required for manual balancing.
3. A full, fully paid main list automatically creates the next available standard balance.
4. For an admin-created game, automatic and manual balances share a quota of **two** standard balances. For a participant-created game, that quota is **one**.
5. Changing the roster or payment state clears the active team snapshot but never restores a spent balance quota.
6. Once the standard quota is spent, exactly one final manual rebalance becomes available in the final 15 minutes before kickoff. It can be used once.
7. The latest balance replaces the previous snapshot and status message. The algorithm favors a different comparably fair split rather than only switching the two team labels.

Admin-created games show the latest trigger, the responsible admin when relevant, and the balance count. Participant-created games hide player skill data and admin identities.

## Completed and cancelled games

- Finished and cancelled games use read-only presentation for every role.
- Finished games retain their last valid team snapshot.
- A finished, non-cancelled game increments participation statistics once for each confirmed main-list player.
- Only an authorized group admin may delete a historical game.

## Resumo em português

1. A pessoa cria/entra no perfil por nome, e-mail e um código de acesso de uso único. No protótipo, o código é gerado localmente, vale cinco minutos e aparece como dica de demonstração.
2. O painel unifica **Meus grupos** e **Meus próximos jogos**. Uma pessoa pode ser admin de um grupo, participante de outro e guest de um jogo específico.
3. Grupo pode ser acessado por link/código: convite de admin exige senha; convite de participante não. Jogo pode ser acessado por link/código sem entrar no grupo; após confirmar nome e e-mail, a pessoa entra diretamente na lista principal ou de espera.
4. Admin administra o grupo inteiro. Participante também pode criar um jogo, mas vira organizador somente daquele jogo: lista, pagamentos, criação de jogadores e times. Não ganha estatísticas, atributos técnicos nem administração do grupo ou de outros jogos.
5. Membro do grupo entra direto no jogo com o próprio perfil; se estiver cheio, vai para espera. Quem recebeu apenas o convite do jogo tem esse mesmo acesso limitado ao jogo, sem entrar no grupo. Cada pessoa altera apenas o próprio pagamento e sai apenas da própria vaga.
6. Balanceamento usa apenas jogadores confirmados e pagos. Jogo de admin tem duas gerações regulares; jogo criado por participante tem uma. Depois existe apenas um rebalanceamento manual final, liberado nos últimos 15 minutos antes do jogo. Mudanças na lista não reiniciam os limites.
7. Jogador criado manualmente recebe a etiqueta **Convidado/Guest**: não possui conta nem acesso ao app. Um usuário com e-mail confirmado e acesso apenas a um jogo é um usuário registrado com escopo de jogo, não um convidado manual.
