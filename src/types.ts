export type Mobility = "rapido" | "neutro" | "lento";
export type Condition = "boa" | "neutro" | "ruim";
export type Position = "goleiro" | "defesa" | "ataque" | "neutro";
export type CurrentUser = {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  adminGroupIds?: string[];
  leftGroupIds?: string[];
  devGodMode: boolean;
  /** Seed version whose complete demonstration profile was last hydrated. */
  demoSeedVersion?: number;
  createdAt: string;
};
export type Player = {
  id: number;
  name: string;
  ownerUserId?: string;
  /** User who created a manual guest record, when it is not a verified profile. */
  createdByUserId?: string;
  /** A player created by an organizer, without a verified app account. */
  isGuest?: boolean;
  /** A verified account may be restricted to one game instead of the group. */
  accessScope?: "group" | "game";
  level: number;
  mobility: Mobility;
  condition: Condition;
  position: Position;
};
export type GroupAdminRole = "owner" | "admin";
export type GroupAdmin = {
  userId: string;
  playerId?: number;
  displayName: string;
  role: GroupAdminRole;
  joinedAt: string;
};
export type PlayerSkillVote = {
  playerId: number;
  adminUserId: string;
  level?: number;
  mobility?: 1 | 2 | 3;
  updatedAt: string;
};
export type GroupAdminInvite = {
  code: string;
  playerId: number;
  createdByUserId: string;
  createdAt: string;
};
export type ParticipationRequest = {
  id: number;
  name: string;
  gameId: number;
  playerId: number;
  paymentConfirmed: boolean;
  type: "payment";
};
export type BalancedTeams = { teamA: Player[]; teamB: Player[]; sumA: number; sumB: number; };
export type BalanceHistoryEntry = {
  triggeredAt: string;
  type: "automatic" | "admin" | "late-rebalance";
  adminName?: string;
  count?: number;
};
export type GameSession = { id: number; date: string; time: string; endTime: string; duration: number; location: string; courtNumber: string; courtCost: number; currency: "EUR" | "USD" | "GBP" | "BRL"; maxPlayers: number; minPlayers: number | null; cancellationHours: number | null; cancelled: boolean; paymentInfo: string; disclaimer: string; playerIds: number[]; waitlistIds: number[]; paidPlayerIds: number[]; teams: BalancedTeams | null; createdByUserId?: string; createdByRole?: "admin" | "participant"; balanceCount?: number; balanceHistory?: BalanceHistoryEntry[]; manualRebalanceCount?: number; lateRebalanceUsed?: boolean; };
export type PlayerGroup = {
  id: string;
  name: string;
  organizerPasscode: string;
  createdAt: string;
  players: Player[];
  games: GameSession[];
  requests: ParticipationRequest[];
  /** The source of truth for group governance; `adminGroupIds` is local-session compatibility data. */
  admins?: GroupAdmin[];
  /** Open, incremental ballots. Each saved vote immediately updates the group average. */
  skillVotes?: PlayerSkillVote[];
  adminInvites?: GroupAdminInvite[];
};
