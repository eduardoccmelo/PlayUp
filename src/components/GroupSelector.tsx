import { useState, type FormEvent } from "react";
import { SEED_GROUP_ID } from "../dev/seeds";
import { localize, type Language } from "../i18n";
import type { GameSession, PlayerGroup } from "../types";
import { normalizeText } from "../utils/game";
import { CompactGameDetails } from "./EventSummary";
import { Header } from "./Header";

type GroupAction = {
  group: PlayerGroup;
  type: "enter" | "change-passcode" | "delete";
  step: "verify" | "update-passcode" | "confirm-delete";
};

type GroupInvite = {
  group: PlayerGroup;
  type: "admin" | "participant";
};

type GroupSelectorProps = {
  groups: PlayerGroup[];
  language: Language;
  adminGroupIds: string[];
  onBack: () => void;
  onCreate: (name: string, passcode: string) => void;
  onChoose: (group: PlayerGroup) => void;
  onManage: (group: PlayerGroup) => void;
  onDelete: (groupId: string) => void;
  onChangePasscode: (groupId: string, passcode: string) => void;
  onRename: (groupId: string, name: string) => void;
  myGames: GameSession[];
  onAddMyGame: () => void;
  onOpenMyGame: (game: GameSession) => void;
  onLeaveMyGame: (game: GameSession) => void;
};

type PasswordFieldProps = {
  autoFocus?: boolean;
  minLength?: number;
  required?: boolean;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
  language: Language;
};

function PasswordField({
  autoFocus,
  minLength,
  required = true,
  onChange,
  placeholder,
  value,
  language,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const toggleLabel = localize(
    isVisible ? "Ocultar senha" : "Mostrar senha",
    language,
  );

  return (
    <div className="password-field">
      <input
        autoFocus={autoFocus}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        type={isVisible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        aria-label={toggleLabel}
        className="password-visibility"
        onClick={() => setIsVisible((visible) => !visible)}
        title={toggleLabel}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.5" />
          {!isVisible && <path d="m4 4 16 16" />}
        </svg>
      </button>
    </div>
  );
}

export function GroupSelector({
  groups,
  language,
  adminGroupIds,
  onBack,
  onCreate,
  onChoose,
  onManage,
  onDelete,
  onChangePasscode,
  onRename,
  myGames,
  onAddMyGame,
  onOpenMyGame,
  onLeaveMyGame,
}: GroupSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAddingGame, setIsAddingGame] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [gameCode, setGameCode] = useState("");
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [groupAction, setGroupAction] = useState<GroupAction | null>(null);
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [groupToRename, setGroupToRename] = useState<PlayerGroup | null>(null);
  const [groupToLeave, setGroupToLeave] = useState<PlayerGroup | null>(null);
  const [groupInvite, setGroupInvite] = useState<GroupInvite | null>(null);
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [gameToLeave, setGameToLeave] = useState<GameSession | null>(null);
  const [renamedGroupName, setRenamedGroupName] = useState("");
  const [editCurrentPasscode, setEditCurrentPasscode] = useState("");
  const [groupError, setGroupError] = useState("");

  const createGroup = (event: FormEvent) => {
    event.preventDefault();
    if (groups.length >= 3) {
      setGroupError("Você só pode criar até 3 grupos no momento.");
      return;
    }
    if (!name.trim() || !passcode.trim()) return;
    if (
      groups.some((group) => normalizeText(group.name) === normalizeText(name))
    ) {
      setGroupError("Já existe um grupo com esse nome.");
      return;
    }
    onCreate(name.trim(), passcode);
    setName("");
    setPasscode("");
    setIsCreating(false);
  };
  const joinGroup = (event: FormEvent) => {
    event.preventDefault();
    if (!joinCode.trim()) return;
    const group = groups[0];
    if (!group) return;
    setIsJoining(false);
    setJoinCode("");
    onChoose(group);
  };
  const addMyGame = (event: FormEvent) => {
    event.preventDefault();
    if (!gameCode.trim()) return;
    setGameCode("");
    setIsAddingGame(false);
    onAddMyGame();
  };
  const openGroupAction = (group: PlayerGroup, type: GroupAction["type"]) => {
    setCurrentPasscode("");
    setNewPasscode("");
    setPasscodeError("");
    setGroupAction({ group, type, step: "verify" });
  };
  const closeGroupAction = () => setGroupAction(null);
  const openRenameDialog = (group: PlayerGroup) => {
    setGroupError("");
    setGroupToRename(group);
    setRenamedGroupName(group.name);
    setNewPasscode("");
    setEditCurrentPasscode("");
  };
  const openGroupInvite = (group: PlayerGroup, type: GroupInvite["type"]) => {
    setInviteCodeCopied(false);
    setGroupInvite({ group, type });
  };
  const copyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setInviteCodeCopied(true);
    } catch {
      setInviteCodeCopied(false);
    }
  };

  return (
    <main className="app-shell group-selector-page">
      <Header backLabel={localize("Voltar", language)} onBack={onBack} />
      <section className="group-dashboard-section">
        <div className="game-directory-heading group-subsection-heading">
          <h1>
          {language === "pt" ? (
            <>
              Meus <em>grupos</em>
            </>
          ) : (
            <>
              My <em>groups</em>
            </>
          )}
          </h1>
          <div className="game-directory-actions">
            <button
              className="secondary"
              onClick={() => {
                setGroupError("");
                setIsCreating(true);
              }}
            >
              + {localize("Criar grupo", language)}
            </button>
            <button className="secondary" onClick={() => setIsJoining(true)}>
              {localize("Entrar em um grupo", language)}
            </button>
          </div>
        </div>
      </section>

      {isCreating && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog group-auth-modal"
            role="dialog"
          >
            <p className="form-mode">{localize("NOVO GRUPO", language)}</p>
            <form onSubmit={createGroup}>
              <input
                required
                maxLength={20}
                placeholder={localize("Nome do grupo", language)}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {groupError && (
                <small className="error">
                  {localize(groupError, language)}
                </small>
              )}
              <PasswordField
                language={language}
                minLength={4}
                placeholder={localize("Senha dos organizadores", language)}
                value={passcode}
                onChange={setPasscode}
              />
              <div className="confirm-dialog-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setIsCreating(false)}
                >
                  {localize("Cancelar", language)}
                </button>
                <button className="primary">
                  {localize("Criar grupo", language)}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {isJoining && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog group-auth-modal"
            role="dialog"
          >
            <p className="form-mode">{localize("ENTRAR EM GRUPO", language)}</p>
            <form onSubmit={joinGroup}>
              <p>
                {localize("Insira o código do grupo para continuar.", language)}
              </p>
              <input
                autoFocus
                required
                placeholder={localize("Código do grupo", language)}
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value)}
              />
              <small className="success">
                {localize("Acesso liberado nesta demonstração.", language)}
              </small>
              <div className="confirm-dialog-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setIsJoining(false)}
                >
                  {localize("Cancelar", language)}
                </button>
                <button className="primary">
                  {localize("Continuar", language)}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {isAddingGame && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog group-auth-modal"
            role="dialog"
          >
            <p className="form-mode">{localize("ADICIONAR JOGO", language)}</p>
            <form onSubmit={addMyGame}>
              <p>
                {localize(
                  "Cole o código do jogo para enviar uma solicitação ao admin.",
                  language,
                )}
              </p>
              <input
                autoFocus
                required
                placeholder={localize("Código do jogo", language)}
                value={gameCode}
                onChange={(event) => setGameCode(event.target.value)}
              />
              <small className="success">
                {localize("Acesso liberado nesta demonstração.", language)}
              </small>
              <div className="confirm-dialog-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setIsAddingGame(false)}
                >
                  {localize("Cancelar", language)}
                </button>
                <button className="primary">
                  {localize("Continuar", language)}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="group-dashboard-section">
        <section className="panel group-list">
          {groups.length ? (
            groups.map((group) => {
            const isAdmin = adminGroupIds.includes(group.id);
            return (
              <article className="group-row" key={group.id}>
                <div>
                  <div className="group-name-line">
                    <strong>{group.name}</strong>
                    {isAdmin && <span className="group-admin-badge">Admin</span>}
                  </div>
                  <small>
                    {localize("Código do grupo", language)}: {group.id}
                  </small>
                </div>
                <div className="group-row-actions">
                  <button
                    className="session-action-button view"
                    onClick={() => onChoose(group)}
                  >
                    {localize("Ver jogos", language)}
                  </button>
                  {!isAdmin && (
                    <button
                      className="secondary"
                      onClick={() => setGroupToLeave(group)}
                    >
                      {localize("Sair do grupo", language)}
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        className="primary"
                        onClick={() => onManage(group)}
                      >
                        {localize("Gerenciar", language)}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => openRenameDialog(group)}
                      >
                        {localize("Editar", language)}
                      </button>
                      <button
                        className="primary"
                        onClick={() =>
                          openGroupInvite(group, "participant")
                        }
                      >
                        {localize("Compartilhar", language)}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => openGroupInvite(group, "admin")}
                      >
                        {localize("Convidar admins", language)}
                      </button>
                      <button
                        className="session-action-button delete"
                        onClick={() => openGroupAction(group, "delete")}
                      >
                        {localize("Deletar", language)}
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
            })
          ) : (
            <p className="empty">{localize("Nenhum grupo criado.", language)}</p>
          )}
        </section>
      </section>
      {
        <section className="my-games-section">
          <div className="game-directory-heading group-subsection-heading">
            <div>
              <h1>
                {language === "pt" ? (
                  <>
                    Meus <em>próximos jogos</em>
                  </>
                ) : (
                  <>
                    My <em>next games</em>
                  </>
                )}
              </h1>
            </div>
            <div className="game-directory-actions">
              <button className="secondary" onClick={() => setIsAddingGame(true)}>
                {localize("Tenho um código de jogo", language)}
              </button>
            </div>
          </div>
          <section className="panel group-list my-games-list">
            {myGames.length ? (
              <div className="session-tabs participant-game-list">
                {myGames.map((game) => (
                  <div className="session-row guest-game-row" key={game.id}>
                    <CompactGameDetails
                      game={game}
                      hideEndTime
                      language={language}
                    />
                    <div className="session-row-actions">
                      <button
                        className="session-action-button view"
                        onClick={() => onOpenMyGame(game)}
                      >
                        {localize("Ver", language)}
                      </button>
                      <button
                        className="session-action-button leave"
                        onClick={() => setGameToLeave(game)}
                      >
                        {localize("Sair da lista", language)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty">
                {localize("Você ainda não tem jogos salvos.", language)}
              </p>
            )}
          </section>
        </section>
      }
      {groupToRename && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog group-auth-modal"
            role="dialog"
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const nextName = renamedGroupName.trim();
                if (!nextName) return;
                if (
                  groups.some(
                    (group) =>
                      group.id !== groupToRename.id &&
                      normalizeText(group.name) === normalizeText(nextName),
                  )
                ) {
                  setGroupError("Já existe um grupo com esse nome.");
                  return;
                }
                if (
                  newPasscode.trim() &&
                  editCurrentPasscode !== groupToRename.organizerPasscode
                ) {
                  setGroupError("Senha atual incorreta.");
                  return;
                }
                if (nextName !== groupToRename.name) {
                  onRename(groupToRename.id, nextName);
                }
                if (newPasscode.trim()) {
                  onChangePasscode(groupToRename.id, newPasscode);
                }
                setNewPasscode("");
                setEditCurrentPasscode("");
                setGroupToRename(null);
              }}
            >
              <p className="form-mode">{localize("EDITAR GRUPO", language)}</p>
              <input
                autoFocus
                required
                maxLength={20}
                placeholder={localize("Nome do grupo", language)}
                value={renamedGroupName}
                onChange={(event) => setRenamedGroupName(event.target.value)}
              />
              {groupError && (
                <small className="error">
                  {localize(groupError, language)}
                </small>
              )}
              <PasswordField
                language={language}
                placeholder={localize(
                  "Senha atual (obrigatória para trocar)",
                  language,
                )}
                required={Boolean(newPasscode.trim())}
                value={editCurrentPasscode}
                onChange={setEditCurrentPasscode}
              />
              <PasswordField
                language={language}
                minLength={4}
                placeholder={localize("Nova senha (opcional)", language)}
                required={false}
                value={newPasscode}
                onChange={setNewPasscode}
              />
              <div className="confirm-dialog-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setNewPasscode("");
                    setEditCurrentPasscode("");
                    setGroupToRename(null);
                  }}
                >
                  {localize("Cancelar", language)}
                </button>
                <button className="primary">
                  {localize("Salvar", language)}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {groupToLeave && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog group-auth-modal"
            role="dialog"
          >
            <p className="form-mode">{localize("SAIR DO GRUPO", language)}</p>
            <p>
              {localize("Você deixará de ver os jogos deste grupo.", language)}
            </p>
            <div className="confirm-dialog-actions">
              <button
                className="secondary"
                onClick={() => setGroupToLeave(null)}
              >
                {localize("Cancelar", language)}
              </button>
              <button
                className="session-action-button delete"
                onClick={() => setGroupToLeave(null)}
              >
                {localize("Sair do grupo", language)}
              </button>
            </div>
          </section>
        </div>
      )}
      {gameToLeave && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog group-auth-modal"
            role="dialog"
          >
            <p className="form-mode">{localize("Sair da lista", language)}</p>
            <p>{localize("Deseja sair da lista deste jogo?", language)}</p>
            <div className="confirm-dialog-actions">
              <button className="secondary" onClick={() => setGameToLeave(null)}>
                {localize("Cancelar", language)}
              </button>
              <button
                className="session-action-button leave"
                onClick={() => {
                  onLeaveMyGame(gameToLeave);
                  setGameToLeave(null);
                }}
              >
                {localize("Sair da lista", language)}
              </button>
            </div>
          </section>
        </div>
      )}
      {groupInvite && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog group-auth-modal invite-modal"
            role="dialog"
          >
            <p className="form-mode">
              {localize(
                groupInvite.type === "admin"
                  ? "CONVITE DE ADMIN"
                  : "CONVITE PARA O GRUPO",
                language,
              )}
            </p>
            <p>
              {localize(
                groupInvite.type === "admin"
                  ? "Este convite pede a senha do grupo antes de liberar o acesso de admin."
                  : "Este convite libera a visualização dos jogos ativos do grupo.",
                language,
              )}
            </p>
            <input readOnly value={`PLAYUP-GROUP-${groupInvite.group.id}`} />
            <small className="success">
              {localize(
                inviteCodeCopied
                  ? "Código copiado."
                  : "Copie este código e envie ao convidado.",
                language,
              )}
            </small>
            <div className="confirm-dialog-actions">
              <button
                className="session-action-button delete"
                onClick={() => setGroupInvite(null)}
              >
                {localize("Fechar", language)}
              </button>
              <button
                className="primary"
                onClick={() => copyInviteCode(`PLAYUP-GROUP-${groupInvite.group.id}`)}
              >
                {localize("Copiar código", language)}
              </button>
            </div>
          </section>
        </div>
      )}
      {groupAction && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog group-auth-modal"
            role="dialog"
          >
            {groupAction.step === "verify" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (currentPasscode !== groupAction.group.organizerPasscode) {
                    setPasscodeError("Senha atual incorreta.");
                    return;
                  }
                  setPasscodeError("");
                  if (groupAction.type === "enter") {
                    onChoose(groupAction.group);
                    closeGroupAction();
                    return;
                  }
                  setGroupAction({
                    ...groupAction,
                    step:
                      groupAction.type === "delete"
                        ? "confirm-delete"
                        : "update-passcode",
                  });
                }}
              >
                <h2>
                  {localize(
                    groupAction.type === "enter"
                      ? "Entrar como organizador"
                      : "Confirmar senha",
                    language,
                  )}
                </h2>
                <p>
                  {localize(
                    "Digite a senha atual dos organizadores para continuar.",
                    language,
                  )}
                </p>
                <PasswordField
                  autoFocus
                  language={language}
                  placeholder={localize("Senha atual", language)}
                  value={currentPasscode}
                  onChange={setCurrentPasscode}
                />
                {groupAction.type === "enter" &&
                  groupAction.group.id === SEED_GROUP_ID && (
                    <small className="error">
                      {localize("Dica de senha: admin", language)}
                    </small>
                  )}
                {passcodeError && (
                  <small className="error">
                    {localize(passcodeError, language)}
                  </small>
                )}
                <div className="confirm-dialog-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={closeGroupAction}
                  >
                    {localize("Cancelar", language)}
                  </button>
                  <button className="primary">
                    {localize("Continuar", language)}
                  </button>
                </div>
              </form>
            )}
            {groupAction.step === "update-passcode" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!newPasscode.trim()) return;
                  onChangePasscode(groupAction.group.id, newPasscode);
                  closeGroupAction();
                }}
              >
                <h2>{localize("Alterar senha", language)}</h2>
                <p>{groupAction.group.name}</p>
                <PasswordField
                  autoFocus
                  language={language}
                  minLength={4}
                  placeholder={localize("Nova senha", language)}
                  value={newPasscode}
                  onChange={setNewPasscode}
                />
                <div className="confirm-dialog-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={closeGroupAction}
                  >
                    {localize("Cancelar", language)}
                  </button>
                  <button className="primary">
                    {localize("Salvar", language)}
                  </button>
                </div>
              </form>
            )}
            {groupAction.step === "confirm-delete" && (
              <>
                <h2>{localize("Excluir grupo", language)}</h2>
                <p>
                  {localize(
                    "Todos os jogos e jogadores deste grupo serão apagados.",
                    language,
                  )}
                </p>
                <div className="confirm-dialog-actions">
                  <button className="secondary" onClick={closeGroupAction}>
                    {localize("Cancelar", language)}
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => {
                      onDelete(groupAction.group.id);
                      closeGroupAction();
                    }}
                  >
                    {localize("Excluir grupo", language)}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
