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
  const playerById = new Map(players.map((player) => [player.id, player]));
  const sortedPlayersFor = (playerIds: number[]) =>
    playerIds
      .map((playerId) => playerById.get(playerId))
      .filter((player): player is Player => Boolean(player));
  const listedPlayers = sortedPlayersFor(game.playerIds);
  const waitlistedPlayers = sortedPlayersFor(game.waitlistIds);

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
        {language === "pt" ? <>Lista do <em>jogo</em></> : <>Game <em>list</em></>}
      </h1>
      <EventSummary className="game-event-summary" game={game} language={language} />
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
              {listedPlayers.map((player, index) => {
                const isPaid = game.paidPlayerIds.includes(player.id);
                return (
                  <div className={`readonly-row ${isPaid ? "is-paid" : ""}`} key={player.id}>
                    <strong>
                      {index + 1} - {player.name}
                      {player.isGuest && (
                        <small className="player-identity-tag">
                          ({language === "pt" ? "Convidado" : "Guest"})
                        </small>
                      )}
                    </strong>
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
                {waitlistedPlayers.map((player, index) => (
                  <p className="wait-row" key={player.id}>
                    {game.playerIds.length + index + 1} - {player.name}
                    {player.isGuest && (
                      <small className="player-identity-tag">
                        ({language === "pt" ? "Convidado" : "Guest"})
                      </small>
                    )}
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
