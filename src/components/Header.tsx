import playUpIcon from "../assets/playup-icon.png";

function LogoutIcon() {
  return (
    <svg aria-hidden="true" className="header-action-icon" viewBox="0 0 24 24">
      <path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5" />
      <path d="M14 8l4 4-4 4M18 12H8" />
    </svg>
  );
}

type HeaderProps = {
  onBack: () => void;
  onHome?: () => void;
  backLabel?: string;
  showBackArrow?: boolean;
};

export function Header({
  onBack,
  onHome,
  backLabel = "Voltar",
  showBackArrow = true,
}: HeaderProps) {
  return (
    <header>
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
      <button className="exit" onClick={onBack}>
        {showBackArrow && <span aria-hidden="true">← </span>}
        {!showBackArrow && <LogoutIcon />}
        {backLabel}
      </button>
    </header>
  );
}
