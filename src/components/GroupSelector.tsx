import { useState, type FormEvent } from "react";
import { SEED_GROUP_ID } from "../dev/seeds";
import { localize, type Language } from "../i18n";
import type { CurrentUser, GameSession, PlayerGroup } from "../types";
import { hasGameEnded, normalizeText, weekdayName } from "../utils/game";
import {
  gameInviteCode,
  groupAdminInviteCode,
  groupPlayerInviteCode,
} from "../utils/inviteCodes";
import { Header } from "./Header";

type GroupAction = {
  group: PlayerGroup;
  type: "enter" | "change-passcode" | "delete";
  step: "verify" | "update-passcode" | "confirm-delete";
};

type GroupInvite = {
  group: PlayerGroup;
  canInviteAdmins: boolean;
};

type GroupSelectorProps = {
  groups: PlayerGroup[];
  user: CurrentUser | null;
  language: Language;
  onLanguageChange: (language: Language) => void;
  adminGroupIds: string[];
  onBack: () => void;
  onProfile: () => void;
  onCreate: (name: string, passcode: string) => void;
  onChoose: (group: PlayerGroup) => void;
  onDelete: (groupId: string) => void;
  onChangePasscode: (groupId: string, passcode: string) => void;
  onRename: (groupId: string, name: string) => void;
  myGames: GameSession[];
  onJoinGroup: (code: string, passcode: string) => string | null;
  onAddMyGame: (code: string) => string | null;
  onOpenMyGame: (game: GameSession) => void;
  onLeaveMyGame: (game: GameSession) => void;
  onLeaveGroup: (group: PlayerGroup) => void;
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

function OrganizerBadge({ language }: { language: Language }) {
  return (
    <span className="game-owner-badge">
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3 14 8l5 .5-3.8 3.2 1.2 5.1-4.4-2.7-4.4 2.7 1.2-5.1L5 8.5 10 8l2-5Z" />
      </svg>
      {language === "pt" ? "Organizador" : "Organizer"}
    </span>
  );
}

function GameAdminBadge() {
  return (
    <span className="game-admin-badge">
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3 20 6v5c0 5-3.4 8.1-8 10-4.6-1.9-8-5-8-10V6l8-3Z" />
        <path d="M9 12.5 11 14.5l4-4" />
      </svg>
      Admin
    </span>
  );
}

function MyGameDetails({
  game,
  language,
  isOwner,
  isAdmin,
}: {
  game: GameSession;
  language: Language;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const weekday = weekdayName(game.date, language === "pt" ? "pt-BR" : "en-GB");
  const shortWeekday = weekday
    .slice(0, 3)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const court = game.courtNumber.trim()
    ? `${localize("Quadra", language)} ${game.courtNumber}`
    : "";

  return (
    <div className="my-game-details">
      <strong>
        {game.date.split("-").reverse().join("/")} (
        <span className="weekday-name-full">{weekday}</span>
        <span className="weekday-name-short">{shortWeekday}</span>) · {game.location || localize("Local não informado", language)}
      </strong>
      <small>
        {game.time}{!isOwner && <> – {game.endTime}</>} ({game.duration} {localize("min", language)})
        {court && ` · ${court}`}
        {isOwner && <OrganizerBadge language={language} />}
        {isAdmin && <GameAdminBadge />}
      </small>
    </div>
  );
}

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
  user,
  language,
  onLanguageChange,
  adminGroupIds,
  onBack,
  onProfile,
  onCreate,
  onChoose,
  onDelete,
  onChangePasscode,
  onRename,
  myGames,
  onJoinGroup,
  onAddMyGame,
  onOpenMyGame,
  onLeaveMyGame,
  onLeaveGroup,
}: GroupSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isAddingGame, setIsAddingGame] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinPasscode, setJoinPasscode] = useState("");
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
  const [inviteCodeCopied, setInviteCodeCopied] = useState<"players" | "admins" | null>(null);
  const [gameToLeave, setGameToLeave] = useState<GameSession | null>(null);
  const [renamedGroupName, setRenamedGroupName] = useState("");
  const [editCurrentPasscode, setEditCurrentPasscode] = useState("");
  const [groupError, setGroupError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [gameCodeError, setGameCodeError] = useState("");
  const memberGroups = groups.filter(
    (group) =>
      !(user?.leftGroupIds ?? []).includes(group.id) &&
      (adminGroupIds.includes(group.id) ||
      group.players.some(
        (player) =>
          player.ownerUserId === user?.id ||
          (user !== null &&
            normalizeText(player.name) === normalizeText(user.displayName)),
      )),
  );
  const adminGroupFromCode = groups.find((group) =>
    normalizeText(joinCode) === normalizeText(groupAdminInviteCode(group)),
  );
  const availableGroups = groups
    .filter((group) => !memberGroups.some((memberGroup) => memberGroup.id === group.id))
    .slice(0, 5);
  const availableGames = groups
    .flatMap((group) => group.games.map((game) => ({ group, game })))
    .filter(
      ({ game }) =>
        !hasGameEnded(game) &&
        !myGames.some((myGame) => myGame.id === game.id),
    )
    .slice(0, 5);

  const createGroup = (event: FormEvent) => {
    event.preventDefault();
    if (memberGroups.length >= 5) {
      setGroupError("Você pode participar de até 5 grupos no momento.");
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
    const error = onJoinGroup(joinCode, joinPasscode);
    if (error) {
      setJoinError(error);
      return;
    }
    setIsJoining(false);
    setJoinCode("");
    setJoinPasscode("");
    setJoinError("");
  };
  const addMyGame = (event: FormEvent) => {
    event.preventDefault();
    const error = onAddMyGame(gameCode);
    if (error) {
      setGameCodeError(error);
      return;
    }
    setGameCode("");
    setIsAddingGame(false);
    setGameCodeError("");
  };
  const closeGroupAction = () => setGroupAction(null);
  const openGroupInvite = (group: PlayerGroup, canInviteAdmins: boolean) => {
    setInviteCodeCopied(null);
    setGroupInvite({ group, canInviteAdmins });
  };
  const copyInviteCode = async (code: string, type: "players" | "admins") => {
    try {
      await navigator.clipboard.writeText(code);
      setInviteCodeCopied(type);
    } catch {
      setInviteCodeCopied(null);
    }
  };

  return (
    <main className="app-shell group-selector-page">
      <Header backLabel={localize("Voltar", language)} onBack={onBack} onProfile={onProfile} language={language} onLanguageChange={onLanguageChange} />
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
            <button className="secondary" onClick={() => { setJoinError(""); setIsJoining(true); }}>
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
                onChange={(event) => {
                  setJoinCode(event.target.value);
                  setJoinPasscode("");
                  setJoinError("");
                }}
              />
              {adminGroupFromCode && (
                <>
                  <PasswordField
                    autoFocus
                    language={language}
                    placeholder={localize("Senha dos organizadores", language)}
                    value={joinPasscode}
                    onChange={(value) => {
                      setJoinPasscode(value);
                      setJoinError("");
                    }}
                  />
                  <small className="error">
                    {(language === "pt"
                      ? "Dica de senha (seed): "
                      : "Seed passcode hint: ") +
                      adminGroupFromCode.organizerPasscode}
                  </small>
                </>
              )}
              {joinError && <small className="error">{localize(joinError, language)}</small>}
              <div className="confirm-dialog-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    setJoinPasscode("");
                    setIsJoining(false);
                  }}
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
              onChange={(event) => { setGameCode(event.target.value); setGameCodeError(""); }}
            />
              {gameCodeError && <small className="error">{localize(gameCodeError, language)}</small>}
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
          {memberGroups.length ? (
            memberGroups.map((group) => {
            const isAdmin = adminGroupIds.includes(group.id);
            return (
              <article className={`group-row${isAdmin ? " admin-group-row" : ""}`} key={group.id}>
                <div>
                  <div className="group-name-line">
                    <strong>{group.name}</strong>
                    {isAdmin && (
                      <span className="group-admin-badge">
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M12 3 20 6v5c0 5-3.4 8.1-8 10-4.6-1.9-8-5-8-10V6l8-3Z" />
                          <path d="M9 12.5 11 14.5l4-4" />
                        </svg>
                        Admin
                      </span>
                    )}
                  </div>
                  <small>
                    {localize("Código do grupo", language)}: {groupPlayerInviteCode(group)}
                  </small>
                </div>
                <div className={`group-row-actions ${isAdmin ? "" : "group-member-actions"}`}>
                  <button
                    className="session-action-button view"
                    onClick={() => onChoose(group)}
                  >
                    {localize(isAdmin ? "Gerenciar" : "Ver jogos", language)}
                  </button>
                  <button
                    className="primary group-share-button"
                    onClick={() => openGroupInvite(group, isAdmin)}
                  >
                    {localize("Compartilhar", language)}
                  </button>
                </div>
              </article>
            );
            })
          ) : (
            <p className="empty">{localize("Nenhum grupo criado.", language)}</p>
          )}
        </section>
      </section>
      {availableGroups.length > 0 && (
        <section className="available-code-copy">
          <strong>
            {language === "pt"
              ? "Outros códigos de grupos disponíveis"
              : "Other group codes available"}
          </strong>
          <span className="available-code-list">
            {availableGroups.map(groupPlayerInviteCode).join(", ")}
          </span>
        </section>
      )}
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
              <div>
                {myGames.map((game) => {
                  const gameGroup = groups.find((group) => group.games.includes(game));
                  const isOwner =
                    game.createdByRole === "participant" &&
                    game.createdByUserId === user?.id &&
                    !adminGroupIds.includes(gameGroup?.id ?? "");
                  const isAdmin = adminGroupIds.includes(gameGroup?.id ?? "");
                  return (
                  <article className={`group-row my-game-row${isOwner || isAdmin ? " organizer-game-row" : ""}`} key={game.id}>
                    <MyGameDetails game={game} language={language} isOwner={isOwner} isAdmin={isAdmin} />
                    <div className="group-row-actions">
                      <button
                        className="session-action-button view"
                        onClick={() => onOpenMyGame(game)}
                      >
                        {localize(isOwner || isAdmin ? "Gerenciar" : "Ver", language)}
                      </button>
                      <button
                        className="session-action-button leave"
                        onClick={() => setGameToLeave(game)}
                      >
                        {localize("Sair da lista", language)}
                      </button>
                    </div>
                  </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty">
                {localize("Você ainda não tem jogos salvos.", language)}
              </p>
            )}
          </section>
          {availableGames.length > 0 && (
            <section className="available-code-copy">
              <strong>
                {language === "pt"
                  ? "Outros códigos de jogos disponíveis"
                  : "Other game codes available"}
              </strong>
              <span className="available-code-list">
                {availableGames
                  .map(({ group, game }) => gameInviteCode(group, game))
                  .join(", ")}
              </span>
            </section>
          )}
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
                onClick={() => {
                  onLeaveGroup(groupToLeave);
                  setGroupToLeave(null);
                }}
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
              {localize("COMPARTILHAR GRUPO", language)}: {" "}
              <strong className="group-invite-name">{groupInvite.group.name}</strong>
            </p>
            <div className="group-invite-section">
              <h2>{localize("CONVIDAR JOGADORES", language)}</h2>
              <p>
                {localize("Este convite libera a visualização dos jogos ativos do grupo.", language)}
              </p>
              <div className="group-invite-code-row">
                <input readOnly value={groupPlayerInviteCode(groupInvite.group)} />
                <button
                  className="primary"
                  onClick={() => copyInviteCode(groupPlayerInviteCode(groupInvite.group), "players")}
                >
                  {localize("Copiar código", language)}
                </button>
              </div>
            </div>
            {groupInvite.canInviteAdmins && (
              <div className="group-invite-section">
                <div className="group-invite-admin-heading">
                  <h2>{localize("CONVIDAR ADMINS", language)}</h2>
                  <span className="group-admin-badge">
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path d="M12 3 20 6v5c0 5-3.4 8.1-8 10-4.6-1.9-8-5-8-10V6l8-3Z" />
                      <path d="M9 12.5 11 14.5l4-4" />
                    </svg>
                    Admin
                  </span>
                </div>
                <p>
                  {localize("Este convite pede a senha do grupo antes de liberar o acesso de admin.", language)}
                </p>
                <div className="group-invite-code-row">
                  <input readOnly value={groupAdminInviteCode(groupInvite.group)} />
                  <button
                    className="primary"
                    onClick={() => copyInviteCode(groupAdminInviteCode(groupInvite.group), "admins")}
                  >
                    {localize("Copiar código", language)}
                  </button>
                </div>
              </div>
            )}
            <small className="success">
              {localize(
                inviteCodeCopied === "players"
                  ? "Código para jogadores copiado."
                  : inviteCodeCopied === "admins"
                    ? "Código para admins copiado."
                    : "Copie este código e envie ao convidado.",
                language,
              )}
            </small>
            <div className="confirm-dialog-actions">
              <button className="session-action-button delete" onClick={() => setGroupInvite(null)}>
                {localize("Fechar", language)}
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
                <p><strong>{groupAction.group.name}</strong></p>
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
