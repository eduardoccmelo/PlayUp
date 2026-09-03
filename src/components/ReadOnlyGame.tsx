import type { GameSession, Player } from "../types";
import { localize } from "../i18n";
import { currencySymbol, pricePerPlayer } from "../utils/game";
import { Teams } from "./Teams";
import { EventSummary } from "./EventSummary";

type ReadOnlyGameProps = {
  game: GameSession;
  players: Player[];
  language: "pt" | "en";
  onDelete?: () => void;
};

export function ReadOnlyGame({ game, players, language, onDelete }: ReadOnlyGameProps) {
  const paidPlayers = game.paidPlayerIds.filter((playerId) =>
    game.playerIds.includes(playerId),
  );

  return (
    <section className="participant-dashboard past-game readonly-game-view">
      {game.cancelled && <p className="game-cancelled">{localize("CANCELADO", language)}</p>}
      {onDelete && (
        <div className="game-actions">
          <button className="text-button danger" onClick={onDelete}>
            {localize("Excluir jogo", language)}
          </button>
        </div>
      )}
      <h1>
        {language === "pt" ? <>Lista do <em>jogo.</em></> : <>Game <em>list.</em></>}
      </h1>
      <EventSummary className="intro" game={game} language={language} />
      {game.disclaimer && <p className="game-disclaimer"><strong>{localize("Aviso", language)}:</strong> {game.disclaimer}</p>}
      <section className="stat-grid readonly-stat-grid">
        <div>
          <strong>{game.playerIds.length}/{game.maxPlayers}</strong>
          <span>{localize("na lista", language)}</span>
        </div>
        <div>
          <strong>{game.waitlistIds.length}</strong>
          <span>{localize("lista de espera", language)}</span>
        </div>
        <div>
          <strong>{paidPlayers.length}</strong>
          <span>{localize("pagos / confirmados", language)}</span>
        </div>
        <div>
          <strong>{currencySymbol(game.currency)} {pricePerPlayer(game).toFixed(2)}</strong>
          <span>{localize("por jogador", language)}</span>
        </div>
      </section>
      <div className={`participant-grid ${game.teams ? "" : "without-teams"}`}>
        <section className="panel readonly-list">
          {game.playerIds.length === 0 ? (
            <p className="empty readonly-empty">{localize("A lista está vazia.", language)}</p>
          ) : (
            <>
              <h2>{localize("Participantes", language)} ({game.playerIds.length}/{game.maxPlayers})</h2>
              {game.playerIds.map((playerId, index) => {
                const player = players.find((item) => item.id === playerId);
                const isPaid = game.paidPlayerIds.includes(playerId);
                return (
                  <div className={`readonly-row ${isPaid ? "is-paid" : ""}`} key={playerId}>
                    <strong>{index + 1} - {player?.name}</strong>
                    <span
                      aria-label={localize(isPaid ? "Pago" : "Pendente", language)}
                      className={`readonly-payment-mark ${isPaid ? "paid" : "pending"}`}
                    >
                      {isPaid ? "✓" : "×"}
                    </span>
                  </div>
                );
              })}
              <section className="waiting-list">
                <p className="waiting-list-label">{localize("LISTA DE ESPERA", language)}</p>
                {game.waitlistIds.map((playerId, index) => (
                  <p className="wait-row" key={playerId}>
                    {game.playerIds.length + index + 1} - {players.find((item) => item.id === playerId)?.name}
                  </p>
                ))}
              </section>
            </>
          )}
        </section>
        {game.teams && (
          <section className="participant-teams">
            <Teams teams={game.teams} language={language} />
          </section>
        )}
      </div>
    </section>
  );
}
