import type { GameSession } from "../types";
import { localize } from "../i18n";

type TeamsProps = {
  teams: GameSession["teams"];
  language: "pt" | "en";
  embedded?: boolean;
  showPositions?: boolean;
};

export function Teams({ teams, language, embedded = false, showPositions = true }: TeamsProps) {
  if (!teams) return null;

  const content = (
      <div
        className="teams"
        style={{ gridTemplateColumns: "1fr 1em 1fr", gridAutoFlow: "column" }}
      >
        <article className="team one">
          <h1 className="team-name">{localize("Equipe 1", language)}</h1>
          {teams.teamA.map((player) => (
            <p key={player.id}>
              {player.name}
              {showPositions && player.position === "goleiro" && " (G)"}
            </p>
          ))}
        </article>
        <div className="versus">vs</div>
        <article className="team two">
          <h1 className="team-name">{localize("Equipe 2", language)}</h1>
          {teams.teamB.map((player) => (
            <p key={player.id}>
              {player.name}
              {player.position === "goleiro" && " (G)"}
            </p>
          ))}
        </article>
      </div>
  );

  return embedded ? (
    content
  ) : (
    <section className="teams-section">
      {content}
    </section>
  );
}
