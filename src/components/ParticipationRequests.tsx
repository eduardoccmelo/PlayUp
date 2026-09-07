import type { GameSession, ParticipationRequest } from "../types";
import { localize, type Language } from "../i18n";
import { Header } from "./Header";

type ParticipationRequestsProps = {
  games: GameSession[];
  requests: ParticipationRequest[];
  onApprove: (request: ParticipationRequest) => void;
  onBack: () => void;
  language: Language;
};

function RequestGameDetails({
  game,
  language,
}: {
  game?: GameSession;
  language: Language;
}) {
  if (!game) {
    return <p className="request-game-details">{localize("Jogo não disponível", language)}</p>;
  }

  return (
    <p className="request-game-details">
      <span className="request-game-date">
        {game.date.split("-").reverse().join("/")}
      </span>
      <span className="request-game-time">{game.time}</span>
      <span className="request-game-location">{game.location}</span>
    </p>
  );
}

export function ParticipationRequests({
  games,
  requests,
  onApprove,
  onBack,
  language,
}: ParticipationRequestsProps) {
  const joinRequests = requests.filter(
    (request) => request.type !== "leave" && request.type !== "payment",
  );
  const leaveRequests = requests.filter((request) => request.type === "leave");
  const paymentRequests = requests.filter((request) => request.type === "payment");
  const gameFor = (request: ParticipationRequest) =>
    games.find((game) => game.id === request.gameId);

  return (
    <main className="app-shell requests-page">
      <Header backLabel={localize("Voltar", language)} onBack={onBack} />
      {joinRequests.length > 0 && (
        <section className="requests-section">
          <div className="requests-section-heading">
            <h1>
              {localize("Novos", language)} <em>{localize("jogadores", language)}</em>
            </h1>
            <p className="intro">
              {localize("Aprove cada nome para incluí-lo no cadastro geral.", language)}
            </p>
          </div>
          <section className="panel requests-list">
            {joinRequests.map((request) => (
              <article className="request-card" key={request.id}>
                <div>
                  <strong>{request.name}</strong>
                  <RequestGameDetails game={gameFor(request)} language={language} />
                </div>
                <button className="primary" onClick={() => onApprove(request)}>
                  {localize("Aprovar e cadastrar", language)}
                </button>
              </article>
            ))}
          </section>
        </section>
      )}
      {leaveRequests.length > 0 && (
        <section className="requests-section">
          <div className="requests-section-heading">
            <h1>
              {localize("Solicitações de", language)} <em>{localize("saída", language)}</em>
            </h1>
            <p className="intro">
              {localize("Aprove a saída para remover o jogador da lista do jogo.", language)}
            </p>
          </div>
          <section className="panel requests-list">
            {leaveRequests.map((request) => (
              <article className="request-card" key={request.id}>
                <div>
                  <strong>{request.name}</strong>
                  <RequestGameDetails game={gameFor(request)} language={language} />
                </div>
                <button className="primary" onClick={() => onApprove(request)}>
                  {localize("Aprovar saída", language)}
                </button>
              </article>
            ))}
          </section>
        </section>
      )}
      {paymentRequests.length > 0 && (
        <section className="requests-section">
          <div className="requests-section-heading">
            <h1>{localize("Confirmações de", language)} <em>{localize("pagamento", language)}</em></h1>
            <p className="intro">{localize("Revise os pagamentos informados pelos jogadores.", language)}</p>
          </div>
          <section className="panel requests-list">
            {paymentRequests.map((request) => (
              <article className="request-card" key={request.id}>
                <div>
                  <strong>{request.name}</strong>
                  <small className="request-payment-status">
                    {localize(
                      request.paymentConfirmed
                        ? "Pagamento confirmado pelo jogador."
                        : "Pagamento desmarcado pelo jogador.",
                      language,
                    )}
                  </small>
                  <RequestGameDetails game={gameFor(request)} language={language} />
                </div>
                <button className="primary" onClick={() => onApprove(request)}>
                  {localize("Marcar como lido", language)}
                </button>
              </article>
            ))}
          </section>
        </section>
      )}
    </main>
  );
}
