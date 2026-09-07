import playUpLogo from "../assets/playup-logo.png";
import { useState } from "react";
import { localize, type Language } from "../i18n";
import type { CurrentUser } from "../types";

type LandingPageProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onEnter: () => void;
  user: CurrentUser | null;
  onSaveUser: (profile: Pick<CurrentUser, "displayName" | "email">) => string | null;
};

const content = {
  pt: {
    eyebrow: "JOGUE MELHOR, JUNTO",
    title: <>Seu próximo jogo<br /><em>começa aqui</em></>,
    intro: "Crie jogos, cadastre jogadores, monte times equilibrados e participe de jogos em poucos cliques.",
    enter: "Entrar no PlayUp",
    enterDescription: "Veja seus jogos, grupos e ferramentas de organização.",
  },
  en: {
    eyebrow: "PLAY BETTER, TOGETHER",
    title: <>Organize your next<br /><em>match</em></>,
    intro: "Create games, register players, build balanced teams, and join games in a few clicks.",
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
}: LandingPageProps) {
  const labels = content[language];
  const [name, setName] = useState(user?.displayName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [isEditing, setIsEditing] = useState(!user?.emailVerified);
  const [step, setStep] = useState<"details" | "verify">("details");
  const [accessCode, setAccessCode] = useState("");
  const [profileError, setProfileError] = useState("");
  const emailChanged = !user?.emailVerified || user.email !== email.trim().toLowerCase();
  const closeProfile = () => {
    setIsEditing(false);
    setStep("details");
    setAccessCode("");
    setProfileError("");
    setName(user?.displayName ?? "");
    setEmail(user?.email ?? "");
  };
  const sendAccessCode = () => {
    if (!name.trim()) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setProfileError("Informe um e-mail válido.");
      return;
    }
    if (!emailChanged) {
      const error = onSaveUser({ displayName: name.trim(), email: email.trim().toLowerCase() });
      setProfileError(error ?? "");
      if (!error) closeProfile();
      return;
    }
    setProfileError("");
    setAccessCode("");
    setStep("verify");
  };
  const verifyAccessCode = () => {
    if (accessCode !== "123456") {
      setProfileError("Código de acesso inválido.");
      return;
    }
    const error = onSaveUser({ displayName: name.trim(), email: email.trim().toLowerCase() });
    setProfileError(error ?? "");
    if (!error) closeProfile();
  };

  return (
    <main className="access-page landing-page">
      <div className="landing-topbar">
        <div className="language-switch">
          <button aria-label="Português" className={language === "pt" ? "selected" : ""} onClick={() => onLanguageChange("pt")}>🇧🇷</button>
          <button aria-label="English" className={language === "en" ? "selected" : ""} onClick={() => onLanguageChange("en")}>🇬🇧</button>
        </div>
        <img className="brand-mark" src={playUpLogo} alt="PlayUp" />
      </div>
      <div className="landing-content">
        <section className="landing-hero-copy">
          {user?.emailVerified && (
            <button className="landing-greeting" onClick={() => setIsEditing(true)}>
              <span>{localize("Olá", language)}, </span>
              <strong>{user.displayName}</strong>
              <span aria-hidden="true">! ✎</span>
            </button>
          )}
          <p className="landing-eyebrow">{labels.eyebrow}</p>
          <h1>{labels.title}</h1>
          <p className="landing-intro">{labels.intro}</p>
        </section>
        <div className="access-actions">
          <button className="primary access-option" onClick={onEnter}>
            <span>{labels.enter}</span>
            <small>{labels.enterDescription}</small>
            <b aria-hidden="true">→</b>
          </button>
        </div>
      </div>
      {isEditing && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
            <p className="form-mode">{localize("SEU PERFIL", language)}</p>
            {step === "details" ? (
              <form onSubmit={(event) => { event.preventDefault(); sendAccessCode(); }}>
                <p>{localize("Crie seu perfil para recuperar seus grupos e jogos em qualquer dispositivo.", language)}</p>
                <label className="profile-field">
                  {localize("Nome", language)}
                  <input autoFocus required maxLength={20} placeholder={localize("Seu nome", language)} value={name} onChange={(event) => { setName(event.target.value); setProfileError(""); }} />
                </label>
                <label className="profile-field">
                  {localize("E-mail", language)}
                  <input required inputMode="email" placeholder="nome@email.com" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setProfileError(""); }} />
                </label>
                {profileError && <small className="error">{localize(profileError, language)}</small>}
                <div className="confirm-dialog-actions">
                  {user?.emailVerified && <button className="secondary" type="button" onClick={closeProfile}>{localize("Cancelar", language)}</button>}
                  <button className="primary">{localize(emailChanged ? "Enviar código" : "Salvar", language)}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={(event) => { event.preventDefault(); verifyAccessCode(); }}>
                <p>{localize("Enviamos um código de acesso para", language)} <strong>{email}</strong>.</p>
                <label className="profile-field">
                  {localize("Código de acesso", language)}
                  <input autoFocus autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="••••••" type="password" value={accessCode} onChange={(event) => { setAccessCode(event.target.value); setProfileError(""); }} />
                </label>
                <small className="profile-demo-code">{localize("Demonstração sem backend: use 123456.", language)}</small>
                {profileError && <small className="error">{localize(profileError, language)}</small>}
                <div className="confirm-dialog-actions">
                  <button className="secondary" type="button" onClick={() => { setStep("details"); setProfileError(""); }}>{localize("Alterar dados", language)}</button>
                  <button className="primary">{localize("Verificar código", language)}</button>
                </div>
                <button className="text-button profile-resend" type="button" onClick={() => { setAccessCode(""); setProfileError(""); }}>{localize("Enviar novo código", language)}</button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
