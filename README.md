# PlayUp

**[Leia em português](README.pt-BR.md)**

PlayUp is a web application for organizing group sports games. Organizers create games, track payments, and generate balanced teams; participants find their group, browse games, and confirm that they want to play.

> This project is currently an MVP. Data is stored in the browser, and this version has no backend, user authentication, or cross-device synchronization.

## Contents

- [Features](#features)
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
- Every group has a unique identifier displayed in the group list.
- Edit group names, up to 20 characters.
- Use a shared organizer passcode to enter the management area.
- Change or delete a group only after confirming the current passcode.
- Keep players, games, join requests, payments, and teams completely separate for each group.

### Organizers

- Create, edit, view, and delete games.
- Maintain a group-wide player directory.
- Edit every player attribute or remove a player from the directory with confirmation.
- Approve participant join requests.
- Add or remove players from an individual game list.
- Track payment status with a checkbox.
- Generate and rebalance teams.
- See the score used for team balancing; this information is organizer-only.

### Participants

- Choose a group to browse its upcoming games.
- View the game list and teams without adding themselves to the game.
- Confirm attendance by searching for their name in the group directory.
- Request to join when their name has not been registered yet.
- View participants, waiting list, payment status, and teams in read-only mode.
- Remove only their name from a game while remaining in the group directory.

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

Games are displayed in chronological order. For participants, a completed game remains visible in a disabled, read-only state for 24 hours. It disappears afterwards, while organizers can still view it until they delete it manually.

### Lists and payments

- The organizer sets the game capacity.
- Once the main list is full, new players join the waiting list in arrival order.
- When a main-list player is removed, the first waiting player is promoted automatically as pending.
- The cost per player is calculated only from the main list; waiting-list players do not change the split.
- Marking a player as paid also confirms them for the game.
- Paid players are grouped at the top of the list while preserving their relative payment order.
- Only paid players are eligible for team generation.
- A waiting-list player can be included manually in the main list. They take the last pending spot, while the replaced player moves to the waiting list.

### Languages and interface

- Portuguese and English interface.
- Initial language is based on browser language: Portuguese for Portuguese browsers, English otherwise.
- Manual language switching from the landing page.
- Responsive desktop and mobile layout.
- PlayUp branding in the header; clicking the logo returns to the appropriate home screen.

## How to use

### As an organizer

1. On the landing page, select **I'm an organizer**.
2. Create a group or enter an existing group with the shared organizer passcode.
3. Click **New game** and fill in the event details.
4. Register players in the **Manage players** area.
5. Open a game to add players, edit their attributes, track payments, and manage the waiting list.
6. Once at least two players have paid, click **Generate teams**.
7. After the first generation, that button becomes **Balance again**.

### As a participant

1. On the landing page, select **I'm playing**.
2. Choose the relevant group.
3. Each available game offers three actions:
   - **View** opens the list and teams in read-only mode;
   - **Join** searches for and selects your registered name;
   - **Request to join** sends your name to an organizer for approval.
4. After joining, follow your payment status and the teams. You can remove only your own name from that game if needed.

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

PlayUp creates two teams using paid players only. The algorithm considers score, position, and speed, and randomizes the displayed player order so the result does not expose an obvious ranking.

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

- groups are not shared automatically between devices;
- clearing browser data can erase local groups;
- organizer passcodes are not protected by a server;
- the group code does not yet provide remote link access;
- there are no accounts, real permissions, passcode recovery, or audit trail.

For a commercial version, the natural next step is an API and database with global group identifiers, shareable links, and suitable organizer authentication or authorization.

## Suggested next steps

- Backend and database to synchronize groups across devices.
- Shareable group links, such as `/g/<group-id>`.
- Organizer invites and role-based permissions.
- Payment integration and automatic payment confirmation.
- Email, WhatsApp, or push notifications.
- Match history, results, and statistics.
- More languages.

## License

This project does not yet have a defined license. Add an appropriate license before publishing or accepting external contributions.
