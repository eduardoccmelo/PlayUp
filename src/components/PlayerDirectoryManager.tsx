import { useState, type FormEvent } from "react";
import { localize } from "../i18n";
import type { Condition, Mobility, Player, Position } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

type PlayerDirectoryManagerProps = {
  language: "pt" | "en";
  players: Player[];
  onAddPlayer: (player: Omit<Player, "id">) => boolean;
  onUpdatePlayer: (player: Player) => boolean;
  onDeletePlayer: (playerId: number) => void;
};

const emptyPlayer = {
  name: "",
  level: 3,
  mobility: "neutro" as Mobility,
  condition: "neutro" as Condition,
  position: "neutro" as Position,
};

export function PlayerDirectoryManager({
  language,
  players,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
}: PlayerDirectoryManagerProps) {
  const [mode, setMode] = useState<"add" | "edit" | null>(null);
  const [draft, setDraft] = useState(emptyPlayer);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const [message, setMessage] = useState("");

  const closeModal = () => {
    setMode(null);
    setEditingPlayer(null);
    setDraft(emptyPlayer);
  };
  const savePlayer = (event: FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    const saved = editingPlayer
      ? onUpdatePlayer({ ...editingPlayer, ...draft, name })
      : onAddPlayer({ ...draft, name });
    if (!saved) return;

    setMessage(
      `${name} ${localize(editingPlayer ? "foi atualizado." : "foi adicionado.", language)}`,
    );
    closeModal();
  };

  return (
    <section className="directory-manager">
      <div className="directory-manager-heading">
        <h2 className="directory-manager-title">
          {localize("Gerenciar", language)}{" "}
          <em>{localize("jogadores.", language)}</em>
        </h2>
        <button
          className="session-action-button edit directory-add-button"
          onClick={() => {
            setMessage("");
            setDraft(emptyPlayer);
            setEditingPlayer(null);
            setMode("add");
          }}
        >
          {localize("+ Adicionar jogador", language)}
        </button>
      </div>

      <div className="directory-player-results directory-player-list">
        {players.length ? (
          players.map((player) => (
            <div key={player.id}>
              <span>{player.name}</span>
              <button
                className="text-button"
                onClick={() => {
                  setMessage("");
                  setDraft({
                    name: player.name,
                    level: player.level,
                    mobility: player.mobility,
                    condition: player.condition,
                    position: player.position,
                  });
                  setEditingPlayer(player);
                  setMode("edit");
                }}
              >
                {localize("Editar", language)}
              </button>
              <button
                className="text-button danger"
                onClick={() => setPlayerToDelete(player)}
              >
                {localize("Deletar", language)}
              </button>
            </div>
          ))
        ) : (
          <p className="empty">
            {localize("Nenhum jogador cadastrado.", language)}
          </p>
        )}
      </div>
      {message && <p className="success directory-message">✓ {message}</p>}

      {mode && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog directory-player-modal"
            role="dialog"
          >
            <p className="form-mode">
              {localize(
                mode === "edit" ? "Editar jogador" : "Adicionar novo jogador",
                language,
              )}
            </p>
            <form className="player-form" onSubmit={savePlayer}>
              <input
                required
                maxLength={20}
                placeholder={localize("Nome", language)}
                value={draft.name}
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
              />
              <select
                value={draft.level}
                onChange={(event) =>
                  setDraft({ ...draft, level: Number(event.target.value) })
                }
              >
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>
                    {localize("Nível", language)} {level}
                  </option>
                ))}
              </select>
              <select
                value={draft.mobility}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    mobility: event.target.value as Mobility,
                  })
                }
              >
                <option value="neutro">
                  {localize("Velocidade", language)}:{" "}
                  {localize("Neutra", language)}
                </option>
                <option value="rapido">
                  {localize("Velocidade", language)}:{" "}
                  {localize("Rápido", language)}
                </option>
                <option value="lento">
                  {localize("Velocidade", language)}:{" "}
                  {localize("Lento", language)}
                </option>
              </select>
              <select
                value={draft.condition}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    condition: event.target.value as Condition,
                  })
                }
              >
                <option value="neutro">
                  {localize("Condição", language)}:{" "}
                  {localize("Neutra", language)}
                </option>
                <option value="boa">
                  {localize("Condição", language)}: {localize("Boa", language)}
                </option>
                <option value="ruim">
                  {localize("Condição", language)}: {localize("Ruim", language)}
                </option>
              </select>
              <select
                value={draft.position}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    position: event.target.value as Position,
                  })
                }
              >
                <option value="neutro">
                  {localize("Posição", language)}:{" "}
                  {localize("Neutra", language)}
                </option>
                <option value="goleiro">{localize("Goleiro", language)}</option>
                <option value="defesa">{localize("Defesa", language)}</option>
                <option value="ataque">{localize("Ataque", language)}</option>
              </select>
              <button className="primary">
                {localize(mode === "edit" ? "Salvar" : "Adicionar", language)}
              </button>
              <button
                className="text-button player-form-cancel"
                type="button"
                onClick={closeModal}
              >
                {localize("Cancelar", language)}
              </button>
            </form>
          </section>
        </div>
      )}
      {playerToDelete && (
        <ConfirmDialog
          language={language}
          onCancel={() => setPlayerToDelete(null)}
          onConfirm={() => {
            onDeletePlayer(playerToDelete.id);
            setMessage(
              `${playerToDelete.name} ${localize("foi deletado.", language)}`,
            );
            setPlayerToDelete(null);
          }}
        />
      )}
    </section>
  );
}
