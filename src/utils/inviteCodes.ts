import type { GameSession, PlayerGroup } from "../types";

export const groupPlayerInviteCode = (group: Pick<PlayerGroup, "id">) =>
  `PUG-${group.id}`;

export const groupAdminInviteCode = (group: Pick<PlayerGroup, "id">) =>
  `PUA-ADMIN-${group.id}`;

export const gameInviteCode = (
  group: Pick<PlayerGroup, "id">,
  game: Pick<GameSession, "id">,
) => `PUG-GAME-${group.id}-${game.id}`;

export const sameInviteCode = (first: string, second: string) =>
  first.trim().toLocaleUpperCase() === second.trim().toLocaleUpperCase();
