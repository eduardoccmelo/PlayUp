import type { ParticipationRequest } from "../types";
import { localize, type Language } from "../i18n";
import { Header } from "./Header";

type ParticipationRequestsProps = {
  requests: ParticipationRequest[];
  onApprove: (request: ParticipationRequest) => void;
  onBack: () => void;
  language: Language;
};

export function ParticipationRequests({
  requests,
  onApprove,
  onBack,
  language,
}: ParticipationRequestsProps) {
  return (
    <main className="app-shell">
      <Header backLabel={localize("Voltar", language)} onBack={onBack} />
      <section className="hero requests-heading">
        <p className="eyebrow">{localize("Solicitações de participação", language)}</p>
        <h1>{localize("Novos", language)} <em>{localize("jogadores.", language)}</em></h1>
        <p className="intro">{localize("Aprove cada nome para incluí-lo no cadastro geral.", language)}</p>
      </section>
      <section className="panel requests-list">
        {requests.map((request) => (
          <article className="request-card" key={request.id}>
            <div>
              <strong>{request.name}</strong>
              <small>{localize("Solicitação de participação", language)}</small>
            </div>
            <button className="primary" onClick={() => onApprove(request)}>
              {localize("Aprovar e cadastrar", language)}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
