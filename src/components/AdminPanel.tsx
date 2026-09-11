import { useState } from "react";
import type { CurrentUser, PlayerGroup } from "../types";
import { localize, type Language } from "../i18n";
import { Header } from "./Header";

type AdminPanelProps = {
  group: PlayerGroup;
  user: CurrentUser;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onBack: () => void;
  onProfile: () => void;
  onLeaveGroup: () => boolean;
  onDeleteGroup: (passcode: string) => boolean;
  onRemoveAdmin: (userId: string) => void;
  onCreateInvite: (playerId: number) => string;
  onVote: (playerId: number, field: "level" | "mobility", value: number | null) => void;
  onStatistics: () => void;
};

const mobilityFromScore = (value: number) =>
  value === 1 ? "lento" : value === 3 ? "rapido" : "neutro";

export function AdminPanel({
  group,
  user,
  language,
  onLanguageChange,
  onBack,
  onProfile,
  onLeaveGroup,
  onDeleteGroup,
  onRemoveAdmin,
  onCreateInvite,
  onVote,
  onStatistics,
}: AdminPanelProps) {
  const admins = group.admins ?? [];
  const adminUserIds = new Set(admins.map((admin) => admin.userId));
  const currentAdmin = admins.find((admin) => admin.userId === user.id);
  const isOwnPlayer = (player: PlayerGroup["players"][number]) =>
    player.ownerUserId === user.id || currentAdmin?.playerId === player.id;
  const eligiblePlayers = group.players
    .filter((player) => player.accessScope !== "game")
    .sort((first, second) => Number(isOwnPlayer(first)) - Number(isOwnPlayer(second)));
  const [lastInvite, setLastInvite] = useState<string>("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletePasscode, setDeletePasscode] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const inviteCandidates = eligiblePlayers.filter(
    (player) => !adminUserIds.has(player.ownerUserId ?? ""),
  );
  const [selectedInvitePlayerId, setSelectedInvitePlayerId] = useState<number | null>(
    inviteCandidates[0]?.id ?? null,
  );

  return (
    <main className="app-shell admin-panel-page">
      <Header
        backLabel={localize("Voltar", language)}
        onBack={onBack}
        onHome={onBack}
        onProfile={onProfile}
        language={language}
        onLanguageChange={onLanguageChange}
      />
      <section className="admin-panel-heading">
        <div className="admin-panel-title-row">
          <div>
            <p className="page-group-name">{group.name}</p>
            <h1>
              {language === "pt" ? <>Painel do <em>admin</em></> : <>Admin <em>panel</em></>}
            </h1>
          </div>
          <div className="admin-panel-header-actions">
            <button className="session-action-button view" onClick={onStatistics}>
              {localize("Estatísticas", language)}
            </button>
            <button
              className="secondary"
              disabled={!inviteCandidates.length}
              onClick={() => {
                setSelectedInvitePlayerId(inviteCandidates[0]?.id ?? null);
                setLastInvite("");
                setIsInviteOpen(true);
              }}
            >
              {localize("Convidar admin", language)}
            </button>
            {admins.some(
              (admin) => admin.userId === user.id && admin.role === "owner",
            ) && (
              <button
                className="primary admin-panel-delete-button"
                onClick={() => {
                  setDeletePasscode("");
                  setDeleteError("");
                  setIsDeleteOpen(true);
                }}
              >
                {localize("Deletar grupo", language)}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="panel admin-panel-section">
        <h2>{localize("Admins do grupo", language)}</h2>
        {admins.map((admin) => (
          <div className="admin-panel-row" key={admin.userId}>
            <span>
              <strong>{admin.displayName}</strong>
              <small>{localize(admin.role === "owner" ? "Criador" : "Administrador", language)}</small>
            </span>
            {admin.userId === user.id ? (
              <span className="admin-panel-actions">
                <button className="session-action-button delete" onClick={() => setIsLeaveOpen(true)}>
                  {localize("Sair do grupo", language)}
                </button>
              </span>
            ) : admin.role !== "owner" && admins.length > 1 && (
              <button className="session-action-button delete" onClick={() => onRemoveAdmin(admin.userId)}>
                {localize("Remover", language)}
              </button>
            )}
          </div>
        ))}
      </section>

      <section className="panel admin-panel-section skill-voting-section">
        <h2>{localize("Votação de atributos", language)}</h2>
        <p className="admin-panel-help">{localize("Cada voto atualiza a média imediatamente. Você não pode ver nem votar seu próprio nível ou velocidade.", language)}</p>
        {eligiblePlayers.map((player) => {
          const isSelf = isOwnPlayer(player);
          const votes = (group.skillVotes ?? []).filter((vote) => vote.playerId === player.id);
          const levelVotes = votes.filter((vote) => vote.level !== undefined);
          const speedVotes = votes.filter((vote) => vote.mobility !== undefined);
          const averageLevel = levelVotes.length ? levelVotes.reduce((sum, vote) => sum + (vote.level ?? 0), 0) / levelVotes.length : null;
          const averageSpeed = speedVotes.length ? speedVotes.reduce((sum, vote) => sum + (vote.mobility ?? 0), 0) / speedVotes.length : null;
          const ownVote = votes.find((vote) => vote.adminUserId === user.id);
          const eligibleAdminCount = admins.filter(
            (admin) => admin.playerId !== player.id && admin.userId !== player.ownerUserId,
          ).length;
          return (
            <article className="skill-vote-row" key={player.id}>
              <div className="skill-vote-player">
                <strong>{player.name}</strong>
                {isSelf ? (
                  <small>{localize("Seu nível e velocidade são definidos pelos outros admins.", language)}</small>
                ) : (
                  <small>{levelVotes.length || speedVotes.length ? <>{localize("Média atual", language)}: {averageLevel?.toFixed(1) ?? "—"} · {averageSpeed ? localize(mobilityFromScore(Math.round(averageSpeed)), language) : "—"} · {localize("Votos", language)}: {levelVotes.length}/{eligibleAdminCount}</> : localize("Sem votos ainda", language)}</small>
                )}
              </div>
              {!isSelf && (
                <div className="skill-vote-controls">
                  <fieldset>
                    <legend>{localize("Nível", language)}</legend>
                    {[1, 2, 3, 4, 5].map((value) => <button className={ownVote?.level === value ? "selected" : ""} key={value} onClick={() => onVote(player.id, "level", ownVote?.level === value ? null : value)}>{value}</button>)}
                  </fieldset>
                  <span aria-hidden="true" className="skill-vote-divider" />
                  <fieldset>
                    <legend>{localize("Velocidade", language)}</legend>
                    {[1, 2, 3].map((value) => <button className={ownVote?.mobility === value ? "selected" : ""} key={value} onClick={() => onVote(player.id, "mobility", ownVote?.mobility === value ? null : value)}>{value}</button>)}
                  </fieldset>
                </div>
              )}
            </article>
          );
        })}
      </section>
      {isInviteOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
            <p className="form-mode">{localize("CONVIDAR ADMIN", language)}</p>
            <p className="admin-panel-help">{localize("Gere um código individual para um participante existente. O convite mantém a participação atual e libera o papel de admin após a confirmação.", language)}</p>
            {lastInvite && <p className="success">{localize("Código de convite", language)}: <strong>{lastInvite}</strong></p>}
            <label className="profile-field">
              {localize("Jogador", language)}
              <select
                value={selectedInvitePlayerId ?? ""}
                onChange={(event) => setSelectedInvitePlayerId(Number(event.target.value))}
              >
                {inviteCandidates.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
              </select>
            </label>
            <div className="confirm-dialog-actions">
              <button className="secondary" onClick={() => setIsInviteOpen(false)}>{localize(lastInvite ? "Fechar" : "Cancelar", language)}</button>
              <button
                className="primary"
                disabled={!selectedInvitePlayerId || Boolean(lastInvite)}
                onClick={() => {
                  if (!selectedInvitePlayerId) return;
                  setLastInvite(onCreateInvite(selectedInvitePlayerId));
                }}
              >
                {localize("Gerar convite", language)}
              </button>
            </div>
          </section>
        </div>
      )}
      {isLeaveOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
            <p className="form-mode">{localize("SAIR DO GRUPO", language)}</p>
            <p>{localize("Você deixará de ver os jogos deste grupo.", language)}</p>
            <div className="confirm-dialog-actions">
              <button className="secondary" onClick={() => setIsLeaveOpen(false)}>{localize("Cancelar", language)}</button>
              <button className="session-action-button delete" onClick={() => { if (onLeaveGroup()) setIsLeaveOpen(false); }}>{localize("Sair do grupo", language)}</button>
            </div>
          </section>
        </div>
      )}
      {isDeleteOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
            <p className="form-mode">{localize("EXCLUIR GRUPO", language)}</p>
            <p>{localize("Esta ação não pode ser desfeita.", language)}</p>
            <label className="profile-field">
              {localize("Senha atual", language)}
              <input autoFocus type="password" value={deletePasscode} onChange={(event) => { setDeletePasscode(event.target.value); setDeleteError(""); }} />
            </label>
            {deleteError && <small className="error">{localize(deleteError, language)}</small>}
            <div className="confirm-dialog-actions">
              <button className="secondary" onClick={() => setIsDeleteOpen(false)}>{localize("Cancelar", language)}</button>
              <button className="session-action-button delete" onClick={() => { if (!onDeleteGroup(deletePasscode)) setDeleteError("Senha atual incorreta."); }}>{localize("Deletar grupo", language)}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
