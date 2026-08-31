import type { Player, PlayerGroup } from "../types";
import { getStoredValue, saveStoredValue } from "../services/browserStorage";

export const SEED_GROUP_ID = "seed-dev";
export const SEED_GROUP_NAME = "Grupo de teste";
export const SEED_GROUP_PASSCODE = "admin";

const players: Player[] = [
  { id: 1, name: "Alex Ribeiro", level: 5, mobility: "rapido", condition: "boa", position: "ataque" },
  { id: 2, name: "Bruno Farias", level: 4, mobility: "neutro", condition: "boa", position: "defesa" },
  { id: 3, name: "Caio Menezes", level: 3, mobility: "rapido", condition: "neutro", position: "neutro" },
  { id: 4, name: "Diego Salles", level: 2, mobility: "lento", condition: "ruim", position: "defesa" },
  { id: 5, name: "Eduardo Castro", level: 4, mobility: "rapido", condition: "neutro", position: "ataque" },
  { id: 6, name: "Felipe Duarte", level: 3, mobility: "neutro", condition: "boa", position: "neutro" },
  { id: 7, name: "Gabriel Souza", level: 5, mobility: "neutro", condition: "ruim", position: "goleiro" },
  { id: 8, name: "Henrique Lopes", level: 1, mobility: "lento", condition: "neutro", position: "goleiro" },
  { id: 9, name: "Igor Bastos", level: 2, mobility: "neutro", condition: "boa", position: "ataque" },
  { id: 10, name: "Joao Prado", level: 5, mobility: "rapido", condition: "boa", position: "ataque" },
  { id: 11, name: "Marcos Alves", level: 3, mobility: "lento", condition: "boa", position: "defesa" },
  { id: 12, name: "Lucas Moreira", level: 4, mobility: "lento", condition: "neutro", position: "neutro" },
  { id: 13, name: "Pedro Costa", level: 2, mobility: "rapido", condition: "ruim", position: "defesa" },
  { id: 14, name: "Nuno Teixeira", level: 3, mobility: "neutro", condition: "neutro", position: "ataque" },
  { id: 15, name: "Otavio Lima", level: 1, mobility: "lento", condition: "ruim", position: "neutro" },
  { id: 16, name: "Paulo Nogueira", level: 4, mobility: "rapido", condition: "neutro", position: "defesa" },
];

export const seedGroup = (): PlayerGroup => ({
  id: SEED_GROUP_ID,
  name: SEED_GROUP_NAME,
  organizerPasscode: SEED_GROUP_PASSCODE,
  createdAt: new Date().toISOString(),
  players,
  games: [],
  requests: [],
});

export function seedBrowserStorage() {
    const existingGroup = getStoredValue<PlayerGroup[]>(`playup.groups.v1`, []);
    if (existingGroup.length) return;
    
    saveStoredValue(`playup.groups.v1`, [seedGroup()]);
    saveStoredValue(`playup.active-group.v1`, SEED_GROUP_ID);
    
}