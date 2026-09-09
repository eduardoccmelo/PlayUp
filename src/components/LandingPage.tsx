import playUpLogo from "../assets/playup-logo.png";
import { useEffect, useState } from "react";
import { localize, type Language } from "../i18n";
import type { CurrentUser } from "../types";

type LandingPageProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onEnter: () => void;
  user: CurrentUser | null;
  onSaveUser: (
    profile: Pick<CurrentUser, "displayName" | "email">,
    mode: "sign-in" | "sign-up",
  ) => string | null;
  onOpenProfile?: () => void;
  profileOnly?: boolean;
  openProfile?: boolean;
  onProfileOpened?: () => void;
  onLogout: () => void;
};

const content = {
  pt: {
    eyebrow: "JOGUE MELHOR, JUNTO",
    title: (
      <>
        Seu próximo jogo
        <br />
        <em>começa aqui</em>
      </>
    ),
    intro:
      "Crie jogos, cadastre jogadores, monte times equilibrados e participe de jogos em poucos cliques.",
    enter: "Entrar no PlayUp",
    enterDescription: "Veja seus jogos, grupos e ferramentas de organização.",
  },
  en: {
    eyebrow: "PLAY BETTER, TOGETHER",
    title: (
      <>
        Organize your next
        <br />
        <em>match</em>
      </>
    ),
    intro:
      "Create games, register players, build balanced teams, and join games in a few clicks.",
    enter: "Open PlayUp",
    enterDescription: "View your games, groups, and organizer tools.",
  },
};

export function LandingPage({
  language,
  onLanguageChange,
  onEnter,
  user,
  onSaveUser,
  onOpenProfile,
  profileOnly = false,
  openProfile = false,
  onProfileOpened,
  onLogout,
}: LandingPageProps) {
  const labels = content[language];
  const [name, setName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [step, setStep] = useState<
    "details" | "verify" | "verify-current-email" | "verify-new-email"
  >("details");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up");
  const [accessCode, setAccessCode] = useState("");
  const [profileError, setProfileError] = useState("");
  const [resendConfirmation, setResendConfirmation] = useState(false);
  const profileChanged =
    !user?.emailVerified ||
    user.email !== email.trim().toLowerCase() ||
    user.displayName !== name.trim();
  const isEmailUpdate = Boolean(
    user?.emailVerified && user.email !== email.trim().toLowerCase(),
  );
  useEffect(() => {
    setName(user?.displayName ?? "");
    setEmail(user?.email ?? "");
    setStep("details");
    setAccessCode("");
  }, [user?.id, user?.displayName, user?.email]);
  useEffect(() => {
    if (profileOnly && openProfile) {
      if (!user?.emailVerified) setMode("sign-up");
      setIsEditing(true);
      onProfileOpened?.();
    }
  }, [onProfileOpened, openProfile, profileOnly, user?.emailVerified]);
  const closeProfile = () => {
    setIsEditing(false);
    setStep("details");
    setAccessCode("");
    setProfileError("");
    setResendConfirmation(false);
    setName(user?.displayName ?? "");
    setEmail(user?.email ?? "");
  };
  const sendAccessCode = () => {
    if (mode === "sign-up" && !name.trim()) {
      setProfileError("Informe seu nome.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setProfileError("Informe um e-mail válido.");
      return;
    }
    if (!profileChanged) {
      const error = onSaveUser(
        { displayName: name.trim(), email: email.trim().toLowerCase() },
        mode,
      );
      setProfileError(error ?? "");
      if (!error) closeProfile();
      return;
    }
    setProfileError("");
    setAccessCode("");
    setResendConfirmation(false);
    setStep(isEmailUpdate ? "verify-current-email" : "verify");
  };
  const verifyAccessCode = () => {
    if (accessCode !== "123456") {
      setProfileError("Código de acesso inválido.");
      return;
    }
    if (step === "verify-current-email") {
      setAccessCode("");
      setProfileError("");
      setResendConfirmation(false);
      setStep("verify-new-email");
      return;
    }
    const error = onSaveUser(
      { displayName: name.trim(), email: email.trim().toLowerCase() },
      mode,
    );
    setProfileError(error ?? "");
    if (!error) closeProfile();
  };

  const profileDialog = isEditing && (
    <div className="modal-backdrop" role="presentation">
      <section
        aria-modal="true"
        className="confirm-dialog group-auth-modal"
        role="dialog"
      >
        <div className="profile-modal-heading">
          <p className="form-mode">{localize("SEU PERFIL", language)}</p>
          {user?.emailVerified && (
            <button
              className="session-action-button delete"
              type="button"
              onClick={() => {
                setMode("sign-in");
                onLogout();
              }}
            >
              Logout
            </button>
          )}
        </div>
        {step === "details" ? (
          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              sendAccessCode();
            }}
          >
            {!user?.emailVerified && (
              <div
                className="profile-mode-actions"
                role="group"
                aria-label={
                  language === "pt" ? "Modo de acesso" : "Access mode"
                }
              >
                <button
                  className={mode === "sign-up" ? "selected" : ""}
                  type="button"
                  onClick={() => {
                    setMode("sign-up");
                    setProfileError("");
                  }}
                >
                  {language === "pt" ? "Criar perfil" : "Create profile"}
                </button>
                <button
                  className={mode === "sign-in" ? "selected" : ""}
                  type="button"
                  onClick={() => {
                    setMode("sign-in");
                    setProfileError("");
                  }}
                >
                  {language === "pt" ? "Entrar" : "Sign in"}
                </button>
              </div>
            )}
            {!user?.emailVerified && (
              <p>
                {mode === "sign-in"
                  ? language === "pt"
                    ? "Entre com o e-mail usado para criar seu perfil."
                    : "Sign in with the email used to create your profile."
                  : localize(
                      "Crie seu perfil para recuperar seus grupos e jogos em qualquer dispositivo.",
                      language,
                    )}
              </p>
            )}
            {mode === "sign-up" && (
              <label className="profile-field">
                {localize("Nome", language)}
                <input
                  autoFocus
                  required
                  maxLength={20}
                  placeholder={localize("Seu nome", language)}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setProfileError("");
                  }}
                />
              </label>
            )}
            <label className="profile-field">
              {localize("E-mail", language)}
              <input
                autoFocus={mode === "sign-in"}
                required
                inputMode="email"
                placeholder="nome@email.com"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setProfileError("");
                }}
              />
            </label>
            {!user?.emailVerified && (
              <small className="profile-email-info">
                {language === "pt"
                  ? mode === "sign-up"
                    ? "Para confirmar a criação do perfil, enviaremos um código de acesso para o seu e-mail."
                    : "Para confirmar o login, enviaremos um código de acesso para o seu e-mail."
                  : mode === "sign-up"
                    ? "To confirm profile creation, we will send an access code to your email."
                    : "To confirm sign in, we will send an access code to your email."}
              </small>
            )}
            {isEmailUpdate && (
              <small className="error profile-email-change-notice">
                {language === "pt"
                  ? "Para alterar o e-mail, confirme primeiro o código enviado ao seu e-mail atual. Depois, confirmaremos o novo e-mail."
                  : "To change your email, first confirm the code sent to your current email. Then we will confirm the new email."}
              </small>
            )}
            {profileError && (
              <small className="error">
                {localize(profileError, language)}
              </small>
            )}
            <div
              className={`confirm-dialog-actions${!user?.emailVerified ? " profile-entry-actions" : ""}`}
            >
              <button
                className="secondary"
                type="button"
                onClick={closeProfile}
              >
                {localize("Cancelar", language)}
              </button>
              <button className="primary">
                {localize(
                  profileChanged ? "Enviar código" : "Salvar",
                  language,
                )}
              </button>
            </div>
          </form>
        ) : (
          <form
            className="profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              verifyAccessCode();
            }}
          >
            <p>
              {step === "verify-current-email" ? (
                language === "pt" ? (
                  <>
                    Enviamos um código de confirmação para o e-mail atual:{" "}
                    <strong>{user?.email}</strong>.
                  </>
                ) : (
                  <>
                    We sent a confirmation code to your current email:{" "}
                    <strong>{user?.email}</strong>.
                  </>
                )
              ) : step === "verify-new-email" ? (
                language === "pt" ? (
                  <>
                    Agora enviamos um código de confirmação para o novo e-mail:{" "}
                    <strong>{email}</strong>.
                  </>
                ) : (
                  <>
                    We have now sent a confirmation code to the new email:{" "}
                    <strong>{email}</strong>.
                  </>
                )
              ) : (
                <>
                  {localize("Enviamos um código de acesso para", language)}{" "}
                  <strong>{email}</strong>.
                </>
              )}
            </p>
            <label className="profile-field">
              {localize("Código de acesso", language)}
              <input
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                type="password"
                value={accessCode}
                onChange={(event) => {
                  setAccessCode(event.target.value);
                  setProfileError("");
                }}
              />
            </label>
            <small className="profile-demo-code">
              {localize("Demonstração sem backend: use 123456.", language)}
            </small>
            {resendConfirmation && (
              <small className="success profile-resend-confirmation">
                {language === "pt"
                  ? "Um novo código de acesso foi enviado."
                  : "A new access code has been sent."}
              </small>
            )}
            {profileError && (
              <small className="error">
                {localize(profileError, language)}
              </small>
            )}
            <div className="profile-resend-copy">
              <span>
                {language === "pt" ? "Não recebeu o código?" : "Did not receive the code?"}
              </span>
              <button
                className="text-button profile-resend-link"
                type="button"
                onClick={() => {
                  setAccessCode("");
                  setProfileError("");
                  setResendConfirmation(true);
                }}
              >
                {language === "pt"
                  ? "Clique aqui para enviar novamente"
                  : "Click here to send it again"}
              </button>
            </div>
            <div className="verification-secondary-actions">
              <button
                className="secondary"
                type="button"
                onClick={closeProfile}
              >
                {localize("Cancelar", language)}
              </button>
              <button className="primary">
                {localize("Verificar código", language)}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );

  if (profileOnly) return profileDialog;

  return (
    <main className="access-page landing-page">
      <div className="landing-topbar">
        <div className="landing-top-actions">
          <div className="language-switch">
            <button
              aria-label="Português"
              className={language === "pt" ? "selected" : ""}
              onClick={() => onLanguageChange("pt")}
            >
              🇧🇷
            </button>
            <button
              aria-label="English"
              className={language === "en" ? "selected" : ""}
              onClick={() => onLanguageChange("en")}
            >
              🇬🇧
            </button>
          </div>
          <button
            aria-label="User settings"
            className="secondary landing-profile-button"
            onClick={onOpenProfile}
          >
            <svg
              aria-hidden="true"
              className="header-action-icon"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20c.9-4 3.3-6 7.5-6s6.6 2 7.5 6" />
            </svg>
          </button>
        </div>
        <img className="brand-mark" src={playUpLogo} alt="PlayUp" />
      </div>
      <div className="landing-content">
        <section className="landing-hero-copy">
          {user?.emailVerified ? (
            <button className="landing-greeting" onClick={onOpenProfile}>
              <span>{localize("Olá", language)}, </span>
              <strong>{user.displayName}</strong>
              <span aria-hidden="true">! ✎</span>
            </button>
          ) : (
            <button
              className="primary landing-sign-in-button"
              onClick={onOpenProfile}
            >
              {language === "pt" ? "Entrar" : "Sign in"}
            </button>
          )}
          <p className="landing-eyebrow">{labels.eyebrow}</p>
          <h1>{labels.title}</h1>
          <p className="landing-intro">{labels.intro}</p>
        </section>
        <div className="access-actions">
          <button
            className="primary access-option"
            disabled={!user?.emailVerified}
            onClick={onEnter}
          >
            <span>{labels.enter}</span>
            <small>{labels.enterDescription}</small>
            <b aria-hidden="true">→</b>
          </button>
        </div>
      </div>
    </main>
  );
}
