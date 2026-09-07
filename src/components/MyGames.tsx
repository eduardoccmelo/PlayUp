import { useState, type FormEvent } from "react";
import { localize, type Language } from "../i18n";
import type { GameSession } from "../types";
import { CompactGameDetails } from "./EventSummary";
import { Header } from "./Header";

type MyGamesProps = {
  games: GameSession[];
  language: Language;
  onBack: () => void;
  onRequestGame: () => void;
};

export function MyGames({ games, language, onBack, onRequestGame }: MyGamesProps) {
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setIsCodeModalOpen(false);
    setCode("");
    onRequestGame();
  };

  return (
    <main className="participant-page my-games-page">
      <Header backLabel={localize("Voltar", language)} onBack={onBack} onHome={onBack} />
      <section className="hero participant-games-heading">
        <h1>{localize("Meus", language)} <em>{localize("jogos", language)}</em></h1>
        <p className="intro">{localize("Jogos aos quais você foi convidado.", language)}</p>
      </section>
      <div className="create-game-action">
        <button className="secondary" onClick={() => setIsCodeModalOpen(true)}>
          {localize("Tenho um código de jogo", language)}
        </button>
      </div>
      <section className="panel participant-games-panel">
        {games.length ? (
          <div className="session-tabs participant-game-list">
            {games.map((game) => (
              <div className="session-row guest-game-row" key={game.id}>
                <CompactGameDetails game={game} language={language} />
                <div className="guest-game-status">
                  <strong>{localize("Aguardando aprovação", language)}</strong>
                  <span>{localize("As ações serão liberadas após a confirmação de um admin.", language)}</span>
                </div>
                <div className="session-row-actions">
                  <button className="session-action-button view">{localize("Ver", language)}</button>
                  <button className="session-action-button confirm" disabled>{localize("Participar", language)}</button>
                  <button className="session-action-button leave" disabled>{localize("Sair da lista", language)}</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">{localize("Você ainda não tem jogos salvos.", language)}</p>
        )}
      </section>
      {isCodeModalOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
            <p className="form-mode">{localize("ADICIONAR JOGO", language)}</p>
            <form onSubmit={submitCode}>
              <p>{localize("Cole o código do jogo para enviar uma solicitação ao admin.", language)}</p>
              <input autoFocus placeholder={localize("Código do jogo", language)} value={code} onChange={(event) => setCode(event.target.value)} />
              <div className="confirm-dialog-actions">
                <button className="secondary" type="button" onClick={() => setIsCodeModalOpen(false)}>{localize("Cancelar", language)}</button>
                <button className="primary">{localize("Continuar", language)}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
