import type { GameSession, Player, PlayerGroup } from "../types";
import { getStoredValue, saveStoredValue } from "../services/browserStorage";

export const SEED_GROUP_ID = "seed-dev";
export const SEED_GROUP_NAME = "Test Group";
export const SEED_GROUP_PASSCODE = "admin";
const SEED_VERSION = 2;

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

export function seedBrowserStorage() {
  const existingGroups = getStoredValue<PlayerGroup[]>("playup.groups.v1", []);
  const storedSeedVersion = getStoredValue<number>("playup.seed-version", 0);
  const existingSeedGroup = existingGroups.find(
    (group) => group.id === SEED_GROUP_ID,
  );

  if (existingSeedGroup && storedSeedVersion < SEED_VERSION) {
    saveStoredValue(
      "playup.groups.v1",
      existingGroups.map((group) =>
        group.id === SEED_GROUP_ID ? seedGroup() : group,
      ),
    );
    saveStoredValue("playup.seed-version", SEED_VERSION);
    return;
  }

  if (existingGroups.length) return;

  saveStoredValue("playup.groups.v1", [seedGroup()]);
  saveStoredValue("playup.active-group.v1", SEED_GROUP_ID);
  saveStoredValue("playup.seed-version", SEED_VERSION);
}
