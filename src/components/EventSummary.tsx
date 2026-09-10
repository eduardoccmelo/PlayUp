import { localize, type Language } from "../i18n";
import type { GameSession } from "../types";
import { weekdayName } from "../utils/game";

type EventSummaryProps = {
  className?: string;
  game: GameSession;
  language: Language;
};

export function EventSummary({
  className = "game-event-summary",
  game,
  language,
}: EventSummaryProps) {
  const court = game.courtNumber.trim()
    ? `${localize("Quadra", language)} ${game.courtNumber}`
    : localize("Quadra N/D", language);

  return (
    <p className={`event-summary ${className}`}>
      <span className="event-summary-date">
        <strong>{game.date.split("-").reverse().join("/")}</strong>{" "}
        ({weekdayName(game.date, language === "pt" ? "pt-BR" : "en-GB")})
      </span>
      <span className="event-summary-location">
        {game.location || localize("Local não informado", language)}
      </span>
      <span className="event-summary-time">
        {game.time} – {game.endTime} ({game.duration} {localize("min", language)})
      </span>
      <span className="event-summary-court">
        {court}
      </span>
    </p>
  );
}

export function CompactGameDetails({
  game,
  language,
  waiting = false,
  hideEndTime = false,
  organizer = false,
}: Omit<EventSummaryProps, "className"> & {
  waiting?: boolean;
  hideEndTime?: boolean;
  organizer?: boolean;
}) {
  const court = game.courtNumber.trim()
    ? `${localize("Quadra", language)} ${game.courtNumber}`
    : localize("Quadra N/D", language);
  const weekday = weekdayName(game.date, language === "pt" ? "pt-BR" : "en-GB");
  const shortWeekday = weekday
    .slice(0, 3)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    <p className="session-details" title={game.location}>
      <span className="session-detail-date">
        <strong>{game.date.split("-").reverse().join("/")}</strong>{" "}
        (<span className="weekday-name-full">{weekday}</span>
        <span className="weekday-name-short">{shortWeekday}</span>)
      </span>
      <span className="session-detail-location">
        {game.location || localize("Local não informado", language)}
        {waiting && (
          <span
            aria-label={localize("Lista de espera", language)}
            className="waiting-game-icon"
          >
            ◷
          </span>
        )}
      </span>
      <span className="session-detail-time">
        {game.time}
        {!hideEndTime && <span className="session-detail-end-time"> – {game.endTime}</span>}
        {" "}({game.duration} {localize("min", language)})
      </span>
      {!game.cancelled && (
        <span className="session-detail-court">
          {court}
          {organizer && (
            <span className="game-owner-badge">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 3 14 8l5 .5-3.8 3.2 1.2 5.1-4.4-2.7-4.4 2.7 1.2-5.1L5 8.5 10 8l2-5Z" />
              </svg>
              {language === "pt" ? "Organizador" : "Organizer"}
            </span>
          )}
        </span>
      )}
      {game.cancelled && (
        <span className="session-detail-cancelled">
          {localize("CANCELADO", language)}
        </span>
      )}
    </p>
  );
}
