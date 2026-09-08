import type { GameSession } from "../types";

export const emptyGameDraft = {
  date: "",
  time: "",
  endTime: "",
  duration: 0,
  location: "",
  courtNumber: "",
  courtCost: 0,
  currency: "EUR" as GameSession["currency"],
  maxPlayers: 0,
  paymentInfo: "",
  disclaimer: "",
};

export type GameDraft = typeof emptyGameDraft;

export const availableTimeSlots = Array.from({ length: 68 }, (_, index) => {
  const totalMinutes = (index + 28) * 15;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

const localIsoDate = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};

export const today = localIsoDate(new Date());

export function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function gameTimestamp(game: GameSession, time = game.time) {
  const [year, month, day] = game.date.split("-").map(Number);
  const [hours, minutes] = (time || "00:00").split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0).getTime();
}

export function hasGameEnded(game: GameSession) {
  return gameTimestamp(game, game.endTime || game.time || "23:59") <= Date.now();
}

export function isVisibleToParticipants(game: GameSession) {
  const endedAt = gameTimestamp(game, game.endTime || game.time || "23:59");
  return endedAt > Date.now() - 24 * 60 * 60 * 1000;
}

export function compareGameStartTime(firstGame: GameSession, secondGame: GameSession) {
  return gameTimestamp(firstGame) - gameTimestamp(secondGame);
}

export function durationInMinutes(startTime: string, endTime: string) {
  if (!startTime || !endTime) return 0;
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  const endMinutes = Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3));
  return Math.max(0, endMinutes - startMinutes);
}

export function endTimeFromDuration(startTime: string, duration: number) {
  if (!startTime || !duration) return "";
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  const endMinutes = startMinutes + duration;
  if (endMinutes >= 24 * 60) return "";
  return `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
}

export function pricePerPlayer(game: GameSession) {
  return game.playerIds.length ? game.courtCost / game.playerIds.length : game.courtCost;
}

export function currencySymbol(currency: GameSession["currency"]) {
  return { EUR: "€", USD: "$", GBP: "£", BRL: "R$" }[currency];
}

export function gameLabel(game: GameSession) {
  return `${game.date.split("-").reverse().join("/")} · ${game.time}`;
}

export function shortLocationName(location: string) {
  return location.length > 20 ? `${location.slice(0, 17)}...` : location;
}

export function weekdayName(date: string, locale = "pt-BR") {
  if (!date) return "";
  const parsedDate = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsedDate.valueOf())) return "";
  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(parsedDate);
}

export function weekdayAbbreviation(date: string, language: "pt" | "en") {
  if (!date) return "";
  const weekdayIndex = new Date(`${date}T12:00:00`).getDay();
  const abbreviations = language === "pt"
    ? ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
    : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return abbreviations[weekdayIndex];
}
