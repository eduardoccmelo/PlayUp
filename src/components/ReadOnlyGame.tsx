import type { GameSession, Player } from "../types";
import { localize } from "../i18n";
import { currencySymbol, gameLabel, pricePerPlayer } from "../utils/game";
import { Teams } from "./Teams";

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
      <p className="eyebrow">{localize("EVENTO", language)}</p>
      <h1>
        {language === "pt" ? <>Lista do <em>jogo.</em></> : <>Game <em>list.</em></>}
      </h1>
      <p className="intro">
        {gameLabel(game)} – {game.endTime} · ({game.duration} {localize("minutos", language)}) ·{" "}
        {localize("Quadra", language)} {game.courtNumber} · {currencySymbol(game.currency)}{" "}
        {pricePerPlayer(game).toFixed(2)} {localize("por pessoa", language)} ·{" "}
        {game.location || localize("Local não informado", language)}
        {game.cancelled && <> · ({localize("CANCELADO", language)})</>}
      </p>
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
      <div className="participant-grid">
        <section className="panel readonly-list">
          <h2>{localize("Participantes", language)} ({game.playerIds.length}/{game.maxPlayers})</h2>
          {game.playerIds.map((playerId, index) => {
            const player = players.find((item) => item.id === playerId);
            const isPaid = game.paidPlayerIds.includes(playerId);
            return (
              <div className="readonly-row" key={playerId}>
                <strong>{index + 1} - {player?.name}</strong>
                <span className={`payment ${isPaid ? "paid" : ""}`}>
                  {localize(isPaid ? "Pago" : "Pendente", language)}
                </span>
              </div>
            );
          })}
          <h2 className="wait-title">{localize("Lista de espera", language)}</h2>
          {game.waitlistIds.map((playerId, index) => (
            <p className="wait-row" key={playerId}>
              {game.playerIds.length + index + 1} - {players.find((item) => item.id === playerId)?.name}
            </p>
          ))}
        </section>
        <section className="participant-teams">{game.teams && <Teams teams={game.teams} language={language} />}</section>
      </div>
    </section>
  );
}
