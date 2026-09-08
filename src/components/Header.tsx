import playUpIcon from "../assets/playup-icon.png";

function LogoutIcon() {
  return (
    <svg aria-hidden="true" className="header-action-icon" viewBox="0 0 24 24">
      <path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" />
      <path d="M14 8l4 4-4 4M18 12H8" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg aria-hidden="true" className="header-action-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.9-4 3.3-6 7.5-6s6.6 2 7.5 6" />
    </svg>
  );
}

type HeaderProps = {
  onBack: () => void;
  onHome?: () => void;
  backLabel?: string;
  showBackArrow?: boolean;
  onProfile?: () => void;
};

export function Header({
  onBack,
  onHome,
  backLabel = "Voltar",
  showBackArrow = true,
  onProfile,
}: HeaderProps) {
  return (
    <header>
      <div className="header-leading-actions">
        <button
          className={showBackArrow ? "secondary header-back-button" : "exit"}
          onClick={onBack}
        >
          {showBackArrow && <span aria-hidden="true">← </span>}
          {!showBackArrow && <LogoutIcon />}
          {backLabel}
        </button>
        {onProfile && (
          <button
            aria-label="User settings"
            className="secondary header-profile-button"
            onClick={onProfile}
            type="button"
          >
            <UserIcon />
          </button>
        )}
      </div>
      <a
        className="logo"
        href="#"
        aria-label="PlayUp"
        onClick={(event) => {
          event.preventDefault();
          (onHome ?? onBack)();
        }}
      >
        <img src={playUpIcon} alt="" />
      </a>
    </header>
  );
}
