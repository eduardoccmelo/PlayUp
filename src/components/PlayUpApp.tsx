import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  generateBalancedTeams,
  playerScoreBreakdown,
} from "../utils/teamBalancer";
import type {
  Condition,
  GameSession,
  Mobility,
  Position,
  ParticipationRequest,
  Player,
  PlayerGroup,
  CurrentUser,
} from "../types";
import { localize, localizePage } from "../i18n";
import { GameForm } from "./GameForm";
import { Header } from "./Header";
import { Teams } from "./Teams";
import { ParticipationRequests } from "./ParticipationRequests";
import { ReadOnlyGame } from "./ReadOnlyGame";
import { LandingPage } from "./LandingPage";
import { ConfirmDialog } from "./ConfirmDialog";
import { PlayerDirectoryManager } from "./PlayerDirectoryManager";
import { GroupSelector } from "./GroupSelector";
import { CompactGameDetails, EventSummary } from "./EventSummary";
import { MyGames } from "./MyGames";
import {
  compareGameStartTime as chronological,
  currencySymbol,
  endTimeFromDuration,
  emptyGameDraft as emptyGame,
  hasGameEnded,
  isVisibleToParticipants as visibleToPlayers,
  pricePerPlayer as price,
  today,
  gameTimestamp,
  normalizeText,
} from "../utils/game";
const emptyPlayer = {
  name: "",
  level: 3,
  mobility: "neutro" as Mobility,
  condition: "neutro" as Condition,
  position: "neutro" as Position,
};
const noPlayers: Player[] = [];
const noGames: GameSession[] = [];
const noRequests: ParticipationRequest[] = [];
const alphabeticallyByName =
  (language: "pt" | "en") => (first: Player, second: Player) =>
    first.name.localeCompare(second.name, language === "pt" ? "pt-BR" : "en");
const isValidIsoDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsedDate = new Date(`${date}T12:00:00`);
  return (
    !Number.isNaN(parsedDate.valueOf()) &&
    parsedDate.toISOString().slice(0, 10) === date
  );
};
const nextIdentifier = (
  records: {
    id: number;
  }[],
) => Math.max(0, ...records.map((record) => record.id)) + 1;
const samePlayerIds = (first: number[], second: number[]) =>
  first.length === second.length &&
  first.every((id, index) => id === second[index]);
const paidPlayersFirst = (playerIds: number[], paidPlayerIds: number[]) => [
  ...playerIds.filter((playerId) => paidPlayerIds.includes(playerId)),
  ...playerIds.filter((playerId) => !paidPlayerIds.includes(playerId)),
];
const browserLanguage = (): "pt" | "en" =>
  typeof navigator !== "undefined" &&
  navigator.language.toLowerCase().startsWith("pt")
    ? "pt"
    : "en";
const createGroupId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
const isCurrentUserPlayer = (player: Player | undefined, user: CurrentUser | null) =>
  Boolean(
    player &&
      user &&
      (player.ownerUserId === user.id ||
        normalizeText(player.name) === normalizeText(user.displayName)),
  );
const TrashIcon = () => (
  <svg aria-hidden="true" className="trash-icon" viewBox="0 0 24 24">
    <path d="M4 7h16M10 11v6M14 11v6M9 7l1-2h4l1 2M6 7l1 13h10l1-13" />
  </svg>
);

export function PlayUpApp() {
  const [languagePreference, setLanguage] = useLocalStorage<"pt" | "en" | null>(
    "playup.language.preference",
    null,
  );
  const language = languagePreference ?? browserLanguage();
  useEffect(() => {
    localizePage(language);
  });
  const [access, setAccess] = useState<"home" | "groups" | "admin" | "player" | "my-games">(
    "home",
  );
  const [groups, setGroups] = useLocalStorage<PlayerGroup[]>(
    "playup.groups.v1",
    [],
  );
  const [currentUser, setCurrentUser] = useLocalStorage<CurrentUser | null>(
    "playup.current-user.v1",
    null,
  );
  const [activeGroupId, setActiveGroupId] = useLocalStorage<string | null>(
    "playup.active-group.v1",
    null,
  );
  const activeGroup =
    groups.find((group) => group.id === activeGroupId) ?? null;
  const players = activeGroup?.players ?? noPlayers;
  const games = activeGroup?.games ?? noGames;
  const requests = activeGroup?.requests ?? noRequests;
  const updateActiveGroup = useCallback(
    (changes: Partial<PlayerGroup>) => {
      if (!activeGroupId) return;
      setGroups((currentGroups) =>
        currentGroups.map((group) =>
          group.id === activeGroupId ? { ...group, ...changes } : group,
        ),
      );
    },
    [activeGroupId, setGroups],
  );
  const setPlayers = useCallback(
    (nextPlayers: Player[]) => updateActiveGroup({ players: nextPlayers }),
    [updateActiveGroup],
  );
  const setGames = useCallback(
    (nextGames: GameSession[]) => updateActiveGroup({ games: nextGames }),
    [updateActiveGroup],
  );
  const setRequests = useCallback(
    (nextRequests: ParticipationRequest[]) =>
      updateActiveGroup({ requests: nextRequests }),
    [updateActiveGroup],
  );
  useEffect(() => {
    if (groups.length || localStorage.getItem("playup.groups.v1.migrated"))
      return;

    const legacyPlayers = JSON.parse(
      localStorage.getItem("playup.players.v3") ?? "[]",
    ) as Player[];
    const legacyGames = JSON.parse(
      localStorage.getItem("playup.sessions.v2") ?? "[]",
    ) as GameSession[];
    const legacyRequests = JSON.parse(
      localStorage.getItem("playup.requests.v3") ?? "[]",
    ) as ParticipationRequest[];
    localStorage.setItem("playup.groups.v1.migrated", "true");
    if (!legacyPlayers.length && !legacyGames.length && !legacyRequests.length)
      return;

    setGroups([
      {
        id: createGroupId(),
        name: "Meu grupo",
        organizerPasscode: "admin",
        createdAt: new Date().toISOString(),
        players: legacyPlayers,
        games: legacyGames,
        requests: legacyRequests,
      },
    ]);
  }, [groups.length, setGroups]);
  const [gameId, setGameId] = useState<number | null>(null);
  const [returnToDashboardAfterGame, setReturnToDashboardAfterGame] =
    useState(false);
  const [guestGameIds, setGuestGameIds] = useState<number[]>([]);
  const [inviteKind, setInviteKind] = useState<"group-admin" | "group-participant" | "game" | null>(null);
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const currentUserFirst = useCallback(
    (first: Player, second: Player) => {
      const firstIsCurrent = isCurrentUserPlayer(first, currentUser);
      const secondIsCurrent = isCurrentUserPlayer(second, currentUser);
      if (firstIsCurrent !== secondIsCurrent)
        return firstIsCurrent ? -1 : 1;
      return alphabeticallyByName(language)(first, second);
    },
    [currentUser, language],
  );
  const myGames = useMemo(
    () =>
      groups
        .flatMap((group) =>
          group.games.filter((gameSession) => {
            if (guestGameIds.includes(gameSession.id)) return true;
            const gamePlayerIds = new Set([
              ...gameSession.playerIds,
              ...gameSession.waitlistIds,
            ]);
            return group.players.some(
              (player) =>
                gamePlayerIds.has(player.id) &&
                isCurrentUserPlayer(player, currentUser),
            );
          }),
        )
        .sort(chronological),
    [currentUser, groups, guestGameIds],
  );
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const frameId = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => window.cancelAnimationFrame(frameId);
  }, [access, activeGroupId, gameId]);
  const game = games.find((g) => g.id === gameId) ?? null;
  const [gameForm, setGameForm] = useState(emptyGame);
  const [editGame, setEditGame] = useState<number | null>(null);
  const [isGameCreationOpen, setIsGameCreationOpen] = useState(false);
  const [playerForm, setPlayerForm] = useState(emptyPlayer);
  const [editPlayer, setEditPlayer] = useState<number | null>(null);
  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const [playerFormNotice, setPlayerFormNotice] = useState("");
  const [adminPlayerSearch, setAdminPlayerSearch] = useState("");
  const [isAdminPlayerSearchOpen, setIsAdminPlayerSearchOpen] = useState(false);
  const [, setPick] = useState("");
  const [, setEntered] = useState(false);
  const [notice, setNotice] = useState("");
  const [balanceNotice, setBalanceNotice] = useState("");
  const [cancellationNotice, setCancellationNotice] = useState("");
  const [requestName, setRequestName] = useState("");
  const [gameToDelete, setGameToDelete] = useState<GameSession | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<(() => void) | null>(
    null,
  );
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const intervalId = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);
  useEffect(() => {
    const now = Date.now();
    const nextGames = games.map((gameSession) => {
      const minimum = gameSession.minPlayers;
      const cancellationDeadline =
        gameSession.cancellationHours === null
          ? null
          : gameTimestamp(gameSession) -
            gameSession.cancellationHours * 60 * 60 * 1000;
      const shouldCancel =
        minimum !== null &&
        cancellationDeadline !== null &&
        !gameSession.cancelled &&
        now >= cancellationDeadline &&
        now < gameTimestamp(gameSession) &&
        gameSession.paidPlayerIds.length < minimum;
      return shouldCancel
        ? { ...gameSession, cancelled: true, teams: null }
        : gameSession;
    });
    if (nextGames.some((gameSession, index) => gameSession !== games[index]))
      setGames(nextGames);
  }, [clock, games, setGames]);
  const listed = useMemo(
    () =>
      game
        ? game.playerIds
            .map((playerId) => players.find((player) => player.id === playerId))
            .filter((player): player is Player => Boolean(player))
        : [],
    [game, players],
  );
  const paid = game
    ? listed.filter((p) => game.paidPlayerIds.includes(p.id))
    : [];
  const waiting = useMemo(
    () =>
      game
        ? game.waitlistIds
            .map((playerId) => players.find((player) => player.id === playerId))
            .filter((player): player is Player => Boolean(player))
        : [],
    [game, players],
  );
  const adminSearchTerm = adminPlayerSearch.trim().toLocaleLowerCase();
  const playerSearchResults = isAdminPlayerSearchOpen
    ? players
        .filter(
          (player) =>
            !adminSearchTerm ||
            player.name.toLocaleLowerCase().includes(adminSearchTerm),
        )
        .sort(currentUserFirst)
    : [];
  const saveGames = (next: GameSession[]) => setGames(next);
  const refreshTeams = useCallback(
    (gameSession: GameSession, allPlayers = players): GameSession => {
      const paidPlayers = allPlayers.filter(
        (player) =>
          gameSession.playerIds.includes(player.id) &&
          gameSession.paidPlayerIds.includes(player.id),
      );
      return {
        ...gameSession,
        teams:
          paidPlayers.length > 1 ? generateBalancedTeams(paidPlayers) : null,
      };
    },
    [players],
  );
  const fillOpenSpots = useCallback((gameSession: GameSession) => {
    const playersToPromote = gameSession.waitlistIds.slice(
      0,
      Math.max(0, gameSession.maxPlayers - gameSession.playerIds.length),
    );
    return {
      ...gameSession,
      playerIds: [...gameSession.playerIds, ...playersToPromote],
      waitlistIds: gameSession.waitlistIds.slice(playersToPromote.length),
    };
  }, []);
  useEffect(() => {
    const hasOpenSpotWithWaitingPlayer = games.some(
      (gameSession) =>
        gameSession.playerIds.length < gameSession.maxPlayers &&
        gameSession.waitlistIds.length > 0,
    );
    if (!hasOpenSpotWithWaitingPlayer) return;

    setGames(
      games.map((gameSession) =>
        gameSession.playerIds.length < gameSession.maxPlayers &&
        gameSession.waitlistIds.length > 0
          ? refreshTeams(fillOpenSpots(gameSession), players)
          : gameSession,
      ),
    );
  }, [fillOpenSpots, games, players, refreshTeams, setGames]);
  const updateGame = (gameSession: GameSession, shouldRefreshTeams = true) => {
    const previousGame = games.find(
      (storedGame) => storedGame.id === gameSession.id,
    );
    const rosterOrPaymentChanged =
      previousGame !== undefined &&
      (!samePlayerIds(previousGame.playerIds, gameSession.playerIds) ||
        !samePlayerIds(previousGame.paidPlayerIds, gameSession.paidPlayerIds));
    const refreshedGame =
      shouldRefreshTeams && rosterOrPaymentChanged
        ? refreshTeams(gameSession)
        : gameSession;
    if (refreshedGame.teams) setBalanceNotice("");
    saveGames(
      games.map((storedGame) =>
        storedGame.id === refreshedGame.id ? refreshedGame : storedGame,
      ),
    );
  };
  const updateCancellationSettings = (
    gameSession: GameSession,
    changes: Partial<Pick<GameSession, "minPlayers" | "cancellationHours">>,
  ) => {
    const nextGame = { ...gameSession, ...changes };
    const cancellationTime =
      nextGame.cancellationHours === null
        ? null
        : gameTimestamp(nextGame) - nextGame.cancellationHours * 60 * 60 * 1000;

    if (
      nextGame.minPlayers !== null &&
      cancellationTime !== null &&
      cancellationTime < Date.now()
    ) {
      setCancellationNotice(
        "O horário de cancelamento é anterior ao horário de criação do evento.",
      );
      return;
    }

    setCancellationNotice("");
    updateGame(nextGame, false);
  };
  const createOrEdit = (e: FormEvent) => {
    e.preventDefault();
    if (
      !gameForm.date ||
      !gameForm.time ||
      !gameForm.duration ||
      !gameForm.courtCost ||
      !gameForm.maxPlayers ||
      !gameForm.paymentInfo
    ) {
      setNotice("Preencha todos os detalhes do jogo.");
      return;
    }
    if (!isValidIsoDate(gameForm.date)) {
      setNotice("Informe uma data válida no formato DD/MM/AAAA.");
      return;
    }
    const endTime = endTimeFromDuration(gameForm.time, gameForm.duration);
    if (!endTime) {
      setNotice("A duração precisa terminar no mesmo dia.");
      return;
    }
    if (!editGame && gameForm.date < today) {
      setNotice("Não é possível criar um jogo em uma data passada.");
      return;
    }
    if (
      games.some(
        (storedGame) =>
          storedGame.id !== editGame &&
          storedGame.date === gameForm.date &&
          storedGame.time === gameForm.time &&
          normalizeText(storedGame.location) ===
            normalizeText(gameForm.location) &&
          normalizeText(storedGame.courtNumber) ===
            normalizeText(gameForm.courtNumber),
      )
    ) {
      setNotice("Já existe um jogo com esses mesmos dados.");
      return;
    }
    if (editGame) {
      const old = games.find((g) => g.id === editGame)!;
      const active = old.playerIds.slice(0, gameForm.maxPlayers);
      const overflow = old.playerIds.slice(gameForm.maxPlayers);
      const updatedGame = refreshTeams({
        ...old,
        ...gameForm,
        endTime,
        duration: gameForm.duration,
        courtCost: +gameForm.courtCost,
        maxPlayers: +gameForm.maxPlayers,
        playerIds: active,
        waitlistIds: [...overflow, ...old.waitlistIds],
        paidPlayerIds: old.paidPlayerIds.filter((x) => active.includes(x)),
      });
      updateGame(updatedGame);
      setGameId(null);
      setNotice("Jogo atualizado.");
    } else {
      const g: GameSession = {
        id: nextIdentifier(games),
        ...gameForm,
        endTime,
        duration: gameForm.duration,
        courtCost: +gameForm.courtCost,
        maxPlayers: +gameForm.maxPlayers,
        playerIds: [],
        waitlistIds: [],
        paidPlayerIds: [],
        teams: null,
        minPlayers: null,
        cancellationHours: 2,
        cancelled: false,
      };
      saveGames([...games, g]);
      setGameId(g.id);
      setIsGameCreationOpen(false);
      setNotice("Jogo criado.");
    }
    setEditGame(null);
    setIsGameCreationOpen(false);
    setGameForm(emptyGame);
  };
  const savePlayer = (e: FormEvent) => {
    e.preventDefault();
    const name = playerForm.name.trim();
    if (!name) return;
    if (name.length > 20) {
      setNotice("O nome deve ter no máximo 20 caracteres.");
      return;
    }
    if (
      players.some(
        (p) =>
          normalizeText(p.name) === normalizeText(name) && p.id !== editPlayer,
      )
    ) {
      setNotice("Esse nome já está na lista.");
      return;
    }
    const isNewPlayer = editPlayer === null;
    const next = editPlayer
      ? players.map((p) =>
          p.id === editPlayer
            ? {
                ...p,
                ...playerForm,
                name,
                ownerUserId:
                  p.ownerUserId ??
                  (currentUser &&
                  normalizeText(name) === normalizeText(currentUser.displayName)
                    ? currentUser.id
                    : undefined),
              }
            : p,
        )
      : [
          ...players,
          {
            id: nextIdentifier(players),
            ...playerForm,
            name,
            ownerUserId:
              currentUser &&
              normalizeText(name) === normalizeText(currentUser.displayName)
                ? currentUser.id
                : undefined,
          },
        ];
    setPlayers(next);
    saveGames(
      games.map((g) => {
        const editedPlayerIsPlaying =
          editPlayer !== null && g.playerIds.includes(editPlayer);
        const updated =
          isNewPlayer && game && g.id === game.id
            ? {
                ...g,
                waitlistIds: [...g.waitlistIds, next[next.length - 1].id],
              }
            : g;
        const filledGame = fillOpenSpots(updated);
        return editedPlayerIsPlaying ||
          !samePlayerIds(updated.playerIds, filledGame.playerIds)
          ? refreshTeams(filledGame, next)
          : filledGame;
      }),
    );
    setPlayerForm(emptyPlayer);
    setEditPlayer(null);
    setIsPlayerFormOpen(false);
    setPlayerFormNotice(
      isNewPlayer
        ? "Jogador adicionado com sucesso."
        : "Jogador atualizado com sucesso.",
    );
  };
  const removePlayerFromGame = (playerId: number) => {
    if (!game) return;
    updateGame(
      fillOpenSpots({
        ...game,
        playerIds: game.playerIds.filter((id) => id !== playerId),
        waitlistIds: game.waitlistIds.filter((id) => id !== playerId),
        paidPlayerIds: game.paidPlayerIds.filter((id) => id !== playerId),
      }),
    );
    setEntered(false);
    setPick("");
  };
  const deletePlayerFromDirectory = (pid: number) => {
    const next = players.filter((p) => p.id !== pid);
    setPlayers(next);
    saveGames(
      games.map((g) => {
        const playerWasPlaying = g.playerIds.includes(pid);
        const filledGame = fillOpenSpots({
          ...g,
          playerIds: g.playerIds.filter((x) => x !== pid),
          waitlistIds: g.waitlistIds.filter((x) => x !== pid),
          paidPlayerIds: g.paidPlayerIds.filter((x) => x !== pid),
        });
        return playerWasPlaying ? refreshTeams(filledGame, next) : filledGame;
      }),
    );
    setEntered(false);
    setPick("");
  };
  const join = () => {
    if (!game) return false;
    const player = players.find((item) => isCurrentUserPlayer(item, currentUser));
    if (!player) {
      setNotice("Escolha um nome válido da busca.");
      return false;
    }
    const pid = player.id;
    if (game.playerIds.includes(pid) || game.waitlistIds.includes(pid)) {
      setNotice("Esse jogador já está na lista deste jogo.");
      return false;
    }
    if (!game.playerIds.includes(pid) && !game.waitlistIds.includes(pid)) {
      updateGame(
        game.playerIds.length < game.maxPlayers
          ? { ...game, playerIds: [...game.playerIds, pid] }
          : { ...game, waitlistIds: [...game.waitlistIds, pid] },
      );
    }
    setEntered(true);
    return true;
  };
  const requestParticipation = (e: FormEvent) => {
    e.preventDefault();
    const name = requestName.trim();
    if (!name) return false;
    if (name.length > 12) {
      setNotice("O nome deve ter no máximo 12 caracteres.");
      return false;
    }
    if (
      players.some((p) => normalizeText(p.name) === normalizeText(name)) ||
      requests.some((r) => normalizeText(r.name) === normalizeText(name))
    ) {
      setNotice("Esse nome já existe. Altere seu nome para continuar.");
      return false;
    }
    if (
      currentUser &&
      normalizeText(name) !== normalizeText(currentUser.displayName)
    ) {
      const wouldDuplicateOwnedProfile = groups.some((group) =>
        group.players.some((player) => player.ownerUserId === currentUser.id) &&
        group.players.some(
          (player) =>
            player.ownerUserId !== currentUser.id &&
            normalizeText(player.name) === normalizeText(name),
        ),
      );
      if (wouldDuplicateOwnedProfile) {
        setNotice("Esse nome já existe. Altere seu nome para continuar.");
        return false;
      }
      setGroups((currentGroups) =>
        currentGroups.map((group) => ({
          ...group,
          players: group.players.map((player) =>
            player.ownerUserId === currentUser.id ? { ...player, name } : player,
          ),
        })),
      );
      setCurrentUser({ ...currentUser, displayName: name });
    }
    setRequests([
      ...requests,
      {
        id: nextIdentifier(requests),
        name,
        requesterUserId: currentUser?.id,
        gameId: game?.id,
      },
    ]);
    setRequestName("");
    setNotice("Solicitação enviada ao organizador.");
    return true;
  };
  const requestLeave = () => {
    if (!game) return false;
    const player = players.find((item) => isCurrentUserPlayer(item, currentUser));
    if (!player) {
      setNotice("Escolha um nome válido da busca.");
      return false;
    }
    if (!isCurrentUserPlayer(player, currentUser)) {
      setNotice("Você só pode sair com o seu próprio nome.");
      return false;
    }
    const isOnGameList =
      game.playerIds.includes(player.id) ||
      game.waitlistIds.includes(player.id);
    if (!isOnGameList) {
      setNotice("Esse jogador não está na lista deste jogo.");
      return false;
    }
    updateGame(
      fillOpenSpots({
        ...game,
        playerIds: game.playerIds.filter((id) => id !== player.id),
        waitlistIds: game.waitlistIds.filter((id) => id !== player.id),
        paidPlayerIds: game.paidPlayerIds.filter((id) => id !== player.id),
      }),
    );
    setEntered(false);
    setPick("");
    return true;
  };
  const leaveMyGame = (selectedGame: GameSession) => {
    setGroups((currentGroups) =>
      currentGroups.map((group) => {
        const player = group.players.find((item) =>
          isCurrentUserPlayer(item, currentUser),
        );
        if (!player) return group;
        return {
          ...group,
          games: group.games.map((gameSession) => {
            if (gameSession !== selectedGame) return gameSession;
            return refreshTeams(
              fillOpenSpots({
                ...gameSession,
                playerIds: gameSession.playerIds.filter(
                  (id) => id !== player.id,
                ),
                waitlistIds: gameSession.waitlistIds.filter(
                  (id) => id !== player.id,
                ),
                paidPlayerIds: gameSession.paidPlayerIds.filter(
                  (id) => id !== player.id,
                ),
              }),
              group.players,
            );
          }),
        };
      }),
    );
    setGuestGameIds((current) =>
      current.filter((gameId) => gameId !== selectedGame.id),
    );
  };
  const confirmPayment = (playerId: number, isPaid: boolean) => {
    if (!game) return false;
    const player = players.find((item) => item.id === playerId);
    if (!player) return false;
    updateGame({
      ...game,
      paidPlayerIds: isPaid
        ? [...new Set([...game.paidPlayerIds, playerId])]
        : game.paidPlayerIds.filter((id) => id !== playerId),
    });
    setRequests([
      ...requests.filter(
        (request) =>
          !(
            request.type === "payment" &&
            request.gameId === game.id &&
            request.playerId === playerId
          ),
      ),
      {
        id: nextIdentifier(requests),
        name: player.name,
        gameId: game.id,
        playerId,
        type: "payment",
        paymentConfirmed: isPaid,
      },
    ]);
    return true;
  };
  const approveRequest = (r: ParticipationRequest) => {
    if (r.type === "payment") {
      setRequests(requests.filter((request) => request.id !== r.id));
      return;
    }
    if (r.type === "leave") {
      const requestedGame = games.find(
        (gameSession) => gameSession.id === r.gameId,
      );
      const playerId = r.playerId;
      if (requestedGame && playerId !== undefined) {
        const playerWasPlaying = requestedGame.playerIds.includes(playerId);
        const updatedGame = fillOpenSpots({
          ...requestedGame,
          playerIds: requestedGame.playerIds.filter((id) => id !== playerId),
          waitlistIds: requestedGame.waitlistIds.filter(
            (id) => id !== playerId,
          ),
          paidPlayerIds: requestedGame.paidPlayerIds.filter(
            (id) => id !== playerId,
          ),
        });
        saveGames(
          games.map((gameSession) =>
            gameSession.id === requestedGame.id
              ? playerWasPlaying
                ? refreshTeams(updatedGame, players)
                : updatedGame
              : gameSession,
          ),
        );
      }
      setRequests(requests.filter((request) => request.id !== r.id));
      return;
    }
    if (players.some((p) => normalizeText(p.name) === normalizeText(r.name))) {
      setNotice("Esse nome já está cadastrado.");
      return;
    }
    const newPlayer = {
      id: nextIdentifier(players),
      name: r.name,
      ownerUserId: r.requesterUserId,
      level: 3,
      mobility: "neutro" as Mobility,
      condition: "neutro" as Condition,
      position: "neutro" as Position,
    };
    const nextPlayers = [...players, newPlayer];
    setPlayers(nextPlayers);
    const requestedGameId =
      r.gameId ??
      [...games]
        .filter((gameSession) => !hasGameEnded(gameSession))
        .sort(chronological)[0]?.id;
    if (requestedGameId !== undefined) {
      saveGames(
        games.map((gameSession) =>
          gameSession.id === requestedGameId
            ? (() => {
                const updatedGame = {
                  ...gameSession,
                  waitlistIds: [...gameSession.waitlistIds, newPlayer.id],
                };
                const filledGame = fillOpenSpots(updatedGame);
                return samePlayerIds(
                  updatedGame.playerIds,
                  filledGame.playerIds,
                )
                  ? filledGame
                  : refreshTeams(filledGame, nextPlayers);
              })()
            : gameSession,
        ),
      );
    }
    setRequests(requests.filter((x) => x.id !== r.id));
  };
  if (access === "groups")
    return (
      <GroupSelector
        groups={groups}
        language={language}
        adminGroupIds={currentUser?.adminGroupIds ?? (currentUser?.devGodMode ? groups.map((group) => group.id) : [])}
        onBack={() => {
          setActiveGroupId(null);
          setAccess("home");
        }}
        onCreate={(name, organizerPasscode) => {
          const group: PlayerGroup = {
            id: createGroupId(),
            name,
            organizerPasscode,
            createdAt: new Date().toISOString(),
            players: [],
            games: [],
            requests: [],
          };
          setGroups([...groups, group]);
          setCurrentUser((user) =>
            user
              ? { ...user, adminGroupIds: [...new Set([...(user.adminGroupIds ?? []), group.id])] }
              : user,
          );
          setActiveGroupId(group.id);
          setAccess("player");
        }}
        onChoose={(group) => {
          setActiveGroupId(group.id);
          setGameId(null);
          setReturnToDashboardAfterGame(false);
          setInviteKind(null);
          setEntered(false);
          setPick("");
          setAccess("player");
        }}
        onManage={(group) => {
          setActiveGroupId(group.id);
          setGameId(null);
          setReturnToDashboardAfterGame(false);
          setInviteKind(null);
          setAccess("admin");
        }}
        onChangePasscode={(groupId, organizerPasscode) =>
          setGroups(
            groups.map((group) =>
              group.id === groupId ? { ...group, organizerPasscode } : group,
            ),
          )
        }
        onRename={(groupId, name) =>
          setGroups(
            groups.map((group) =>
              group.id === groupId ? { ...group, name } : group,
            ),
          )
        }
        myGames={myGames}
        onOpenMyGame={(selectedGame) => {
          const group = groups.find((candidate) =>
            candidate.games.some((gameSession) => gameSession === selectedGame),
          );
          if (!group) return;
          setActiveGroupId(group.id);
          setGameId(selectedGame.id);
          setReturnToDashboardAfterGame(true);
          setInviteKind(null);
          setEntered(false);
          setPick("");
          setAccess("player");
        }}
        onLeaveMyGame={leaveMyGame}
        onAddMyGame={() => {
          const firstGame = groups
            .flatMap((group) => group.games)
            .find((gameSession) => !hasGameEnded(gameSession));
          if (firstGame) {
            setGuestGameIds((current) =>
              current.includes(firstGame.id) ? current : [...current, firstGame.id],
            );
          }
        }}
        onDelete={(groupId) => {
          setGroups(groups.filter((group) => group.id !== groupId));
          if (activeGroupId === groupId) {
            setActiveGroupId(null);
          }
        }}
      />
    );
  if (access === "home")
    return (
      <LandingPage
        language={language}
        user={currentUser}
        onSaveUser={({ displayName, email }) => {
          const userId = currentUser?.id ?? createGroupId();
          const hasDuplicate = groups.some((group) =>
            group.players.some(
              (player) =>
                player.ownerUserId !== userId &&
                normalizeText(player.name) === normalizeText(displayName),
            ),
          );
          if (hasDuplicate) return "Esse nome já está na lista.";
          setGroups((currentGroups) =>
            currentGroups.map((group) => ({
              ...group,
              players: group.players.map((player) =>
                player.ownerUserId === userId
                  ? { ...player, name: displayName }
                  : player,
              ),
            })),
          );
          setCurrentUser((user) =>
            user
              ? { ...user, displayName, email, emailVerified: true }
              : {
                  id: userId,
                  displayName,
                  email,
                  emailVerified: true,
                  devGodMode: true,
                  createdAt: new Date().toISOString(),
                },
          );
          return null;
        }}
        onLanguageChange={setLanguage}
        onEnter={() => {
          setGameId(null);
          setEntered(false);
          setPick("");
          setActiveGroupId(null);
          setAccess("groups");
        }}
      />
    );
  if (access === "player")
    return (
      <PlayerView
        games={games.filter(visibleToPlayers).sort(chronological)}
        game={game && !hasGameEnded(game) ? game : null}
        choose={(g) => {
          setGameId(g);
          setEntered(false);
          setPick("");
          setNotice("");
        }}
        backToGameSelection={() => {
          setGameId(null);
          setEntered(false);
          setPick("");
          if (returnToDashboardAfterGame) {
            setReturnToDashboardAfterGame(false);
            setAccess("groups");
          }
        }}
        backToGroups={() => {
          setGameId(null);
          setEntered(false);
          setPick("");
          setAccess("groups");
        }}
        players={players}
        user={currentUser}
        isGroupMember={players.some((player) =>
          isCurrentUserPlayer(player, currentUser),
        ) || (currentUser?.adminGroupIds ?? (currentUser?.devGodMode ? [activeGroupId] : [])).includes(activeGroupId ?? "")}
        onManageGroup={
          (currentUser?.adminGroupIds ?? (currentUser?.devGodMode ? [activeGroupId] : [])).includes(activeGroupId ?? "")
            ? () => setAccess("admin")
            : undefined
        }
        join={join}
        exit={() => {
          setAccess("home");
          setEntered(false);
          setPick("");
          setRequestName("");
          setNotice("");
        }}
        requestName={requestName}
        setRequestName={setRequestName}
        request={requestParticipation}
        requestLeave={requestLeave}
        confirmPayment={confirmPayment}
        notice={notice}
        language={language}
      />
    );
  if (access === "my-games") {
    return (
      <MyGames
        games={myGames}
        language={language}
        onBack={() => setAccess("groups")}
        onRequestGame={() => {
          const firstGame = groups.flatMap((group) => group.games).find((gameSession) => !hasGameEnded(gameSession));
          if (firstGame) setGuestGameIds((current) => current.includes(firstGame.id) ? current : [...current, firstGame.id]);
        }}
      />
    );
  }
  if (access === "admin" && requests.length)
    return (
      <ParticipationRequests
        games={games}
        language={language}
        requests={requests}
        onApprove={approveRequest}
        onBack={() => {
          setActiveGroupId(null);
          setAccess("groups");
        }}
      />
    );

  const deleteGame = (gameSession: GameSession) => {
    saveGames(games.filter((storedGame) => storedGame.id !== gameSession.id));
    if (gameId === gameSession.id) {
      setGameId(null);
      setEditGame(null);
    }
  };

  const editGameDetails = (gameSession: GameSession) => {
    setGameId(null);
    setEditGame(gameSession.id);
    setGameForm({ ...gameSession });
    setIsGameCreationOpen(true);
  };

  const confirmRemoval = (removeAction: () => void) => {
    setPendingRemoval(() => removeAction);
  };

  return (
    <main className="app-shell">
      <Header
        backLabel={localize("Voltar", language)}
        showBackArrow
        onBack={() => {
          if (game) {
            setGameId(null);
            setEditGame(null);
            setIsGameCreationOpen(false);
            return;
          }
          setNotice("");
          setBalanceNotice("");
          setEditGame(null);
          setGameForm(emptyGame);
          setIsGameCreationOpen(false);
          setActiveGroupId(null);
          setAccess("groups");
        }}
        onHome={() => {
          setNotice("");
          setBalanceNotice("");
          setGameId(null);
          setEditGame(null);
          setGameForm(emptyGame);
          setIsGameCreationOpen(false);
          setAccess("home");
        }}
      />
      {game && !hasGameEnded(game) ? (
        <section className="hero game-hero">
          {game.cancelled && (
            <span className="game-cancelled-tag">
              {localize("CANCELADO", language)}
            </span>
          )}
          <div>
            <h1>
              {localize("Gerencie o", language)}{" "}
              <em>{localize("jogo", language)}</em>
            </h1>
            <EventSummary game={game} language={language} />
          </div>
          <div className="hero-game-actions">
            <button
              className="secondary hero-game-action"
              onClick={() => {
                setInviteCodeCopied(false);
                setInviteKind("game");
              }}
            >
              {localize("Convidar para este jogo", language)}
            </button>
            <button
              className={`hero-game-action session-action-button ${game.cancelled ? "reactivate-game" : "delete"}`}
              onClick={() =>
                updateGame(
                  {
                    ...game,
                    cancelled: !game.cancelled,
                    teams: game.cancelled ? game.teams : null,
                  },
                  false,
                )
              }
            >
              {localize(
                game.cancelled ? "Reativar jogo" : "Cancelar jogo",
                language,
              )}
            </button>
          </div>
        </section>
      ) : !game ? (
        <section className="game-directory-heading">
          <h1>
            {localize("Gerenciar", language)}{" "}
            <em>{localize("jogos", language)}</em>
          </h1>
          <div className="game-directory-actions">
            <button
              className="session-action-button edit new-game-button"
              onClick={() => {
                setEditGame(null);
                setGameForm(emptyGame);
                setIsGameCreationOpen(true);
              }}
            >
              + {localize("Novo jogo", language)}
            </button>
          </div>
        </section>
      ) : null}
      {!game && (
        <section className="panel session-panel">
          {games.length > 0 ? (
            <div className="session-tabs">
              {[...games].sort(chronological).map((gameSession) => {
                const isPastGame = hasGameEnded(gameSession);

                return (
                  <div
                    className={`session-row ${gameSession.id === gameId ? "active" : ""} ${isPastGame ? "ended" : ""}`}
                    key={gameSession.id}
                  >
                    <CompactGameDetails
                      game={gameSession}
                      language={language}
                    />
                    <div className="session-row-actions">
                      <button
                        className="session-action-button view"
                        onClick={() => {
                          setGameId(gameSession.id);
                          setEditGame(null);
                          setIsGameCreationOpen(false);
                        }}
                      >
                        {localize("Ver", language)}
                      </button>
                      <button
                        className="session-action-button edit"
                        aria-label={localize("Editar", language)}
                        disabled={isPastGame}
                        onClick={() => editGameDetails(gameSession)}
                      >
                        {localize("Editar", language)}
                      </button>
                      <button
                        className="session-action-button delete"
                        aria-label={localize("Deletar", language)}
                        onClick={() => setGameToDelete(gameSession)}
                      >
                        {localize("Deletar", language)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty">{localize("Nenhum jogo criado", language)}</p>
          )}
        </section>
      )}
      {isGameCreationOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog game-form-modal"
            role="dialog"
          >
            <p className="form-mode">
              {localize(editGame ? "EDITAR JOGO" : "NOVO JOGO", language)}
            </p>
            <GameForm
              draft={gameForm}
              onChange={setGameForm}
              isEditing={Boolean(editGame)}
              language={language}
              onSubmit={createOrEdit}
              onCancel={() => {
                setEditGame(null);
                setGameForm(emptyGame);
                setIsGameCreationOpen(false);
              }}
            />
          </section>
        </div>
      )}
      {!game && (
        <PlayerDirectoryManager
          language={language}
          players={players}
          currentUser={currentUser}
          onAddPlayer={(player) => {
            if (
              players.some(
                (existingPlayer) =>
                  normalizeText(existingPlayer.name) ===
                  normalizeText(player.name),
              )
            ) {
              setNotice("Esse nome já está na lista.");
              return false;
            }
            setPlayers([
              ...players,
              {
                id: nextIdentifier(players),
                ...player,
                ownerUserId:
                  currentUser &&
                  normalizeText(player.name) ===
                    normalizeText(currentUser.displayName)
                    ? currentUser.id
                    : player.ownerUserId,
              },
            ]);
            return true;
          }}
          onUpdatePlayer={(updatedPlayer) => {
            if (
              players.some(
                (player) =>
                  player.id !== updatedPlayer.id &&
                  normalizeText(player.name) ===
                    normalizeText(updatedPlayer.name),
              )
            ) {
              setNotice("Esse nome já está na lista.");
              return false;
            }
            const nextPlayers = players.map((player) =>
              player.id === updatedPlayer.id
                ? {
                    ...updatedPlayer,
                    ownerUserId:
                      player.ownerUserId ??
                      (currentUser &&
                      normalizeText(updatedPlayer.name) ===
                        normalizeText(currentUser.displayName)
                        ? currentUser.id
                        : undefined),
                  }
                : player,
            );
            setPlayers(nextPlayers);
            saveGames(
              games.map((gameSession) =>
                gameSession.playerIds.includes(updatedPlayer.id)
                  ? refreshTeams(gameSession, nextPlayers)
                  : gameSession,
              ),
            );
            return true;
          }}
          onDeletePlayer={deletePlayerFromDirectory}
        />
      )}
      {game && hasGameEnded(game) ? (
        <ReadOnlyGame game={game} players={players} language={language} />
      ) : (
        game && (
          <fieldset
            className="game-management-controls"
            disabled={game.cancelled}
          >
            <section className="stat-grid">
              <div>
                <strong>
                  {listed.length}/{game.maxPlayers}
                </strong>
                <span>{localize("na lista", language)}</span>
              </div>
              <div>
                <strong>{game.waitlistIds.length}</strong>
                <span>{localize("lista de espera", language)}</span>
              </div>
              <div>
                <strong>{paid.length}</strong>
                <span>{localize("pagos / confirmados", language)}</span>
              </div>
              <div>
                <strong>
                  {currencySymbol(game.currency)} {price(game).toFixed(2)}
                </strong>
                <span>{localize("por jogador", language)}</span>
              </div>
            </section>
            <div className="admin-grid">
              <section className="panel roster">
                <div className="panel-heading">
                  <h2>
                    Participantes:{" "}
                    <span className="badge">
                      {game.playerIds.length}/{game.maxPlayers}
                    </span>
                  </h2>
                </div>
                <div className="admin-player-search">
                  <div className="admin-player-search-controls">
                    <input
                      value={adminPlayerSearch}
                      placeholder={localize("Buscar jogadores", language)}
                      autoComplete="off"
                      onFocus={() => setIsAdminPlayerSearchOpen(true)}
                      onBlur={() =>
                        window.setTimeout(
                          () => setIsAdminPlayerSearchOpen(false),
                          150,
                        )
                      }
                      onChange={(e) => setAdminPlayerSearch(e.target.value)}
                    />
                    <button
                      className="primary"
                      onClick={() => {
                        setEditPlayer(null);
                        setPlayerForm(emptyPlayer);
                        setPlayerFormNotice("");
                        setIsPlayerFormOpen(true);
                      }}
                    >
                      {localize("+ Adicionar jogador", language)}
                    </button>
                  </div>
                  {playerSearchResults.length > 0 && (
                    <div className="admin-player-search-results">
                      {playerSearchResults.map((player) => {
                        const isListed = game.playerIds.includes(player.id);
                        const isWaiting = game.waitlistIds.includes(player.id);

                        return (
                          <div key={player.id}>
                            <span>
                              {player.name}
                              {isCurrentUserPlayer(player, currentUser) &&
                                ` (${localize("você", language)})`}
                            </span>
                            {isListed ? (
                              <small>{localize("na lista", language)}</small>
                            ) : isWaiting ? (
                              <small>
                                {localize("na lista de espera", language)}
                              </small>
                            ) : (
                              <button
                                className="text-button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() =>
                                  addPlayerToGame(game, player.id, updateGame)
                                }
                              >
                                Adicionar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {playerFormNotice && (
                    <p className="success directory-message">
                      ✓ {localize(playerFormNotice, language)}
                    </p>
                  )}
                </div>
                <section className="player-list">
                  {listed.map((p) => {
                    const score = playerScoreBreakdown(p);
                    const isPaid = game.paidPlayerIds.includes(p.id);
                    const scoreLabel = `${score.level.toFixed(2)} ${score.mobility >= 0 ? "+" : ""}${score.mobility.toFixed(2)} ${score.condition >= 0 ? "+" : ""}${score.condition.toFixed(2)} = ${score.total.toFixed(2)}`;

                    return (
                      <article
                        className={`player-row ${isPaid ? "is-paid" : "is-pending"}`}
                        key={p.id}
                      >
                        <div className="player-name">
                          <strong>
                            {p.name}
                            <span
                              aria-label={localize(
                                isPaid ? "Pago" : "Pendente",
                                language,
                              )}
                              className={`player-payment-mark ${isPaid ? "paid" : "pending"}`}
                            >
                              {isPaid ? "✓" : "×"}
                            </span>
                          </strong>
                          <span>
                            {localize("Nível", language)} {p.level}
                            {p.condition !== "neutro" && (
                              <> · {p.condition === "boa" ? "↑" : "↓"}</>
                            )}
                            <>
                              {" "}
                              ·{" "}
                              {localize(
                                p.position === "goleiro"
                                  ? "Goleiro"
                                  : p.position === "defesa"
                                    ? "Defesa"
                                    : p.position === "ataque"
                                      ? "Ataque"
                                      : "Neutra",
                                language,
                              )}
                            </>{" "}
                            <span title={scoreLabel} className="player-score">
                              (
                              {score.total.toLocaleString(
                                language === "pt" ? "pt-BR" : "en-US",
                                {
                                  maximumFractionDigits: 2,
                                },
                              )}{" "}
                              {localize("pontos", language)})
                            </span>
                          </span>
                        </div>
                        <div className="player-row-actions">
                          {game.playerIds.includes(p.id) ? (
                            <label className="payment-checkbox">
                              <input
                                checked={isPaid}
                                onChange={() => {
                                  const paidIds = isPaid
                                    ? game.paidPlayerIds.filter(
                                        (x) => x !== p.id,
                                      )
                                    : [...game.paidPlayerIds, p.id];
                                  updateGame({
                                    ...game,
                                    paidPlayerIds: paidIds,
                                    playerIds: paidPlayersFirst(
                                      game.playerIds,
                                      paidIds,
                                    ),
                                  });
                                }}
                                type="checkbox"
                              />
                              <span>{localize("Pago", language)}</span>
                            </label>
                          ) : game.waitlistIds.includes(p.id) ? (
                            <button
                              aria-label={localize(
                                "O jogador será incluído na última vaga pendente.",
                                language,
                              )}
                              className="text-button waitlist-include"
                              data-tooltip={localize(
                                "O jogador será incluído na última vaga pendente.",
                                language,
                              )}
                              onClick={() =>
                                promoteWaitlistedPlayer(game, p.id, updateGame)
                              }
                            >
                              Incluir na lista
                            </button>
                          ) : (
                            <button
                              className="text-button"
                              onClick={() =>
                                addPlayerToGame(game, p.id, updateGame)
                              }
                            >
                              Adicionar
                            </button>
                          )}
                          <button
                            aria-label={localize("Editar jogador", language)}
                            className="icon-button subtle-tooltip"
                            data-tooltip={localize("Editar jogador", language)}
                            onClick={() => {
                              setEditPlayer(p.id);
                              setPlayerFormNotice("");
                              setIsPlayerFormOpen(true);
                              setPlayerForm({
                                name: p.name,
                                level: p.level,
                                mobility: p.mobility,
                                condition: p.condition,
                                position: p.position,
                              });
                            }}
                          >
                            ✎
                          </button>
                          <button
                            aria-label={localize(
                              "Remover jogador da lista",
                              language,
                            )}
                            className="icon-button danger subtle-tooltip"
                            data-tooltip={localize(
                              "Remover jogador da lista",
                              language,
                            )}
                            onClick={() =>
                              confirmRemoval(() => removePlayerFromGame(p.id))
                            }
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </section>
                <section className="waitlist-inline">
                  <p className="eyebrow">
                    {localize("LISTA DE ESPERA", language)}
                  </p>
                  {game.waitlistIds.length ? (
                    waiting.map((waitingPlayer, index) => {
                      return (
                        <div className="waitlist-player" key={waitingPlayer.id}>
                          <strong>
                            {game.playerIds.length + index + 1} -{" "}
                            {waitingPlayer.name}
                          </strong>
                          <button
                            aria-label={localize(
                              "O jogador será incluído na última vaga pendente.",
                              language,
                            )}
                            className="text-button waitlist-include"
                            data-tooltip={localize(
                              "O jogador será incluído na última vaga pendente.",
                              language,
                            )}
                            onClick={() =>
                              promoteWaitlistedPlayer(
                                game,
                                waitingPlayer.id,
                                updateGame,
                              )
                            }
                          >
                            Incluir na lista
                          </button>
                          <button
                            className="icon-button danger subtle-tooltip"
                            aria-label={localize(
                              "Remover jogador da lista",
                              language,
                            )}
                            data-tooltip={localize(
                              "Remover jogador da lista",
                              language,
                            )}
                            onClick={() =>
                              confirmRemoval(() =>
                                removePlayerFromGame(waitingPlayer.id),
                              )
                            }
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="empty">{localize("Sem espera.", language)}</p>
                  )}
                </section>
                <section className="minimum-players-control">
                  <label>
                    <input
                      checked={game.minPlayers !== null}
                      onChange={(event) =>
                        updateCancellationSettings(game, {
                          minPlayers: event.target.checked ? 10 : null,
                          cancellationHours: game.cancellationHours,
                        })
                      }
                      type="checkbox"
                    />
                    {localize(
                      "Definir o número mínimo de jogadores necessário",
                      language,
                    )}
                  </label>
                  {game.minPlayers !== null && (
                    <div className="minimum-players-settings">
                      <label className="minimum-players-select">
                        {localize("Mínimo de jogadores", language)}
                        <select
                          value={game.minPlayers}
                          onChange={(event) =>
                            updateCancellationSettings(game, {
                              minPlayers: +event.target.value,
                            })
                          }
                        >
                          {Array.from(
                            { length: Math.max(1, game.maxPlayers - 1) },
                            (_, index) => index + 2,
                          ).map((minimum) => (
                            <option key={minimum} value={minimum}>
                              {minimum}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="minimum-players-select">
                        {localize("Cancelamento automático", language)}
                        <select
                          value={game.cancellationHours ?? ""}
                          onChange={(event) =>
                            updateCancellationSettings(game, {
                              cancellationHours: event.target.value
                                ? +event.target.value
                                : null,
                            })
                          }
                        >
                          <option value="">
                            {localize("Desabilitado", language)}
                          </option>
                          {[1, 2, 3, 4, 5, 6, 12, 24].map((hours) => (
                            <option key={hours} value={hours}>
                              {hours}{" "}
                              {localize(
                                hours === 1 ? "hora" : "horas",
                                language,
                              )}
                              {" "}
                              {localize("antes", language)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  {cancellationNotice && (
                    <small className="error">
                      {localize(cancellationNotice, language)}
                    </small>
                  )}
                </section>
              </section>
              <aside className="side-column">
                <section className="teams-section team-balance-panel">
                  <p className="balance-availability">
                    {localize(
                      "Balanceamento disponível para jogadores pagos",
                      language,
                    )}{" "}
                    ({paid.length}/{game.maxPlayers})
                  </p>
                  <button
                    className="primary team-balance-button"
                    onClick={() => {
                      if (game.playerIds.length === 0) {
                        setBalanceNotice("Ainda não há jogadores neste jogo.");
                        return;
                      }
                      if (paid.length === 0) {
                        setBalanceNotice("Ainda não há jogadores pagos.");
                        return;
                      }
                      if (paid.length < 2) {
                        setBalanceNotice(
                          "São necessários pelo menos dois jogadores pagos para gerar os times.",
                        );
                        return;
                      }
                      setBalanceNotice("");
                      updateGame(
                        {
                          ...game,
                          teams: generateBalancedTeams(paid),
                        },
                        false,
                      );
                    }}
                  >
                    {localize(
                      game.teams ? "Balancear novamente" : "Gerar times",
                      language,
                    )}
                  </button>
                  {balanceNotice && (
                    <p className="generate-notice">{balanceNotice}</p>
                  )}
                  {game.teams && (
                    <Teams embedded teams={game.teams} language={language} />
                  )}
                </section>
              </aside>
            </div>
          </fieldset>
        )
      )}
      {game && isPlayerFormOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog directory-player-modal"
            role="dialog"
          >
            <p className="form-mode">
              {localize(
                editPlayer !== null
                  ? "Editar jogador"
                  : "Adicionar novo jogador",
                language,
              )}
            </p>
            <form className="player-form" onSubmit={savePlayer}>
              <input
                className="player-form-name"
                required
                maxLength={20}
                placeholder={localize("Nome", language)}
                value={playerForm.name}
                onChange={(event) =>
                  setPlayerForm({ ...playerForm, name: event.target.value })
                }
              />
              <select
                className="player-form-level"
                value={playerForm.level}
                onChange={(event) =>
                  setPlayerForm({
                    ...playerForm,
                    level: Number(event.target.value),
                  })
                }
              >
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>
                    {localize("Nível", language)} {level}
                  </option>
                ))}
              </select>
              <select
                className="player-form-position"
                value={playerForm.position}
                onChange={(event) =>
                  setPlayerForm({
                    ...playerForm,
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
              <select
                className="player-form-mobility"
                value={playerForm.mobility}
                onChange={(event) =>
                  setPlayerForm({
                    ...playerForm,
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
                className="player-form-condition"
                value={playerForm.condition}
                onChange={(event) =>
                  setPlayerForm({
                    ...playerForm,
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
              <button className="primary player-form-submit">
                {localize(
                  editPlayer !== null ? "Salvar" : "Adicionar",
                  language,
                )}
              </button>
              <button
                className="session-action-button delete player-form-cancel"
                type="button"
                onClick={() => {
                  setEditPlayer(null);
                  setPlayerForm(emptyPlayer);
                  setIsPlayerFormOpen(false);
                }}
              >
                {localize("Cancelar", language)}
              </button>
            </form>
          </section>
        </div>
      )}
      {gameToDelete && (
        <ConfirmDialog
          kind="delete-game"
          language={language}
          onCancel={() => setGameToDelete(null)}
          onConfirm={() => {
            deleteGame(gameToDelete);
            setGameToDelete(null);
          }}
        />
      )}
      {pendingRemoval && (
        <ConfirmDialog
          kind="remove"
          language={language}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => {
            pendingRemoval();
            setPendingRemoval(null);
          }}
        />
      )}
      {inviteKind && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog group-auth-modal invite-modal"
            role="dialog"
          >
            <p className="form-mode">
              {localize(
                inviteKind === "group-admin"
                  ? "CONVITE DE ADMIN"
                  : inviteKind === "group-participant"
                    ? "CONVITE PARA O GRUPO"
                    : "CONVITE PARA O JOGO",
                language,
              )}
            </p>
            <p>
              {localize(
                inviteKind === "group-admin"
                  ? "Este convite pede a senha do grupo antes de liberar o acesso de admin."
                  : inviteKind === "group-participant"
                    ? "Este convite libera a visualização dos jogos ativos do grupo."
                    : "Este convite libera apenas este jogo para o convidado.",
                language,
              )}
            </p>
            <input readOnly value={inviteKind === "game" ? `PLAYUP-GAME-${game?.id ?? "DEMO"}` : `PLAYUP-GROUP-${activeGroup?.id ?? "DEMO"}`} />
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
                onClick={() => {
                  setInviteCodeCopied(false);
                  setInviteKind(null);
                }}
              >
                {localize("Fechar", language)}
              </button>
              <button
                className="primary"
                onClick={async () => {
                  const code =
                    inviteKind === "game"
                      ? `PLAYUP-GAME-${game?.id ?? "DEMO"}`
                      : `PLAYUP-GROUP-${activeGroup?.id ?? "DEMO"}`;
                  try {
                    await navigator.clipboard.writeText(code);
                    setInviteCodeCopied(true);
                  } catch {
                    setInviteCodeCopied(false);
                  }
                }}
              >
                {localize("Copiar código", language)}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
function PlayerView({
  games,
  game,
  choose,
  backToGameSelection,
  backToGroups,
  players,
  user,
  isGroupMember,
  onManageGroup,
  join,
  exit,
  requestName,
  setRequestName,
  request,
  requestLeave,
  confirmPayment,
  notice,
  language,
}: {
  games: GameSession[];
  game: GameSession | null;
  choose: (x: number) => void;
  backToGameSelection: () => void;
  backToGroups: () => void;
  players: Player[];
  user: CurrentUser | null;
  isGroupMember: boolean;
  onManageGroup?: () => void;
  join: () => boolean;
  exit: () => void;
  requestName: string;
  setRequestName: (x: string) => void;
  request: (e: FormEvent) => boolean;
  requestLeave: () => boolean;
  confirmPayment: (playerId: number, isPaid: boolean) => boolean;
  notice: string;
  language: "pt" | "en";
}) {
  const [activeAction, setActiveAction] = useState<
    "join" | "request" | "leave" | null
  >(null);
  const [isGameListOpen, setIsGameListOpen] = useState(Boolean(game));
  const [participationConfirmation, setParticipationConfirmation] = useState<
    "requested" | null
  >(null);
  const sortedPlayerIds = (playerIds: number[]) => playerIds;
  useEffect(() => {
    localizePage(language);
  });
  const closeGame = () => {
    setActiveAction(null);
    setParticipationConfirmation(null);
    setIsGameListOpen(false);
    backToGameSelection();
  };
  const isViewingGame = Boolean(game && isGameListOpen);
  const list = game && (
    <section className="participant-dashboard">
      {game.cancelled && (
        <p className="game-cancelled">{localize("CANCELADO", language)}</p>
      )}
      <h1>
        {language === "pt" ? (
          <>
            Lista do <em>jogo</em>
          </>
        ) : (
          <>
            Game <em>list</em>
          </>
        )}
      </h1>
      <EventSummary className="intro" game={game} language={language} />
      {game.disclaimer && (
        <p className="game-disclaimer">
          <strong>{localize("Aviso", language)}:</strong> {game.disclaimer}
        </p>
      )}
      <div className={`participant-grid ${game.teams ? "" : "without-teams"}`}>
        <section className="panel readonly-list">
          {game.playerIds.length === 0 ? (
            <p className="empty readonly-empty">
              {localize("A lista está vazia.", language)}
            </p>
          ) : (
            <>
              <h2>
                {localize("Participantes", language)} ({game.playerIds.length}/
                {game.maxPlayers})
              </h2>
              {sortedPlayerIds(game.playerIds).map((x, index) => (
                <div
                  className={`readonly-row ${game.paidPlayerIds.includes(x) ? "is-paid" : ""}`}
                  key={x}
                >
                  <span className="readonly-player-name">
                    <strong>
                      {index + 1} - {players.find((p) => p.id === x)?.name}
                      {isCurrentUserPlayer(players.find((p) => p.id === x)!, user) &&
                        ` (${localize("você", language)})`}
                    </strong>
                  </span>
                  <span className="readonly-payment-actions">
                    {isCurrentUserPlayer(players.find((p) => p.id === x), user) && (
                      <label className="readonly-payment-confirmation">
                        <input
                          checked={game.paidPlayerIds.includes(x)}
                          onChange={(event) => confirmPayment(x, event.target.checked)}
                          type="checkbox"
                        />
                        <span>{localize("Pago", language)}</span>
                      </label>
                    )}
                    <span
                      aria-label={localize(game.paidPlayerIds.includes(x) ? "Pago" : "Pendente", language)}
                      className={`readonly-payment-mark ${game.paidPlayerIds.includes(x) ? "paid" : "pending"}`}
                    >
                      {game.paidPlayerIds.includes(x) ? "✓" : "×"}
                    </span>
                  </span>
                </div>
              ))}
              <section className="waiting-list">
                <p className="waiting-list-label">
                  {localize("LISTA DE ESPERA", language)}
                </p>
                {sortedPlayerIds(game.waitlistIds).map((x, index) => (
                  <div className="wait-row" key={x}>
                    <span className="readonly-player-name">
                      {game.playerIds.length + index + 1} -{" "}
                      {players.find((p) => p.id === x)?.name}
                      {isCurrentUserPlayer(players.find((p) => p.id === x)!, user) &&
                        ` (${localize("você", language)})`}
                    </span>
                  </div>
                ))}
              </section>
            </>
          )}
        </section>
        {game.teams && (
          <section className="participant-teams">
            <Teams teams={game.teams} language={language} />
          </section>
        )}
      </div>
    </section>
  );
  return (
    <main className="participant-page">
      <Header
        backLabel={localize("Voltar", language)}
        onBack={game ? closeGame : backToGroups}
        onHome={exit}
      />
      {!isViewingGame ? (
        <>
          <section className="game-directory-heading participant-games-heading">
            <h1>
              {localize("Escolha o", language)}{" "}
              <em>{localize("jogo", language)}</em>
            </h1>
            {onManageGroup && (
              <button className="secondary" onClick={onManageGroup}>
                {localize("Gerenciar grupo", language)}
              </button>
            )}
          </section>
          <section className="panel participant-games-panel">
            {games.length ? (
              <div className="session-tabs participant-game-list">
                {games.map((g) => {
                  const isEnded = hasGameEnded(g);
                  const isCurrentUserAttending = g.playerIds.some((playerId) =>
                    isCurrentUserPlayer(
                      players.find((player) => player.id === playerId),
                      user,
                    ),
                  );
                  const isCurrentUserWaiting = g.waitlistIds.some((playerId) =>
                    isCurrentUserPlayer(
                      players.find((player) => player.id === playerId),
                      user,
                    ),
                  );
                  return (
                    <div
                      className={`session-row ${isEnded ? "ended" : ""}`}
                      key={g.id}
                    >
                      <CompactGameDetails game={g} language={language} waiting={isCurrentUserWaiting} />
                      <div className="session-row-actions">
                        <button
                          className="session-action-button view"
                          disabled={isEnded}
                          onClick={() => {
                            choose(g.id);
                            setIsGameListOpen(true);
                          }}
                        >
                          {localize("Ver", language)}
                        </button>
                        <button
                          className="session-action-button confirm"
                          disabled={isEnded || g.cancelled || isCurrentUserAttending || isCurrentUserWaiting}
                          onClick={() => {
                            choose(g.id);
                            setActiveAction("join");
                          }}
                        >
                          {localize(
                            isCurrentUserAttending
                              ? "Participando"
                              : isCurrentUserWaiting
                                ? "Na lista de espera"
                                : "Participar",
                            language,
                          )}
                        </button>
                        {!isGroupMember && (
                          <button
                            className="session-action-button request"
                            disabled={isEnded || g.cancelled}
                            onClick={() => {
                              choose(g.id);
                              setRequestName(user?.displayName ?? "");
                              setActiveAction("request");
                            }}
                          >
                            <span className="request-label-full">
                              {localize("Solicitar participação", language)}
                            </span>
                            <span className="request-label-compact">
                              {localize("Solicitar", language)}
                            </span>
                          </button>
                        )}
                        <button
                          className="session-action-button leave"
                          disabled={isEnded || g.cancelled || (!isCurrentUserAttending && !isCurrentUserWaiting)}
                          onClick={() => {
                            choose(g.id);
                            setActiveAction("leave");
                          }}
                        >
                          {localize("Sair da lista", language)}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="intro">
                {localize("Não existem jogos criados no momento.", language)}
              </p>
            )}
          </section>
        </>
      ) : (
        list
      )}
      {activeAction && game && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog participant-action-modal"
            role="dialog"
          >
            <p className="form-mode">
              {localize(
                activeAction === "join"
                  ? "Confirmar presença"
                  : activeAction === "leave"
                    ? "Sair da lista"
                    : "Solicitar participação",
                language,
              )}
            </p>
            {activeAction === "join" || activeAction === "leave" ? (
              <form
                className="participant-modal-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const completed =
                    activeAction === "join" ? join() : requestLeave();
                  if (completed) {
                    setActiveAction(null);
                  }
                }}
              >
                <p>
                  {localize(
                    activeAction === "join"
                      ? game.playerIds.length >= game.maxPlayers
                        ? "O jogo já está cheio. Deseja colocar seu nome na lista de espera?"
                        : "Deseja confirmar sua participação neste jogo?"
                      : "Deseja sair da lista deste jogo?",
                    language,
                  )}
                </p>
                {notice && (
                  <p className="success">✓ {localize(notice, language)}</p>
                )}
                <div className="confirm-dialog-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={closeGame}
                  >
                    {localize("Cancelar", language)}
                  </button>
                  <button className="primary">
                    {localize(
                      activeAction === "join" ? "Confirmar" : "Sair da lista",
                      language,
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form
                className="participant-modal-form"
                onSubmit={(event) => {
                  if (request(event)) {
                    setActiveAction(null);
                    setParticipationConfirmation("requested");
                  }
                }}
              >
                <input
                  autoFocus
                  required
                  maxLength={20}
                  placeholder={localize("Seu nome completo", language)}
                  value={requestName}
                  onChange={(event) => setRequestName(event.target.value)}
                />
                {notice && (
                  <p className="success">✓ {localize(notice, language)}</p>
                )}
                <div className="confirm-dialog-actions">
                  <button
                    className="secondary"
                    type="button"
                    onClick={closeGame}
                  >
                    {localize("Cancelar", language)}
                  </button>
                  <button className="primary">
                    {localize("Solicitar participação", language)}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
      {participationConfirmation && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog participant-action-modal"
            role="dialog"
          >
            <p className="form-mode">
              {localize("Solicitar participação", language)}
            </p>
            <p>
              {localize("Seu pedido foi enviado ao organizador.", language)}
            </p>
            <div className="confirm-dialog-actions">
              <button className="primary" onClick={closeGame}>
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
function addPlayerToGame(
  gameSession: GameSession,
  playerId: number,
  saveGame: (gameSession: GameSession) => void,
) {
  saveGame(
    gameSession.playerIds.length < gameSession.maxPlayers
      ? { ...gameSession, playerIds: [...gameSession.playerIds, playerId] }
      : { ...gameSession, waitlistIds: [...gameSession.waitlistIds, playerId] },
  );
}
function promoteWaitlistedPlayer(
  gameSession: GameSession,
  playerId: number,
  saveGame: (gameSession: GameSession) => void,
) {
  const waitingIndex = gameSession.waitlistIds.indexOf(playerId);
  let lastUnpaidIndex = -1;

  for (let index = gameSession.playerIds.length - 1; index >= 0; index -= 1) {
    if (!gameSession.paidPlayerIds.includes(gameSession.playerIds[index])) {
      lastUnpaidIndex = index;
      break;
    }
  }

  if (waitingIndex < 0 || lastUnpaidIndex < 0) return;
  const displacedPlayerId = gameSession.playerIds[lastUnpaidIndex];
  const playerIds = [...gameSession.playerIds];
  const waitlistIds = [...gameSession.waitlistIds];
  playerIds[lastUnpaidIndex] = playerId;
  waitlistIds[waitingIndex] = displacedPlayerId;
  saveGame({ ...gameSession, playerIds, waitlistIds });
}
