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
  createdAt: string;
};
export type Player = { id: number; name: string; ownerUserId?: string; isGuest?: boolean; level: number; mobility: Mobility; condition: Condition; position: Position; };
export type ParticipationRequest = {
  id: number;
  name: string;
  requesterUserId?: string;
  gameId?: number;
  playerId?: number;
  paymentConfirmed?: boolean;
  type?: "join" | "leave" | "payment";
};
export type BalancedTeams = { teamA: Player[]; teamB: Player[]; sumA: number; sumB: number; };
export type GameSession = { id: number; date: string; time: string; endTime: string; duration: number; location: string; courtNumber: string; courtCost: number; currency: "EUR" | "USD" | "GBP" | "BRL"; maxPlayers: number; minPlayers: number | null; cancellationHours: number | null; cancelled: boolean; paymentInfo: string; disclaimer: string; playerIds: number[]; waitlistIds: number[]; paidPlayerIds: number[]; teams: BalancedTeams | null; };
export type PlayerGroup = {
  id: string;
  name: string;
  organizerPasscode: string;
  createdAt: string;
  players: Player[];
  games: GameSession[];
  requests: ParticipationRequest[];
};
