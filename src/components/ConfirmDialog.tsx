import { localize } from "../i18n";

type ConfirmDialogProps = {
  language: "pt" | "en";
  kind?: "delete" | "remove" | "delete-game";
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  language,
  kind = "delete",
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const isRemoval = kind === "remove";
  const isGameDeletion = kind === "delete-game";

  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-labelledby="delete-dialog-title" aria-modal="true" className="confirm-dialog" role="dialog">
        <h2 id="delete-dialog-title">
          {localize(
            isRemoval
              ? "Remover jogador da lista"
              : isGameDeletion
                ? "Excluir jogo"
                : "Confirmar exclusão",
            language,
          )}
        </h2>
        <p>
          {localize(
            isRemoval
              ? "O jogador continuará cadastrado e poderá ser adicionado novamente."
              : isGameDeletion
                ? "Este jogo será excluído permanentemente."
              : "Esta ação não pode ser desfeita.",
            language,
          )}
        </p>
        <div className="confirm-dialog-actions">
          <button className="secondary" onClick={onCancel}>{localize("Cancelar", language)}</button>
          <button className="danger-button" onClick={onConfirm}>
            {localize(isRemoval ? "Remover" : isGameDeletion ? "Deletar" : "Excluir", language)}
          </button>
        </div>
      </section>
    </div>
  );
}
