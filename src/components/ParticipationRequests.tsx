import type { GameSession, ParticipationRequest } from "../types";
import { localize, type Language } from "../i18n";
import { Header } from "./Header";

type ParticipationRequestsProps = {
  games: GameSession[];
  requests: ParticipationRequest[];
  onMarkRead: (request: ParticipationRequest) => void;
  onDismissAll: (requests: ParticipationRequest[]) => void;
  onBack: () => void;
  onProfile: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
};

function RequestGameDetails({ game, language }: { game?: GameSession; language: Language }) {
  if (!game) return <p className="request-game-details">{localize("Jogo não disponível", language)}</p>;

  return (
    <p className="request-game-details">
      <span className="request-game-date">{game.date.split("-").reverse().join("/")}</span>
      <span className="request-game-time">{game.time}</span>
      <span className="request-game-location">{game.location}</span>
    </p>
  );
}

/** Payment notifications for group administrators. Game-code access is direct. */
export function ParticipationRequests({
  games,
  requests,
  onMarkRead,
  onDismissAll,
  onBack,
  onProfile,
  language,
  onLanguageChange,
}: ParticipationRequestsProps) {
  const paymentRequests = requests.filter((request) => request.type === "payment");
  const gameFor = (request: ParticipationRequest) => games.find((game) => game.id === request.gameId);

  return (
    <main className="app-shell requests-page">
      <Header backLabel={localize("Voltar", language)} onBack={onBack} onProfile={onProfile} language={language} onLanguageChange={onLanguageChange} />
      <section className="requests-section">
        <div className="requests-section-heading">
          <h1>{localize("Confirmações de", language)} <em>{localize("pagamento", language)}</em></h1>
          <p className="intro">{localize("Revise os pagamentos informados pelos jogadores.", language)}</p>
          <button className="secondary" onClick={() => onDismissAll(paymentRequests)} type="button">
            {localize("Dispensar tudo", language)}
          </button>
        </div>
        <section className="panel requests-list">
          {paymentRequests.map((request) => (
            <article className="request-card" key={request.id}>
              <div>
                <strong>{request.name}</strong>
                <small className="request-payment-status">
                  {localize(request.paymentConfirmed ? "Pagamento confirmado pelo jogador." : "Pagamento desmarcado pelo jogador.", language)}
                </small>
                <RequestGameDetails game={gameFor(request)} language={language} />
              </div>
              <button className="primary" onClick={() => onMarkRead(request)} type="button">
                {localize("Marcar como lido", language)}
              </button>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
