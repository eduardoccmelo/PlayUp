import { localize, type Language } from "../i18n";
import type { GameSession, Player } from "../types";
import { hasGameEnded } from "../utils/game";
import { Header } from "./Header";

type GroupStatisticsProps = {
  groupName: string;
  games: GameSession[];
  language: Language;
  onBack: () => void;
  onLanguageChange: (language: Language) => void;
  onProfile: () => void;
  players: Player[];
};

export function GroupStatistics({
  groupName,
  games,
  language,
  onBack,
  onLanguageChange,
  onProfile,
  players,
}: GroupStatisticsProps) {
  const completedGames = games.filter(
    (game) => hasGameEnded(game) && !game.cancelled,
  );
  const playerStatistics = players
    .map((player) => ({
      player,
      participations: completedGames.filter((game) =>
        game.playerIds.includes(player.id),
      ).length,
    }))
    .sort(
      (first, second) =>
        second.participations - first.participations ||
        first.player.name.localeCompare(second.player.name, language === "pt" ? "pt-BR" : "en"),
    );
  const activeGames = games.filter(
    (game) => !hasGameEnded(game) && !game.cancelled,
  ).length;

  return (
    <main className="app-shell group-statistics-page">
      <Header
        backLabel={localize("Voltar", language)}
        language={language}
        onBack={onBack}
        onLanguageChange={onLanguageChange}
        onProfile={onProfile}
      />
      <section className="game-directory-heading statistics-heading">
        <div>
          <p className="group-context-name">{groupName}</p>
          <h1>{localize("Estatísticas", language)}</h1>
        </div>
      </section>
      <section className="statistics-summary" aria-label={localize("Estatísticas", language)}>
        <article>
          <span>{localize("Total de jogos", language)}</span>
          <strong>{games.length}</strong>
        </article>
        <article>
          <span>{localize("Jogos ativos", language)}</span>
          <strong>{activeGames}</strong>
        </article>
      </section>
      <h2 className="statistics-list-label">
        {localize("Participações por jogador", language)}
      </h2>
      <section className="panel statistics-player-list">
        {playerStatistics.map(({ player, participations }) => (
          <div className="statistics-player-row" key={player.id}>
            <strong>{player.name}</strong>
            <span>{participations}</span>
          </div>
        ))}
      </section>
    </main>
  );
}
