# PlayUp

**[Leia em português](README.pt-BR.md)**

PlayUp is a web application for organizing group sports games. One profile can manage some groups, participate in others, and keep a separate list of upcoming games.

> This project is currently an MVP. Data, permissions, and profile recovery are simulated in browser storage. The email/access-code screens are a local UI demo (`123456`); there is no backend, real email delivery, authentication, or cross-device synchronization yet.

## Contents

- [Features](#features)
- [Current prototype flow](#current-prototype-flow)
- [How to use](#how-to-use)
- [Game rules](#game-rules)
- [Team balancing](#team-balancing)
- [Technology](#technology)
- [Run locally](#run-locally)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Current persistence and limitations](#current-persistence-and-limitations)
- [Suggested next steps](#suggested-next-steps)

## Features

### Game groups

- Create multiple independent groups.
- Every group has a local participant code; the current seed also includes groups where the current profile is not an administrator.
- Admin status belongs to a group, not to the whole account.
- Administrators can manage games and players; participants can view games and share participant access.
- Share one group dialog with distinct participant and admin invitation codes.
- Change a group passcode only after confirming the current passcode.
- Keep players, games, join requests, payments, and teams completely separate for each group.

### Group administrators

- Create, edit, view, and delete games.
- Maintain a group-wide player directory.
- Edit every player attribute or remove a player from the directory with confirmation.
- Approve participant join requests.
- Add or remove players from an individual game list.
- Track payment status with a checkbox.
- View group statistics: total games, active games, and completed-game participations per player.
- Generate teams manually with at least two paid players, or automatically when the main list is full and every listed player is paid. Each game allows three standard balance generations in total (automatic or admin-triggered), with an auditable trigger history; after that, the system makes a final automatic balance 15 minutes before kickoff.
- See the score used for team balancing; this information is organizer-only.

### Participants and guests

- View groups and personal upcoming games from one dashboard.
- A group member joins with their linked player name without approval.
- When a game is full, joining places the player on its waiting list.
- A non-member can add a game by code, see it in read-only mode, and request access.
- A guest has game actions only after an administrator approves the request.
- A participant can update only their own payment checkbox and remove only their own name from a game.
- Player names cannot be duplicated within a group or an active game list.

### Games

Every game includes:

- location;
- date and automatically calculated weekday;
- start time;
- a duration from 45 minutes to 3 hours, in 15-minute intervals;
- automatically calculated end time;
- court cost and currency (`EUR`, `USD`, `GBP`, or `BRL`);
- maximum number of players;
- optional court number;
- payment details; and
- an optional player notice of up to 100 characters.

Games are displayed in chronological order. A completed game always uses the same read-only layout for participants and organizers, including an existing team-balance snapshot. For participants it remains visible for 24 hours; organizers can continue to view or delete it manually.

### Lists and payments

- The organizer sets the game capacity.
- Once the main list is full, new players join the waiting list in arrival order.
- When a main-list player is removed, the first waiting player is promoted automatically as pending.
- The cost per player is calculated only from the main list; waiting-list players do not change the split.
- Marking a player as paid also confirms them for the game.
- Paid players are grouped at the top of the list while preserving their relative payment order.
- Manual team generation is available with at least two paid main-list players. A full, fully paid main list generates teams automatically.
- A waiting-list player can be included manually in the main list. They take the last pending spot, while the replaced player moves to the waiting list.

### Languages and interface

- Portuguese and English interface.
- Initial language is based on browser language: Portuguese for Portuguese browsers, English otherwise.
- Manual language switching from the landing page.
- Responsive desktop and mobile layout.
- PlayUp branding in the header; clicking the logo returns to the appropriate home screen.

## Current prototype flow

1. Create a local profile with name and email, then verify the demo access code. Returning profiles sign in with email and that code; the profile snapshot is restored from the same browser.
2. Open **My groups** to create a group, join a group, manage groups where you are an admin, or browse groups where you are only a participant.
3. **My next games** lists only games in which your profile is on the main or waiting list.
4. Use a local group code to add a group, or a local game code to add a game without joining its group.
5. Group members join a game immediately with their own profile. Guests request access and remain pending until an admin approves them.

The temporary code formats are validated against local data:

| Purpose | Local format |
| --- | --- |
| Group participant | `PUG-<groupId>` |
| Group admin | `PUA-ADMIN-<groupId>` |
| Specific game | `PUG-GAME-<groupId>-<gameId>` |

These formats are for UI testing only. Production must use random, revocable server-side tokens. See [the backend specification](docs/backend-schema.md) for the target data model and API.

## How to use

1. Create, sign in to, or edit your local profile. The prototype uses `123456` as the access-code demo.
2. From **My groups**, create/join a group or open its games.
3. If you are an admin of that group, use **Manage** to create games, maintain players, and process guest requests.
4. From **My next games**, view a game you are already attending, update your own payment state, or leave the list.
5. Use **I have a game code** for a game outside your groups. In this prototype, the code opens a local demo game; the backend flow will request approval for a true guest.

## Game rules

| Situation | Behaviour |
| --- | --- |
| Main list has space | The player joins as payment pending. |
| Main list is full | The player joins the waiting list. |
| Main-list player is removed | The first waiting player is promoted automatically as pending. |
| A waiting player is manually included | They replace the last pending main-list player. |
| Player is marked paid | They are confirmed, move into the paid section, and become eligible for teams. |
| Player is removed from a game | They remain registered in the group directory. |
| Player is deleted from the directory | They are permanently removed from the group and all game lists. |

## Team balancing

PlayUp can manually create two teams from at least two paid main-list players. When the main list is full and every listed player is paid, teams are generated automatically. There are at most three standard balance generations per game in total, whether triggered automatically or by an admin; each records the trigger and count. The system makes a final automatic balance 15 minutes before kickoff after that limit. The algorithm considers score, position, and speed; a rebalance chooses a different comparably fair split when one is available.

### Player scores

For outfield players, level is the base score:

| Level | Score |
| --- | ---: |
| 1 | 1.00 |
| 2 | 2.00 |
| 3 | 3.00 |
| 4 | 4.00 |
| 5 | 5.00 |

Goalkeepers use a position-specific scale:

| Goalkeeper level | Score |
| --- | ---: |
| 1 | 0.75 |
| 2 | 1.75 |
| 3 | 3.00 |
| 4 | 4.25 |
| 5 | 5.25 |

The following adjustments are added to the base score:

| Attribute | Adjustment |
| --- | ---: |
| Fast speed | +0.25 |
| Neutral speed | 0 |
| Slow speed | -0.25 |
| Good condition | +0.25 |
| Neutral condition | 0 |
| Poor condition | -0.25 |

In addition to total score, the algorithm tries to distribute goalkeepers, defenders, attackers, fast players, and slow players across both teams. Neutral positions work as wildcards. When possible, goalkeepers are split between teams.

New players always start with level 3, neutral speed, neutral condition, and neutral position.

## Technology

- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- Responsive native CSS
- Browser `localStorage` for local persistence

## Run locally

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm 10 or later

### Installation

```bash
git clone <REPOSITORY_URL>
cd playup
npm install
```

### Development

```bash
npm run dev
```

Vite will print the local URL, usually `http://localhost:5173`.

### Production build

```bash
npm run build
npm run preview
```

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the local development server with hot reload. |
| `npm run build` | Type-checks the project and creates the production build in `dist/`. |
| `npm run preview` | Serves the production build locally. |
| `npm run lint` | Runs static analysis with ESLint. |

## Project structure

```text
src/
├── assets/                 # Brand logos and images
├── components/
│   ├── LandingPage.tsx     # Landing page and role choice
│   ├── GroupSelector.tsx   # Groups, passcodes, and group administration
│   ├── PlayUpApp.tsx       # Primary application state and flows
│   ├── GameForm.tsx        # Create/edit game form
│   ├── PlayerDirectoryManager.tsx
│   ├── ReadOnlyGame.tsx
│   └── Teams.tsx
├── hooks/
│   └── useLocalStorage.ts  # Browser persistence
├── services/
│   └── browserStorage.ts   # Storage read/write helpers
├── utils/
│   ├── game.ts             # Dates, times, pricing, and visibility rules
│   └── teamBalancer.ts     # Scores and team balancing
├── i18n.ts                 # PT/EN copy and translations
├── types.ts                # Domain types
├── App.tsx                 # Application entry point
└── App.css                 # Global and responsive styles
```

## Current persistence and limitations

Data is stored only in the browser's `localStorage`. Consequently:

- profile snapshots, groups, and games are not shared automatically between devices;
- clearing browser data can erase local groups;
- organizer passcodes are not protected by a server;
- codes are validated only against local and seeded data, not remotely;
- the profile/email/access-code journey is a local mock: there are no real accounts, email delivery, passcode recovery, server-enforced permissions, or audit trail.

The planned backend model, permissions, API, profile recovery, and secure invite/token strategy are documented in [docs/backend-schema.md](docs/backend-schema.md).

## Suggested next steps

- Implement the backend and database described in [docs/backend-schema.md](docs/backend-schema.md).
- Email-based profile recovery with an access-code regeneration flow.
- Secure, shareable group and game links.
- Payment integration and automatic payment confirmation.
- Email, WhatsApp, or push notifications.
- Match history, results, and statistics.
- More languages.

## License

This project does not yet have a defined license. Add an appropriate license before publishing or accepting external contributions.
