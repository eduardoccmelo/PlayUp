import { useState, type FormEvent } from "react";
import { localize, type Language } from "../i18n";
import type { PlayerGroup } from "../types";
import { Header } from "./Header";

type GroupAction = {
  group: PlayerGroup;
  type: "enter" | "change-passcode" | "delete";
  step: "verify" | "update-passcode" | "confirm-delete";
};

type GroupSelectorProps = {
  groups: PlayerGroup[];
  language: Language;
  mode: "organizer" | "player";
  onBack: () => void;
  onCreate: (name: string, passcode: string) => void;
  onChoose: (group: PlayerGroup) => void;
  onDelete: (groupId: string) => void;
  onChangePasscode: (groupId: string, passcode: string) => void;
  onRename: (groupId: string, name: string) => void;
};

type PasswordFieldProps = {
  autoFocus?: boolean;
  minLength?: number;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
  language: Language;
};

function PasswordField({
  autoFocus,
  minLength,
  onChange,
  placeholder,
  value,
  language,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const toggleLabel = localize(isVisible ? "Ocultar senha" : "Mostrar senha", language);

  return (
    <div className="password-field">
      <input
        autoFocus={autoFocus}
        required
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
  mode,
  onBack,
  onCreate,
  onChoose,
  onDelete,
  onChangePasscode,
  onRename,
}: GroupSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [groupAction, setGroupAction] = useState<GroupAction | null>(null);
  const [currentPasscode, setCurrentPasscode] = useState("");
  const [newPasscode, setNewPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");
  const [groupToRename, setGroupToRename] = useState<PlayerGroup | null>(null);
  const [renamedGroupName, setRenamedGroupName] = useState("");
  const [groupError, setGroupError] = useState("");

  const createGroup = (event: FormEvent) => {
    event.preventDefault();
    if (groups.length >= 3) {
      setGroupError("Você só pode criar até 3 grupos no momento.");
      return;
    }
    if (!name.trim() || !passcode.trim()) return;
    onCreate(name.trim(), passcode);
    setName("");
    setPasscode("");
    setIsCreating(false);
  };
  const openGroupAction = (group: PlayerGroup, type: GroupAction["type"]) => {
    setCurrentPasscode("");
    setNewPasscode("");
    setPasscodeError("");
    setGroupAction({ group, type, step: "verify" });
  };
  const closeGroupAction = () => setGroupAction(null);
  const openRenameDialog = (group: PlayerGroup) => {
    setGroupToRename(group);
    setRenamedGroupName(group.name);
  };

  return (
    <main className="app-shell group-selector-page">
      <Header backLabel={localize("Voltar", language)} onBack={onBack} />
      <section className="hero">
        <p className="eyebrow">PLAYUP</p>
        <h1>
          {mode === "organizer"
            ? language === "pt" ? <>Seus <em>grupos.</em></> : <>Your <em>groups.</em></>
            : language === "pt" ? <>Escolha seu <em>grupo.</em></> : <>Choose your <em>group.</em></>}
        </h1>
        <p className="intro">
          {mode === "organizer"
            ? localize("Crie ou administre seus grupos de jogos.", language)
            : localize("Escolha o grupo para ver os próximos jogos.", language)}
        </p>
      </section>

      {mode === "organizer" && !isCreating && (
        <div className="create-game-action">
          <button className="secondary" onClick={() => setIsCreating(true)}>
            + {localize("Criar grupo", language)}
          </button>
        </div>
      )}

      {mode === "organizer" && isCreating && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
            <p className="form-mode">{localize("NOVO GRUPO", language)}</p>
            <form onSubmit={createGroup}>
              <input
                required
                maxLength={20}
                placeholder={localize("Nome do grupo", language)}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              {groupError && <small className="error">{localize(groupError, language)}</small>}
              <PasswordField
                language={language}
                minLength={4}
                placeholder={localize("Senha dos organizadores", language)}
                value={passcode}
                onChange={setPasscode}
              />
              <div className="confirm-dialog-actions">
                <button className="secondary" type="button" onClick={() => setIsCreating(false)}>
                  {localize("Cancelar", language)}
                </button>
                <button className="primary">{localize("Criar grupo", language)}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="panel group-list">
        {groups.length ? (
          groups.map((group) => (
            <article className="group-row" key={group.id}>
              <div>
                <div className="group-name-line">
                  <strong>{group.name}</strong>
                  {mode === "organizer" && (
                    <button
                      aria-label={localize("Editar grupo", language)}
                      className="icon-button group-name-edit subtle-tooltip"
                      data-tooltip={localize("Editar grupo", language)}
                      onClick={() => openRenameDialog(group)}
                      type="button"
                    >
                      ✎
                    </button>
                  )}
                </div>
                <small>{localize("Código do grupo", language)}: {group.id}</small>
              </div>
              <div className="group-row-actions">
                <button
                  className="primary"
                  onClick={() =>
                    mode === "organizer"
                      ? openGroupAction(group, "enter")
                      : onChoose(group)
                  }
                >
                  {mode === "organizer" ? localize("Entrar", language) : localize("Ver jogos", language)}
                </button>
                {mode === "organizer" && (
                  <>
                    <button
                      className="secondary"
                      onClick={() => openGroupAction(group, "change-passcode")}
                    >
                      {localize("Alterar senha", language)}
                    </button>
                    <button className="session-action-button delete" onClick={() => openGroupAction(group, "delete")}>
                      {localize("Deletar", language)}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))
        ) : (
          <p className="empty">{localize("Nenhum grupo criado.", language)}</p>
        )}
      </section>
      {groupToRename && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const nextName = renamedGroupName.trim();
                if (!nextName) return;
                onRename(groupToRename.id, nextName);
                setGroupToRename(null);
              }}
            >
              <h2>{localize("Editar nome do grupo", language)}</h2>
              <input
                autoFocus
                required
                maxLength={20}
                placeholder={localize("Nome do grupo", language)}
                value={renamedGroupName}
                onChange={(event) => setRenamedGroupName(event.target.value)}
              />
              <div className="confirm-dialog-actions">
                <button className="secondary" type="button" onClick={() => setGroupToRename(null)}>{localize("Cancelar", language)}</button>
                <button className="primary">{localize("Salvar", language)}</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {groupAction && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
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
                    step: groupAction.type === "delete" ? "confirm-delete" : "update-passcode",
                  });
                }}
              >
                <h2>{localize(groupAction.type === "enter" ? "Entrar como organizador" : "Confirmar senha", language)}</h2>
                <p>{localize("Digite a senha atual dos organizadores para continuar.", language)}</p>
                <PasswordField
                  autoFocus
                  language={language}
                  placeholder={localize("Senha atual", language)}
                  value={currentPasscode}
                  onChange={setCurrentPasscode}
                />
                {passcodeError && <small className="error">{localize(passcodeError, language)}</small>}
                <div className="confirm-dialog-actions">
                  <button className="secondary" type="button" onClick={closeGroupAction}>{localize("Cancelar", language)}</button>
                  <button className="primary">{localize("Continuar", language)}</button>
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
                  <button className="secondary" type="button" onClick={closeGroupAction}>{localize("Cancelar", language)}</button>
                  <button className="primary">{localize("Salvar", language)}</button>
                </div>
              </form>
            )}
            {groupAction.step === "confirm-delete" && (
              <>
                <h2>{localize("Excluir grupo", language)}</h2>
                <p>{localize("Todos os jogos e jogadores deste grupo serão apagados.", language)}</p>
                <div className="confirm-dialog-actions">
                  <button className="secondary" onClick={closeGroupAction}>{localize("Cancelar", language)}</button>
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
