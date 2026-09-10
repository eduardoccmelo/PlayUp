import type { GameSession, Player, PlayerGroup } from "../types";
import { getStoredValue, saveStoredValue } from "../services/browserStorage";

export const SEED_GROUP_ID = "seed-dev";
export const SEED_GROUP_NAME = "Test Group";
export const SEED_GROUP_PASSCODE = "admin";
export const PARTICIPANT_SEED_GROUP_ID = "city-night-7f3a";
const SEED_VERSION = 7;

const players: Player[] = [
  { id: 1, name: "Alex Morgan", level: 5, mobility: "rapido", condition: "boa", position: "ataque" },
  { id: 2, name: "Ben Carter", level: 4, mobility: "neutro", condition: "boa", position: "defesa" },
  { id: 3, name: "Charlie Adams", level: 3, mobility: "rapido", condition: "neutro", position: "neutro" },
  { id: 4, name: "Daniel Reed", level: 2, mobility: "lento", condition: "ruim", position: "defesa" },
  { id: 5, name: "Ethan Walker", level: 4, mobility: "rapido", condition: "neutro", position: "ataque" },
  { id: 6, name: "Finn Murphy", level: 3, mobility: "neutro", condition: "boa", position: "neutro" },
  { id: 7, name: "George Clark", level: 5, mobility: "neutro", condition: "ruim", position: "goleiro" },
  { id: 8, name: "Henry Lewis", level: 1, mobility: "lento", condition: "neutro", position: "goleiro" },
  { id: 9, name: "Isaac Hill", level: 2, mobility: "neutro", condition: "boa", position: "ataque" },
  { id: 10, name: "Jack Turner", level: 5, mobility: "rapido", condition: "boa", position: "ataque" },
  { id: 11, name: "Liam Scott", level: 3, mobility: "lento", condition: "boa", position: "defesa" },
  { id: 12, name: "Mason Young", level: 4, mobility: "lento", condition: "neutro", position: "neutro" },
  { id: 13, name: "Noah Brooks", level: 2, mobility: "rapido", condition: "ruim", position: "defesa" },
  { id: 14, name: "Oliver Price", level: 3, mobility: "neutro", condition: "neutro", position: "ataque" },
  { id: 15, name: "Owen Taylor", level: 1, mobility: "lento", condition: "ruim", position: "neutro" },
  { id: 16, name: "Paula Mendes", level: 4, mobility: "rapido", condition: "boa", position: "defesa" },
  { id: 17, name: "Quinn Harper", level: 3, mobility: "neutro", condition: "boa", position: "ataque" },
  { id: 18, name: "Rafael Costa", level: 5, mobility: "rapido", condition: "neutro", position: "goleiro" },
  { id: 19, name: "Sara Oliveira", level: 2, mobility: "lento", condition: "boa", position: "defesa" },
  { id: 20, name: "Theo Martins", level: 4, mobility: "neutro", condition: "ruim", position: "ataque" },
  { id: 21, name: "Ursula Klein", level: 3, mobility: "rapido", condition: "boa", position: "neutro" },
  { id: 22, name: "Victor Santos", level: 2, mobility: "lento", condition: "neutro", position: "defesa" },
  { id: 23, name: "Wagner Lima", level: 5, mobility: "rapido", condition: "boa", position: "ataque" },
  { id: 24, name: "Yasmin Rocha", level: 3, mobility: "neutro", condition: "neutro", position: "neutro" },
];

function dateFromToday(daysFromToday: number, yearsFromToday = 0) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + daysFromToday);
  date.setFullYear(date.getFullYear() + yearsFromToday);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function createTestGames(): GameSession[] {
  return [
    {
      id: 1,
      date: dateFromToday(-7),
      time: "19:00",
      endTime: "20:15",
      duration: 75,
      location: "Riverside Arena",
      courtNumber: "1",
      courtCost: 120,
      currency: "EUR",
      maxPlayers: 12,
      minPlayers: null,
      cancellationHours: 2,
      cancelled: false,
      paymentInfo: "Bank transfer",
      disclaimer: "Finished test game",
      playerIds: players.slice(0, 12).map((player) => player.id),
      waitlistIds: [],
      paidPlayerIds: players.slice(0, 12).map((player) => player.id),
      teams: null,
    },
    {
      id: 2,
      date: dateFromToday(1),
      time: "19:30",
      endTime: "20:45",
      duration: 75,
      location: "Riverside Arena",
      courtNumber: "2",
      courtCost: 120,
      currency: "EUR",
      maxPlayers: 12,
      minPlayers: 10,
      cancellationHours: 2,
      cancelled: false,
      paymentInfo: "Bank transfer",
      disclaimer: "Please arrive 15 minutes early",
      playerIds: players.slice(0, 10).map((player) => player.id),
      waitlistIds: [11, 12],
      paidPlayerIds: players.slice(0, 8).map((player) => player.id),
      teams: null,
    },
    {
      id: 4,
      date: dateFromToday(-14),
      time: "20:00",
      endTime: "21:15",
      duration: 75,
      location: "Riverside Arena",
      courtNumber: "1",
      courtCost: 120,
      currency: "EUR",
      maxPlayers: 12,
      minPlayers: 10,
      cancellationHours: 2,
      cancelled: false,
      paymentInfo: "Bank transfer",
      disclaimer: "Finished demo game",
      playerIds: players.slice(0, 12).map((player) => player.id),
      waitlistIds: [],
      paidPlayerIds: players.slice(0, 12).map((player) => player.id),
      teams: null,
    },
    {
      id: 5,
      date: dateFromToday(-28),
      time: "18:30",
      endTime: "20:00",
      duration: 90,
      location: "PlayUp Sports Club",
      courtNumber: "A",
      courtCost: 150,
      currency: "EUR",
      maxPlayers: 12,
      minPlayers: 10,
      cancellationHours: 2,
      cancelled: false,
      paymentInfo: "Bank transfer",
      disclaimer: "Finished demo game",
      playerIds: players.slice(6, 18).map((player) => player.id),
      waitlistIds: [],
      paidPlayerIds: players.slice(6, 18).map((player) => player.id),
      teams: null,
    },
    {
      id: 6,
      date: dateFromToday(-42),
      time: "19:15",
      endTime: "20:30",
      duration: 75,
      location: "Riverside Arena",
      courtNumber: "3",
      courtCost: 120,
      currency: "EUR",
      maxPlayers: 12,
      minPlayers: 10,
      cancellationHours: 2,
      cancelled: false,
      paymentInfo: "Bank transfer",
      disclaimer: "Finished demo game",
      playerIds: players.slice(12, 24).map((player) => player.id),
      waitlistIds: [],
      paidPlayerIds: players.slice(12, 24).map((player) => player.id),
      teams: null,
    },
    {
      id: 7,
      date: dateFromToday(-56),
      time: "20:15",
      endTime: "21:30",
      duration: 75,
      location: "PlayUp Sports Club",
      courtNumber: "B",
      courtCost: 150,
      currency: "EUR",
      maxPlayers: 12,
      minPlayers: 10,
      cancellationHours: 2,
      cancelled: false,
      paymentInfo: "Bank transfer",
      disclaimer: "Finished demo game",
      playerIds: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23],
      waitlistIds: [],
      paidPlayerIds: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23],
      teams: null,
    },
    {
      id: 3,
      date: dateFromToday(0, 1),
      time: "18:00",
      endTime: "19:30",
      duration: 90,
      location: "PlayUp Sports Club",
      courtNumber: "A",
      courtCost: 150,
      currency: "EUR",
      maxPlayers: 14,
      minPlayers: null,
      cancellationHours: 2,
      cancelled: false,
      paymentInfo: "Bank transfer",
      disclaimer: "Please confirm your attendance early",
      playerIds: [1, 2, 3, 4, 5, 6],
      waitlistIds: [],
      paidPlayerIds: [1, 2, 3, 4],
      teams: null,
    },
  ];
}

export const seedGroup = (): PlayerGroup => ({
  id: SEED_GROUP_ID,
  name: SEED_GROUP_NAME,
  organizerPasscode: SEED_GROUP_PASSCODE,
  createdAt: new Date().toISOString(),
  players: players.map((player) => ({ ...player })),
  games: createTestGames(),
  requests: [],
});

const communityPlayers: Player[] = [
  { id: 101, name: "Bruno Silva", level: 4, mobility: "rapido", condition: "boa", position: "ataque" },
  { id: 102, name: "Camila Rocha", level: 3, mobility: "neutro", condition: "boa", position: "defesa" },
  { id: 103, name: "Diego Lima", level: 5, mobility: "rapido", condition: "neutro", position: "goleiro" },
  { id: 104, name: "Fernanda Alves", level: 2, mobility: "lento", condition: "ruim", position: "defesa" },
  { id: 105, name: "Gabriel Costa", level: 4, mobility: "neutro", condition: "boa", position: "ataque" },
  { id: 106, name: "Helena Souza", level: 3, mobility: "rapido", condition: "neutro", position: "neutro" },
];

const neighborhoodPlayers: Player[] = [
  { id: 201, name: "Igor Nunes", level: 1, mobility: "lento", condition: "ruim", position: "goleiro" },
  { id: 202, name: "Juliana Freitas", level: 5, mobility: "rapido", condition: "boa", position: "ataque" },
  { id: 203, name: "Kai Mendes", level: 3, mobility: "neutro", condition: "neutro", position: "defesa" },
  { id: 204, name: "Larissa Melo", level: 4, mobility: "rapido", condition: "boa", position: "defesa" },
  { id: 205, name: "Marcos Vinicius", level: 2, mobility: "neutro", condition: "neutro", position: "ataque" },
  { id: 206, name: "Nina Prado", level: 3, mobility: "lento", condition: "boa", position: "neutro" },
];

const demoGame = (
  id: number,
  days: number,
  location: string,
  court: string,
  playerIds: number[],
  waitlistIds: number[],
  maxPlayers = 6,
): GameSession => ({
  id,
  date: dateFromToday(days),
  time: "20:00",
  endTime: "21:15",
  duration: 75,
  location,
  courtNumber: court,
  courtCost: 100,
  currency: "EUR",
  maxPlayers,
  minPlayers: 4,
  cancellationHours: 2,
  cancelled: false,
  paymentInfo: "Pix ou transferência",
  disclaimer: "Dados de demonstração",
  playerIds,
  waitlistIds,
  paidPlayerIds: playerIds.slice(0, Math.max(0, playerIds.length - 1)),
  teams: null,
});

export const seedGroups = (): PlayerGroup[] => [
  seedGroup(),
  {
    id: PARTICIPANT_SEED_GROUP_ID,
    name: "City Night Football",
    organizerPasscode: "nightplay",
    createdAt: new Date().toISOString(),
    players: communityPlayers,
    games: [
      demoGame(201, 2, "Urban Sports Center", "B", [101, 102, 103, 104], [105], 4),
      demoGame(202, 6, "Urban Sports Center", "A", [101, 103, 105, 106], []),
    ],
    requests: [],
  },
  {
    id: "weekend-friends-b9c2",
    name: "Weekend Friends",
    organizerPasscode: "weekend",
    createdAt: new Date().toISOString(),
    players: neighborhoodPlayers,
    games: [
      demoGame(301, 3, "Green Field Club", "3", [201, 202, 203, 204, 205, 206], []),
      demoGame(302, 9, "Green Field Club", "1", [202, 204, 206], []),
    ],
    requests: [],
  },
  {
    id: "morning-padel-c4d8",
    name: "Morning Padel",
    organizerPasscode: "padel",
    createdAt: new Date().toISOString(),
    players: [
      { id: 301, name: "Rafa Torres", level: 4, mobility: "rapido", condition: "boa", position: "ataque" },
      { id: 302, name: "Sofia Costa", level: 3, mobility: "neutro", condition: "boa", position: "defesa" },
      { id: 303, name: "Tiago Vale", level: 2, mobility: "lento", condition: "neutro", position: "neutro" },
      { id: 304, name: "Vera Lopes", level: 5, mobility: "rapido", condition: "boa", position: "goleiro" },
    ],
    games: [demoGame(401, 5, "Padel One", "2", [301, 302, 303, 304], [])],
    requests: [],
  },
  {
    id: "sunset-futsal-e5f1",
    name: "Sunset Futsal",
    organizerPasscode: "sunset",
    createdAt: new Date().toISOString(),
    players: [
      { id: 401, name: "Ana Reis", level: 4, mobility: "rapido", condition: "boa", position: "ataque" },
      { id: 402, name: "Caio Moura", level: 3, mobility: "neutro", condition: "boa", position: "defesa" },
      { id: 403, name: "Elisa Faria", level: 5, mobility: "rapido", condition: "neutro", position: "goleiro" },
      { id: 404, name: "João Prado", level: 2, mobility: "lento", condition: "neutro", position: "defesa" },
    ],
    games: [demoGame(501, 7, "Sunset Arena", "1", [401, 402, 403, 404], [])],
    requests: [],
  },
  {
    id: "harbor-football-f6a4",
    name: "Harbor Football",
    organizerPasscode: "harbor",
    createdAt: new Date().toISOString(),
    players: [
      { id: 501, name: "Bia Ramos", level: 3, mobility: "rapido", condition: "boa", position: "ataque" },
      { id: 502, name: "Davi Cruz", level: 4, mobility: "neutro", condition: "boa", position: "defesa" },
      { id: 503, name: "Gabi Luz", level: 2, mobility: "lento", condition: "neutro", position: "neutro" },
      { id: 504, name: "Hugo Sá", level: 5, mobility: "rapido", condition: "boa", position: "goleiro" },
    ],
    games: [demoGame(601, 10, "Harbor Field", "4", [501, 502, 503, 504], [])],
    requests: [],
  },
  {
    id: "downtown-futsal-a7b2",
    name: "Downtown Futsal",
    organizerPasscode: "downtown",
    createdAt: new Date().toISOString(),
    players: [
      { id: 601, name: "Iara Viana", level: 4, mobility: "rapido", condition: "boa", position: "ataque" },
      { id: 602, name: "Leandro Paz", level: 3, mobility: "neutro", condition: "neutro", position: "defesa" },
      { id: 603, name: "Marta Dias", level: 5, mobility: "rapido", condition: "boa", position: "goleiro" },
      { id: 604, name: "Otávio Reis", level: 2, mobility: "lento", condition: "ruim", position: "defesa" },
    ],
    games: [demoGame(701, 12, "Downtown Court", "C", [601, 602, 603, 604], [])],
    requests: [],
  },
];

export function seedBrowserStorage() {
  const existingGroups = getStoredValue<PlayerGroup[]>("playup.groups.v1", []);
  const storedSeedVersion = getStoredValue<number>("playup.seed-version", 0);
  const refreshedSeeds = seedGroups();
  const seedIds = new Set(refreshedSeeds.map((group) => group.id));
  const missingSeedGroup = refreshedSeeds.some(
    (seed) => !existingGroups.some((group) => group.id === seed.id),
  );

  if (
    existingGroups.length &&
    (storedSeedVersion < SEED_VERSION || missingSeedGroup)
  ) {
    saveStoredValue("playup.groups.v1", [
      ...refreshedSeeds,
      ...existingGroups.filter((group) => !seedIds.has(group.id)),
    ]);
    saveStoredValue("playup.seed-version", SEED_VERSION);
    return;
  }

  if (existingGroups.length) return;

  saveStoredValue("playup.groups.v1", refreshedSeeds);
  saveStoredValue("playup.active-group.v1", SEED_GROUP_ID);
  saveStoredValue("playup.seed-version", SEED_VERSION);
}
