import playUpLogo from "../assets/playup-logo.png";
import { type Language } from "../i18n";

type LandingPageProps = {
  language: Language;
  onLanguageChange: (language: Language) => void;
  onChooseOrganizer: () => void;
  onChoosePlayer: () => void;
};

const content = {
  pt: {
    eyebrow: "JOGUE MELHOR, JUNTO",
    title: <>Seu próximo jogo<br /><em>começa aqui.</em></>,
    intro: "Crie jogos, cadastre jogadores, monte times equilibrados e participe de jogos em poucos cliques.",
    organizer: "Sou organizador",
    organizerDescription: "Crie e administre os jogos do seu grupo.",
    player: "Vou jogar",
    playerDescription: "Encontre seu grupo e confirme presença.",
  },
  en: {
    eyebrow: "PLAY BETTER, TOGETHER",
    title: <>Organize your next<br /><em>match.</em></>,
    intro: "Create games, register players, build balanced teams, and join games in a few clicks.",
    organizer: "I’m an organizer",
    organizerDescription: "Create and manage your group’s games.",
    player: "I’m playing",
    playerDescription: "Find your group and confirm your place.",
  },
};

export function LandingPage({
  language,
  onLanguageChange,
  onChooseOrganizer,
  onChoosePlayer,
}: LandingPageProps) {
  const labels = content[language];

  return (
    <main className="access-page landing-page">
      <div className="language-switch">
        <button aria-label="Português" className={language === "pt" ? "selected" : ""} onClick={() => onLanguageChange("pt")}>🇧🇷</button>
        <button aria-label="English" className={language === "en" ? "selected" : ""} onClick={() => onLanguageChange("en")}>🇬🇧</button>
      </div>
      <div className="landing-content">
        <img className="brand-mark" src={playUpLogo} alt="PlayUp" />
        <p className="landing-eyebrow">{labels.eyebrow}</p>
        <h1>{labels.title}</h1>
        <p className="landing-intro">{labels.intro}</p>
        <div className="access-actions">
          <button className="primary access-option" onClick={onChooseOrganizer}>
            <span>{labels.organizer}</span>
            <small>{labels.organizerDescription}</small>
            <b aria-hidden="true">→</b>
          </button>
          <button className="secondary access-option" onClick={onChoosePlayer}>
            <span>{labels.player}</span>
            <small>{labels.playerDescription}</small>
            <b aria-hidden="true">→</b>
          </button>
        </div>
      </div>
    </main>
  );
}
