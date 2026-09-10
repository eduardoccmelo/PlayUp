import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";
import {
  generateBalancedTeams,
  playerScoreBreakdown,
} from "../utils/teamBalancer";
import type {
  Condition,
  BalanceHistoryEntry,
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
import { LandingPage } from "./LandingPage";
import { ConfirmDialog } from "./ConfirmDialog";
import { PlayerDirectoryManager } from "./PlayerDirectoryManager";
import { GroupSelector } from "./GroupSelector";
import { CompactGameDetails, EventSummary } from "./EventSummary";
import { MyGames } from "./MyGames";
import { GroupStatistics } from "./GroupStatistics";
import { ReadOnlyGame } from "./ReadOnlyGame";
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
import {
  gameInviteCode,
  groupAdminInviteCode,
  groupPlayerInviteCode,
  sameInviteCode,
} from "../utils/inviteCodes";
import {
  PARTICIPANT_SEED_GROUP_ID,
  SEED_GROUP_ID,
  seedGroups,
} from "../dev/seeds";
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
const isGameReadyForBalancing = (game: GameSession) =>
  game.playerIds.length === game.maxPlayers &&
  game.playerIds.every((playerId) => game.paidPlayerIds.includes(playerId));
const MAX_STANDARD_BALANCES = 2;
const FINAL_REBALANCE_WINDOW = 15 * 60 * 1000;
const standardBalanceLimit = (game: GameSession) =>
  game.createdByRole === "participant" ? 1 : MAX_STANDARD_BALANCES;
const isFinalRebalanceWindow = (game: GameSession, now: number) => {
  const start = gameTimestamp(game);
  return now >= start - FINAL_REBALANCE_WINDOW && now < start;
};
const balanceCountOf = (game: GameSession) =>
  game.balanceCount ?? game.manualRebalanceCount ?? 0;
const appendBalanceHistory = (
  game: GameSession,
  entry: BalanceHistoryEntry,
) => [...(game.balanceHistory ?? []), entry].slice(-4);
const resetPageScroll = () => {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  document.scrollingElement?.scrollTo({ left: 0, top: 0, behavior: "auto" });
};
type SavedProfile = {
  user: CurrentUser;
  groups: PlayerGroup[];
  guestGameIds: number[];
};
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
const createOwnedPlayer = (players: Player[], user: CurrentUser): Player => ({
  id: nextIdentifier(players),
  name: user.displayName,
  ownerUserId: user.id,
  level: 3,
  mobility: "neutro",
  condition: "neutro",
  position: "neutro",
});
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
  const [access, setAccess] = useState<"home" | "groups" | "admin" | "player" | "my-games" | "statistics" | "past-games">(
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
  const [savedProfiles, setSavedProfiles] = useLocalStorage<Record<string, SavedProfile>>(
    "playup.saved-profiles.v1",
    {},
  );
  const [activeGroupId, setActiveGroupId] = useLocalStorage<string | null>(
    "playup.active-group.v1",
    null,
  );
  const adminGroupIds = currentUser?.adminGroupIds ?? [];
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
  const [profileRequested, setProfileRequested] = useState(false);
  const [inviteKind, setInviteKind] = useState<"group-admin" | "group-participant" | "game" | null>(null);
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  useEffect(() => {
    if (!currentUser?.devGodMode) return;

    const attachDemoPlayer = (group: PlayerGroup, includeDemoGames: boolean) => {
      const existingPlayer =
        group.players.find((player) => player.ownerUserId === currentUser.id) ??
        group.players.find(
          (player) =>
            normalizeText(player.name) ===
            normalizeText(currentUser.displayName),
        );
      const ownedPlayer = existingPlayer
        ? { ...existingPlayer, ownerUserId: currentUser.id }
        : createOwnedPlayer(group.players, currentUser);
      const nextPlayers = existingPlayer
        ? group.players.map((player) =>
            player.id === ownedPlayer.id ? ownedPlayer : player,
          )
        : [...group.players, ownedPlayer];
      const nextGames = includeDemoGames
        ? group.games.map((gameSession) => {
            const isAlreadyListed =
              gameSession.playerIds.includes(ownedPlayer.id) ||
              gameSession.waitlistIds.includes(ownedPlayer.id);
            if (isAlreadyListed) return gameSession;
            if (gameSession.id === 201) {
              return {
                ...gameSession,
                waitlistIds: [...gameSession.waitlistIds, ownedPlayer.id],
              };
            }
            if (gameSession.id === 202) {
              return gameSession.playerIds.length < gameSession.maxPlayers
                ? {
                    ...gameSession,
                    playerIds: [...gameSession.playerIds, ownedPlayer.id],
                  }
                : {
                    ...gameSession,
                    waitlistIds: [...gameSession.waitlistIds, ownedPlayer.id],
                  };
            }
            return gameSession;
          })
        : group.games;
      return { ...group, players: nextPlayers, games: nextGames };
    };

    setGroups((currentGroups) =>
      currentGroups.map((group) => {
        if (group.id === SEED_GROUP_ID) return attachDemoPlayer(group, false);
        if (group.id === PARTICIPANT_SEED_GROUP_ID)
          return attachDemoPlayer(group, true);
        return group;
      }),
    );
    setCurrentUser((user) =>
      !user || !user.devGodMode
        ? user
        : {
            ...user,
            devGodMode: false,
            adminGroupIds: [
              ...new Set([...(user.adminGroupIds ?? []), SEED_GROUP_ID]),
            ],
          },
    );
  }, [currentUser, setCurrentUser, setGroups]);
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
                player.ownerUserId === currentUser?.id,
            );
          }),
        )
        .sort(chronological),
    [currentUser, groups, guestGameIds],
  );
  useLayoutEffect(() => {
    resetPageScroll();
    const frameId = window.requestAnimationFrame(resetPageScroll);
    const timeoutId = window.setTimeout(resetPageScroll, 80);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [access, activeGroupId, gameId]);
  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const resetAfterPageShow = () => {
      resetPageScroll();
      window.requestAnimationFrame(resetPageScroll);
      window.setTimeout(resetPageScroll, 80);
    };
    window.addEventListener("pageshow", resetAfterPageShow);
    resetAfterPageShow();
    return () => {
      window.removeEventListener("pageshow", resetAfterPageShow);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);
  const game = games.find((g) => g.id === gameId) ?? null;
  const isParticipantGameManager = Boolean(
    game &&
      game.createdByRole === "participant" &&
      game.createdByUserId === currentUser?.id &&
      !adminGroupIds.includes(activeGroupId ?? ""),
  );
  const [gameForm, setGameForm] = useState(emptyGame);
  const [editGame, setEditGame] = useState<number | null>(null);
  const [keepGameOpenAfterEdit, setKeepGameOpenAfterEdit] = useState(false);
  const [isGameCreationOpen, setIsGameCreationOpen] = useState(false);
  const [playerForm, setPlayerForm] = useState(emptyPlayer);
  const [editPlayer, setEditPlayer] = useState<number | null>(null);
  const [isPlayerFormOpen, setIsPlayerFormOpen] = useState(false);
  const [playerFormNotice, setPlayerFormNotice] = useState("");
  const [playerFormError, setPlayerFormError] = useState("");
  const [adminPlayerSearch, setAdminPlayerSearch] = useState("");
  const [isAdminPlayerSearchOpen, setIsAdminPlayerSearchOpen] = useState(false);
  const [, setPick] = useState("");
  const [, setEntered] = useState(false);
  const [notice, setNotice] = useState("");
  const [balanceNotice, setBalanceNotice] = useState("");
  const [cancellationNotice, setCancellationNotice] = useState("");
  const [requestName, setRequestName] = useState("");
  const [gameToDelete, setGameToDelete] = useState<GameSession | null>(null);
  const [isGroupEditOpen, setIsGroupEditOpen] = useState(false);
  const [isGroupDeleteOpen, setIsGroupDeleteOpen] = useState(false);
  const [isGroupLeaveOpen, setIsGroupLeaveOpen] = useState(false);
  const [editedGroupName, setEditedGroupName] = useState("");
  const [currentGroupPasscode, setCurrentGroupPasscode] = useState("");
  const [newGroupPasscode, setNewGroupPasscode] = useState("");
  const [groupSettingsError, setGroupSettingsError] = useState("");
  const [groupDeletePasscode, setGroupDeletePasscode] = useState("");
  const [groupDeleteError, setGroupDeleteError] = useState("");
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
  const currentBalanceLimit = game ? standardBalanceLimit(game) : MAX_STANDARD_BALANCES;
  const isFinalBalanceAvailable =
    Boolean(game) && isFinalRebalanceWindow(game!, clock) && !game!.lateRebalanceUsed;
  const canBalance =
    Boolean(game) &&
    (balanceCountOf(game!) < currentBalanceLimit || isFinalBalanceAvailable);
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
    (gameSession: GameSession, allPlayers = noPlayers): GameSession => {
      const listedPlayers = gameSession.playerIds
        .map((playerId) => allPlayers.find((player) => player.id === playerId))
        .filter((player): player is Player => Boolean(player));
      const shouldBalanceAutomatically =
        isGameReadyForBalancing(gameSession) &&
        listedPlayers.length === gameSession.playerIds.length;
      const balanceCount = balanceCountOf(gameSession);

      if (
        shouldBalanceAutomatically &&
        listedPlayers.length >= 2 &&
        balanceCount < standardBalanceLimit(gameSession)
      ) {
        const nextCount = balanceCount + 1;
        return {
          ...gameSession,
          balanceCount: nextCount,
          manualRebalanceCount: undefined,
          balanceHistory: appendBalanceHistory(gameSession, {
            triggeredAt: new Date().toISOString(),
            type: "automatic",
            count: nextCount,
          }),
          teams: generateBalancedTeams(listedPlayers, gameSession.teams),
        };
      }

      return {
        ...gameSession,
        teams: null,
      };
    },
    [],
  );
  useEffect(() => {
    const gamesWithValidTeams = games.map((gameSession) => {
      if (
        isGameReadyForBalancing(gameSession) &&
        !gameSession.teams &&
        balanceCountOf(gameSession) < standardBalanceLimit(gameSession)
      )
        return refreshTeams(gameSession, players);
      if (gameSession.teams && gameSession.playerIds.length < 2)
        return { ...gameSession, teams: null };
      return gameSession;
    });
    if (gamesWithValidTeams.some((gameSession, index) => gameSession !== games[index])) {
      setGames(gamesWithValidTeams);
    }
  }, [games, players, refreshTeams, setGames]);
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
        ? refreshTeams(gameSession, players)
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
      const updatedGame = refreshTeams(
        {
          ...old,
          ...gameForm,
          endTime,
          duration: gameForm.duration,
          courtCost: +gameForm.courtCost,
          maxPlayers: +gameForm.maxPlayers,
          playerIds: active,
          waitlistIds: [...overflow, ...old.waitlistIds],
          paidPlayerIds: old.paidPlayerIds.filter((x) => active.includes(x)),
        },
        players,
      );
      updateGame(updatedGame);
      setGameId(keepGameOpenAfterEdit ? old.id : null);
      setKeepGameOpenAfterEdit(false);
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
        createdByUserId: currentUser?.id,
        createdByRole: "admin",
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
      setPlayerFormError("O nome deve ter no máximo 20 caracteres.");
      return;
    }
    if (
      players.some(
        (p) =>
          normalizeText(p.name) === normalizeText(name) && p.id !== editPlayer,
      )
    ) {
      setPlayerFormError("Esse nome já está na lista.");
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
            isGuest:
              !currentUser ||
              normalizeText(name) !== normalizeText(currentUser.displayName),
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
    setPlayerFormError("");
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
    let player = players.find((item) => isCurrentUserPlayer(item, currentUser));
    if (!player && currentUser) {
      player = createOwnedPlayer(players, currentUser);
      setPlayers([...players, player]);
    }
    if (!player) {
      setNotice("Defina seu perfil para participar.");
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
        const player =
          group.players.find(
            (item) => item.ownerUserId === currentUser?.id,
          ) ??
          group.players.find((item) => isCurrentUserPlayer(item, currentUser));
        if (!player) return group;
        return {
          ...group,
          games: group.games.map((gameSession) => {
            if (gameSession.id !== selectedGame.id) return gameSession;
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
  const approveRequests = (items: ParticipationRequest[]) => {
    const approvedIds = new Set(items.map((item) => item.id));
    let nextPlayers = [...players];
    let nextGames = [...games];

    for (const request of items) {
      if (request.type === "payment") continue;
      if (request.type === "leave") {
        const requestedGame = nextGames.find((gameSession) => gameSession.id === request.gameId);
        if (!requestedGame || request.playerId === undefined) continue;
        const playerWasPlaying = requestedGame.playerIds.includes(request.playerId);
        const updatedGame = fillOpenSpots({
          ...requestedGame,
          playerIds: requestedGame.playerIds.filter((id) => id !== request.playerId),
          waitlistIds: requestedGame.waitlistIds.filter((id) => id !== request.playerId),
          paidPlayerIds: requestedGame.paidPlayerIds.filter((id) => id !== request.playerId),
        });
        nextGames = nextGames.map((gameSession) =>
          gameSession.id === requestedGame.id
            ? playerWasPlaying
              ? refreshTeams(updatedGame, nextPlayers)
              : updatedGame
            : gameSession,
        );
        continue;
      }
      if (nextPlayers.some((player) => normalizeText(player.name) === normalizeText(request.name))) continue;
      const newPlayer: Player = {
        id: nextIdentifier(nextPlayers),
        name: request.name,
        ownerUserId: request.requesterUserId,
        level: 3,
        mobility: "neutro",
        condition: "neutro",
        position: "neutro",
      };
      nextPlayers = [...nextPlayers, newPlayer];
      const requestedGameId = request.gameId ?? [...nextGames]
        .filter((gameSession) => !hasGameEnded(gameSession))
        .sort(chronological)[0]?.id;
      if (requestedGameId === undefined) continue;
      nextGames = nextGames.map((gameSession) => {
        if (gameSession.id !== requestedGameId) return gameSession;
        const updatedGame = { ...gameSession, waitlistIds: [...gameSession.waitlistIds, newPlayer.id] };
        const filledGame = fillOpenSpots(updatedGame);
        return samePlayerIds(updatedGame.playerIds, filledGame.playerIds)
          ? filledGame
          : refreshTeams(filledGame, nextPlayers);
      });
    }
    if (nextPlayers.length !== players.length) setPlayers(nextPlayers);
    if (nextGames !== games) saveGames(nextGames);
    setRequests(requests.filter((request) => !approvedIds.has(request.id)));
  };
  const approveRequest = (request: ParticipationRequest) => approveRequests([request]);
  const dismissRequests = (items: ParticipationRequest[]) => {
    const dismissedIds = new Set(items.map((item) => item.id));
    setRequests(requests.filter((request) => !dismissedIds.has(request.id)));
  };
  const leaveGroup = (groupToLeave: PlayerGroup) => {
    if (!currentUser) return;
    const ownedIds = new Set(
      groupToLeave.players
        .filter((player) => isCurrentUserPlayer(player, currentUser))
        .map((player) => player.id),
    );
    setGroups((currentGroups) =>
      currentGroups.map((group) =>
        group.id !== groupToLeave.id
          ? group
          : {
              ...group,
              players: group.players.filter((player) => !ownedIds.has(player.id)),
              games: group.games.map((gameSession) =>
                fillOpenSpots({
                  ...gameSession,
                  playerIds: gameSession.playerIds.filter((id) => !ownedIds.has(id)),
                  waitlistIds: gameSession.waitlistIds.filter((id) => !ownedIds.has(id)),
                  paidPlayerIds: gameSession.paidPlayerIds.filter((id) => !ownedIds.has(id)),
                }),
              ),
            },
      ),
    );
    setCurrentUser((user) =>
      !user
        ? user
        : {
            ...user,
            adminGroupIds: (user.adminGroupIds ?? []).filter((id) => id !== groupToLeave.id),
            leftGroupIds: [...new Set([...(user.leftGroupIds ?? []), groupToLeave.id])],
          },
    );
    setGuestGameIds((ids) =>
      ids.filter((id) => !groupToLeave.games.some((gameSession) => gameSession.id === id)),
    );
  };
  const saveProfile = (
    { displayName, email }: Pick<CurrentUser, "displayName" | "email">,
    mode: "sign-in" | "sign-up",
  ) => {
    const savedProfile = savedProfiles[email];
    if (mode === "sign-in") {
      if (!savedProfile) return "Nenhum perfil encontrado para este e-mail.";
      setGroups(savedProfile.groups);
      setGuestGameIds(savedProfile.guestGameIds);
      setCurrentUser(savedProfile.user);
      return null;
    }
    if (!currentUser && savedProfile) {
      setGroups(savedProfile.groups);
      setGuestGameIds(savedProfile.guestGameIds);
      setCurrentUser(savedProfile.user);
      return null;
    }
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
          player.ownerUserId === userId ? { ...player, name: displayName } : player,
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
            adminGroupIds: [],
            devGodMode: false,
            createdAt: new Date().toISOString(),
          },
    );
    return null;
  };
  const logout = () => {
    if (currentUser) {
      setSavedProfiles((profiles) => ({
        ...profiles,
        [currentUser.email]: { user: currentUser, groups, guestGameIds },
      }));
    }
    setCurrentUser(null);
    setGroups(seedGroups());
    setGuestGameIds([]);
    setActiveGroupId(null);
    setGameId(null);
    setAccess("home");
  };
  const withProfile = (page: ReactNode) => (
    <>
      {page}
      <LandingPage
        profileOnly
        language={language}
        user={currentUser}
        openProfile={profileRequested}
        onProfileOpened={() => setProfileRequested(false)}
        onSaveUser={saveProfile}
        onLogout={logout}
        onLanguageChange={setLanguage}
        onEnter={() => undefined}
      />
    </>
  );
  if (access === "groups")
    return withProfile(
      <GroupSelector
        groups={groups}
        user={currentUser}
        language={language}
        onLanguageChange={setLanguage}
        adminGroupIds={adminGroupIds}
        onBack={() => {
          setActiveGroupId(null);
          setAccess("home");
        }}
        onProfile={() => {
          setProfileRequested(true);
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
        }}
        onChoose={(group) => {
          setActiveGroupId(group.id);
          setGameId(null);
          setReturnToDashboardAfterGame(false);
          setInviteKind(null);
          setEntered(false);
          setPick("");
          setAccess(
            adminGroupIds.includes(group.id)
              ? "admin"
              : "player",
          );
        }}
        onChangePasscode={(groupId, organizerPasscode) =>
          setGroups((currentGroups) => currentGroups.map((group) =>
            group.id === groupId ? { ...group, organizerPasscode } : group,
          ))
        }
        onRename={(groupId, name) =>
          setGroups((currentGroups) => currentGroups.map((group) =>
            group.id === groupId ? { ...group, name } : group,
          ))
        }
        onDelete={(groupId) => setGroups((currentGroups) =>
          currentGroups.filter((group) => group.id !== groupId),
        )}
        onJoinGroup={(code, passcode) => {
          const participantGroup = groups.find((candidate) =>
            sameInviteCode(code, groupPlayerInviteCode(candidate)),
          );
          const adminGroup = groups.find((candidate) =>
            sameInviteCode(code, groupAdminInviteCode(candidate)),
          );
          const group = participantGroup ?? adminGroup;
          if (!group) return "Código de grupo inválido.";
          const isAlreadyMember = Boolean(
            currentUser &&
              !(currentUser.leftGroupIds ?? []).includes(group.id) &&
              ((currentUser.adminGroupIds ?? []).includes(group.id) ||
                group.players.some(
                  (player) =>
                    player.ownerUserId === currentUser.id ||
                    normalizeText(player.name) ===
                      normalizeText(currentUser.displayName),
                )),
          );
          const currentMembershipCount = currentUser
            ? groups.filter(
                (candidate) =>
                  !(currentUser.leftGroupIds ?? []).includes(candidate.id) &&
                  ((currentUser.adminGroupIds ?? []).includes(candidate.id) ||
                    candidate.players.some(
                      (player) =>
                        player.ownerUserId === currentUser.id ||
                        normalizeText(player.name) ===
                          normalizeText(currentUser.displayName),
                    )),
              ).length
            : 0;
          if (!isAlreadyMember && currentMembershipCount >= 5) {
            return "Você pode participar de até 5 grupos no momento.";
          }
          if (adminGroup && passcode !== adminGroup.organizerPasscode) {
            return "Senha atual incorreta.";
          }
          if (
            currentUser &&
            !group.players.some(
              (player) => player.ownerUserId === currentUser.id,
            )
          ) {
            const sameName = group.players.find(
              (player) =>
                normalizeText(player.name) ===
                normalizeText(currentUser.displayName),
            );
            const player = sameName
              ? { ...sameName, ownerUserId: currentUser.id }
              : createOwnedPlayer(group.players, currentUser);
            setGroups((currentGroups) =>
              currentGroups.map((candidate) =>
                candidate.id !== group.id
                  ? candidate
                  : {
                      ...candidate,
                      players: sameName
                        ? candidate.players.map((item) =>
                            item.id === sameName.id ? player : item,
                          )
                        : [...candidate.players, player],
                    },
              ),
            );
          }
          setCurrentUser((user) =>
            !user
              ? user
              : {
                  ...user,
                  adminGroupIds: adminGroup
                    ? [
                        ...new Set([
                          ...(user.adminGroupIds ?? []),
                          adminGroup.id,
                        ]),
                      ]
                    : user.adminGroupIds,
                  leftGroupIds: (user.leftGroupIds ?? []).filter(
                    (groupId) => groupId !== group.id,
                  ),
                },
          );
          return null;
        }}
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
        onLeaveGroup={(groupToLeave) => {
          if (!currentUser) return;
          const ownedPlayerIds = new Set(
            groupToLeave.players
              .filter(
                (player) =>
                  player.ownerUserId === currentUser.id ||
                  normalizeText(player.name) ===
                    normalizeText(currentUser.displayName),
              )
              .map((player) => player.id),
          );
          setGroups((currentGroups) =>
            currentGroups.map((group) =>
              group.id !== groupToLeave.id
                ? group
                : {
                    ...group,
                    players: group.players.filter(
                      (player) => !ownedPlayerIds.has(player.id),
                    ),
                    games: group.games.map((gameSession) =>
                      fillOpenSpots({
                        ...gameSession,
                        playerIds: gameSession.playerIds.filter(
                          (playerId) => !ownedPlayerIds.has(playerId),
                        ),
                        waitlistIds: gameSession.waitlistIds.filter(
                          (playerId) => !ownedPlayerIds.has(playerId),
                        ),
                        paidPlayerIds: gameSession.paidPlayerIds.filter(
                          (playerId) => !ownedPlayerIds.has(playerId),
                        ),
                      }),
                    ),
                  },
            ),
          );
          setCurrentUser((user) =>
            !user
              ? user
              : {
                  ...user,
                  adminGroupIds: (user.adminGroupIds ?? []).filter(
                    (groupId) => groupId !== groupToLeave.id,
                  ),
                  leftGroupIds: [
                    ...new Set([
                      ...(user.leftGroupIds ?? []),
                      groupToLeave.id,
                    ]),
                  ],
                },
          );
          setGuestGameIds((gameIds) =>
            gameIds.filter(
              (gameId) =>
                !groupToLeave.games.some((game) => game.id === gameId),
            ),
          );
        }}
        onAddMyGame={(code) => {
          const match = groups.flatMap((group) =>
            group.games.map((gameSession) => ({ group, gameSession })),
          ).find(({ group, gameSession }) =>
            sameInviteCode(code, gameInviteCode(group, gameSession)),
          );
          if (!match) return "Código de jogo inválido.";
          setGuestGameIds((current) =>
            current.includes(match.gameSession.id)
              ? current
              : [...current, match.gameSession.id],
          );
          return null;
        }}
      />
    );
  if (access === "home")
    return withProfile(
      <LandingPage
        language={language}
        user={currentUser}
        onOpenProfile={() => setProfileRequested(true)}
        onSaveUser={saveProfile}
        onLogout={logout}
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
    return withProfile(
      <PlayerView
        games={games.filter(visibleToPlayers).sort(chronological)}
        game={game}
        choose={(g) => {
          setGameId(g);
          setEntered(false);
          setPick("");
          setNotice("");
        }}
        onViewGame={(gameSession) => {
          setGameId(gameSession.id);
          setEntered(false);
          setPick("");
          setNotice("");
          if (
            gameSession.createdByRole === "participant" &&
            gameSession.createdByUserId === currentUser?.id
          ) {
            setAccess("admin");
          }
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
        groupName={activeGroup?.name ?? ""}
        user={currentUser}
        isGroupMember={players.some((player) =>
          isCurrentUserPlayer(player, currentUser),
        ) || adminGroupIds.includes(activeGroupId ?? "")}
        onManageGroup={
          adminGroupIds.includes(activeGroupId ?? "")
            ? () => setAccess("admin")
            : undefined
        }
        onLeaveGroup={() => {
          if (!activeGroup) return;
          leaveGroup(activeGroup);
          setActiveGroupId(null);
          setAccess("groups");
        }}
        canCreateGame={Boolean(
          activeGroup &&
            !adminGroupIds.includes(activeGroup.id) &&
            (players.some((player) => isCurrentUserPlayer(player, currentUser)) ||
              adminGroupIds.includes(activeGroup.id)),
        )}
        onCreateGame={(draft) => {
          if (!isValidIsoDate(draft.date)) return "Informe uma data válida no formato DD/MM/AAAA.";
          if (draft.date < today) return "Não é possível criar um jogo em uma data passada.";
          const endTime = endTimeFromDuration(draft.time, draft.duration);
          if (!endTime) return "A duração precisa terminar no mesmo dia.";
          const newGame: GameSession = {
            id: nextIdentifier(games),
            ...draft,
            endTime,
            duration: Number(draft.duration),
            courtCost: Number(draft.courtCost),
            maxPlayers: Number(draft.maxPlayers),
            minPlayers: null,
            cancellationHours: 2,
            cancelled: false,
            playerIds: [],
            waitlistIds: [],
            paidPlayerIds: [],
            teams: null,
            createdByUserId: currentUser?.id,
            createdByRole: "participant",
          };
          setGames([...games, newGame]);
          setGameId(newGame.id);
          setAccess("admin");
          return null;
        }}
        onProfile={() => {
          setProfileRequested(true);
        }}
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
        onLanguageChange={setLanguage}
      />
    );
  if (access === "my-games") {
    return withProfile(
      <MyGames
        games={myGames}
        language={language}
        onLanguageChange={setLanguage}
        onBack={() => setAccess("groups")}
        onProfile={() => {
          setProfileRequested(true);
        }}
        onRequestGame={() => {
          const firstGame = groups.flatMap((group) => group.games).find((gameSession) => !hasGameEnded(gameSession));
          if (firstGame) setGuestGameIds((current) => current.includes(firstGame.id) ? current : [...current, firstGame.id]);
        }}
      />
    );
  }
  if (
    access === "admin" &&
    adminGroupIds.includes(activeGroupId ?? "") &&
    requests.length
  )
    return withProfile(
      <ParticipationRequests
        games={games}
        language={language}
        onLanguageChange={setLanguage}
        requests={requests}
        onApprove={approveRequest}
        onApproveAll={approveRequests}
        onDismissAll={dismissRequests}
        onBack={() => {
          setActiveGroupId(null);
          setAccess("groups");
        }}
        onProfile={() => {
          setProfileRequested(true);
        }}
      />
    );
  if (access === "statistics")
    return withProfile(
      <GroupStatistics
        games={games}
        groupName={activeGroup?.name ?? ""}
        language={language}
        onBack={() => setAccess("admin")}
        onLanguageChange={setLanguage}
        onProfile={() => setProfileRequested(true)}
        players={players}
      />,
    );

  const deleteGame = (gameSession: GameSession) => {
    saveGames(games.filter((storedGame) => storedGame.id !== gameSession.id));
    if (gameId === gameSession.id) {
      setGameId(null);
      setEditGame(null);
    }
  };

  if (access === "past-games")
    return withProfile(
      <main className="app-shell">
        <Header
          backLabel={localize("Voltar", language)}
          language={language}
          onBack={() => setAccess("admin")}
          onHome={() => setAccess("home")}
          onLanguageChange={setLanguage}
          onProfile={() => setProfileRequested(true)}
        />
        <section className="game-directory-heading game-management-heading">
          {activeGroup?.name && <p className="past-games-group-name">{activeGroup.name}</p>}
          <div className="game-management-title-row">
            <h1>
              {localize("Jogos", language)}{" "}
              <em>{localize("passados", language)}</em>
            </h1>
          </div>
        </section>
        <section className="panel session-panel game-management-list">
          {games.filter(hasGameEnded).length > 0 ? (
            <div className="session-tabs">
              {[...games]
                .filter(hasGameEnded)
                .sort(chronological)
                .map((gameSession) => (
                  <div className="session-row ended" key={gameSession.id}>
                    <CompactGameDetails game={gameSession} language={language} />
                    <div className="session-row-actions">
                      <button
                        className="session-action-button view"
                        onClick={() => {
                          setGameId(gameSession.id);
                          setAccess("admin");
                        }}
                      >
                        {localize("Ver", language)}
                      </button>
                      <button
                        className="session-action-button delete"
                        onClick={() => setGameToDelete(gameSession)}
                      >
                        {localize("Deletar", language)}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="empty">{localize("Nenhum jogo passado", language)}</p>
          )}
        </section>
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
      </main>,
    );

  const editGameDetails = (
    gameSession: GameSession,
    keepGameOpen = false,
  ) => {
    setKeepGameOpenAfterEdit(keepGameOpen);
    if (!keepGameOpen) setGameId(null);
    setEditGame(gameSession.id);
    setGameForm({ ...gameSession });
    setIsGameCreationOpen(true);
  };

  const confirmRemoval = (removeAction: () => void) => {
    setPendingRemoval(() => removeAction);
  };

  return withProfile(
    <main className="app-shell">
      <Header
        backLabel={localize("Voltar", language)}
        showBackArrow
        language={language}
        onLanguageChange={setLanguage}
        onProfile={() => {
          setProfileRequested(true);
        }}
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
          {!hasGameEnded(game) && (
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
              className="secondary hero-game-action"
              onClick={() => editGameDetails(game, true)}
            >
              {localize("Editar", language)}
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
          )}
        </section>
      ) : !game ? (
        <section className="game-directory-heading game-management-heading">
          {activeGroup?.name && (
            <div className="group-management-actions">
              <p>{activeGroup.name}</p>
              <div className="game-directory-actions">
                <button
                  className="session-action-button view"
                  onClick={() => setAccess("statistics")}
                >
                  {localize("Estatísticas", language)}
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setEditedGroupName(activeGroup?.name ?? "");
                    setCurrentGroupPasscode("");
                    setNewGroupPasscode("");
                    setGroupSettingsError("");
                    setIsGroupEditOpen(true);
                  }}
                >
                  {localize("Editar", language)}
                </button>
                <button
                  className="session-action-button leave"
                  onClick={() => setIsGroupLeaveOpen(true)}
                >
                  {localize("Sair do grupo", language)}
                </button>
                <button
                  className="session-action-button delete"
                  onClick={() => {
                    setGroupDeletePasscode("");
                    setGroupDeleteError("");
                    setIsGroupDeleteOpen(true);
                  }}
                >
                  {localize("Deletar grupo", language)}
                </button>
              </div>
            </div>
          )}
          <div className="game-management-title-row">
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
              <button
                className="secondary past-games-button"
                onClick={() => setAccess("past-games")}
              >
                {localize("Jogos passados", language)}
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {!game && (
        <section className="panel session-panel game-management-list">
          {games.some((gameSession) => !hasGameEnded(gameSession)) ? (
            <div className="session-tabs">
              {[...games].filter((gameSession) => !hasGameEnded(gameSession)).sort(chronological).map((gameSession) => {

                return (
                  <div
                    className={`session-row ${gameSession.id === gameId ? "active" : ""}`}
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
            <p className="empty">{localize("Nenhum jogo futuro", language)}</p>
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
                setKeepGameOpenAfterEdit(false);
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
                isGuest:
                  !currentUser ||
                  normalizeText(player.name) !==
                    normalizeText(currentUser.displayName),
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
      ) : game ? (
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
                    {localize("Participantes", language)}: {game.playerIds.length}/
                    {game.maxPlayers} ({paid.length}{" "}
                    {localize("pagos", language)})
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
                        setPlayerFormError("");
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
                          {!isParticipantGameManager && <span>
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
                          </span>}
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
                      "Deixe o balanceamento como etapa final, de preferência no dia do jogo. Com a lista completa e todos pagos, os times são gerados automaticamente.",
                      language,
                    )}{" "}
                    {localize("Atual", language)}: ({paid.length}/{game.maxPlayers})
                  </p>
                  {(!isParticipantGameManager || balanceCountOf(game) < currentBalanceLimit) && (
                    <p className="balance-availability">
                      {localize("Balanceamentos", language)}: {balanceCountOf(game)} {localize("de", language)} {currentBalanceLimit}
                    </p>
                  )}
                  {balanceCountOf(game) >= currentBalanceLimit && !isFinalBalanceAvailable && !game.lateRebalanceUsed && (
                    <p className="balance-availability">
                      {localize(
                        "O limite de 1 rebalanceamento foi atingido. O botão será reativado 15 minutos antes do jogo para somente mais 1 rebalanceamento final.",
                        language,
                      )}
                    </p>
                  )}
                  {isFinalBalanceAvailable && (
                    <p className="balance-availability">
                      {localize(
                        "Rebalanceamento final disponível: somente 1 tentativa até o início do jogo.",
                        language,
                      )}
                    </p>
                  )}
                  {game.lateRebalanceUsed && (
                    <p className="balance-availability">
                      {localize("O rebalanceamento final já foi utilizado.", language)}
                    </p>
                  )}
                  {!isParticipantGameManager && (game.balanceHistory ?? []).slice(-1).map((entry) => (
                    <p className="balance-availability" key={`${entry.triggeredAt}-${entry.type}`}>
                      {entry.type === "late-rebalance"
                        ? language === "pt"
                          ? `Rebalanceamento final disparado por ${entry.adminName ?? localize("Administrador", language)}.`
                          : `Final rebalance triggered by ${entry.adminName ?? localize("Administrator", language)}.`
                        : entry.type === "admin"
                        ? language === "pt"
                          ? `Balanceamento disparado por ${entry.adminName}. ${entry.count} de ${currentBalanceLimit}`
                          : `Balance triggered by ${entry.adminName}. ${entry.count} of ${currentBalanceLimit}`
                        : language === "pt"
                          ? `Balanceamento automático acionado pelo sistema. ${entry.count} de ${currentBalanceLimit}`
                          : `Automatic balance triggered by the system. ${entry.count} of ${currentBalanceLimit}`}
                    </p>
                  ))}
                  <button
                    className="primary team-balance-button"
                    disabled={!canBalance}
                    onClick={() => {
                      if (paid.length < 2) {
                        setBalanceNotice(
                          localize(
                            "Marque pelo menos 2 jogadores como pagos para gerar os times.",
                            language,
                          ),
                        );
                        return;
                      }
                      const teams = generateBalancedTeams(paid, game.teams);
                      const isLateRebalance =
                        balanceCountOf(game) >= currentBalanceLimit;
                      const nextBalanceCount = isLateRebalance
                        ? balanceCountOf(game)
                        : balanceCountOf(game) + 1;
                      setBalanceNotice("");
                      updateGame(
                        {
                          ...game,
                          teams,
                          balanceCount: nextBalanceCount,
                          manualRebalanceCount: undefined,
                          balanceHistory: appendBalanceHistory(game, {
                            triggeredAt: new Date().toISOString(),
                            type: isLateRebalance ? "late-rebalance" : "admin",
                            adminName:
                              currentUser?.displayName ??
                              localize("Administrador", language),
                            count: isLateRebalance ? undefined : nextBalanceCount,
                          }),
                          lateRebalanceUsed: isLateRebalance || game.lateRebalanceUsed,
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
                    <Teams
                      embedded
                      teams={game.teams}
                      language={language}
                      showPositions={!isParticipantGameManager}
                    />
                  )}
                </section>
              </aside>
            </div>
          </fieldset>
      ) : null}
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
            {playerFormError && (
              <p className="error player-form-error">
                {localize(playerFormError, language)}
              </p>
            )}
            <form
              className={`player-form${isParticipantGameManager ? " restricted-player-form" : ""}`}
              onSubmit={savePlayer}
            >
              <input
                className="player-form-name"
                required
                maxLength={20}
                placeholder={localize("Nome", language)}
                value={playerForm.name}
                onChange={(event) => {
                  setPlayerForm({ ...playerForm, name: event.target.value });
                  setPlayerFormError("");
                }}
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
                  setPlayerFormError("");
                  setIsPlayerFormOpen(false);
                }}
              >
                {localize("Cancelar", language)}
              </button>
            </form>
          </section>
        </div>
      )}
      {isGroupEditOpen && activeGroup && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (newGroupPasscode && currentGroupPasscode !== activeGroup.organizerPasscode) {
                  setGroupSettingsError("Senha atual incorreta.");
                  return;
                }
                setGroups((currentGroups) => currentGroups.map((group) =>
                  group.id === activeGroup.id
                    ? {
                        ...group,
                        name: editedGroupName.trim() || group.name,
                        organizerPasscode: newGroupPasscode || group.organizerPasscode,
                      }
                    : group,
                ));
                setIsGroupEditOpen(false);
              }}
            >
              <p className="form-mode">{localize("EDITAR GRUPO", language)}</p>
              <input
                autoFocus
                maxLength={20}
                required
                value={editedGroupName}
                onChange={(event) => setEditedGroupName(event.target.value)}
              />
              <input
                placeholder={localize("Senha atual (obrigatória para trocar)", language)}
                type="password"
                value={currentGroupPasscode}
                onChange={(event) => setCurrentGroupPasscode(event.target.value)}
              />
              <input
                minLength={4}
                placeholder={localize("Nova senha (opcional)", language)}
                type="password"
                value={newGroupPasscode}
                onChange={(event) => setNewGroupPasscode(event.target.value)}
              />
              {groupSettingsError && <small className="error">{localize(groupSettingsError, language)}</small>}
              <div className="confirm-dialog-actions">
                <button className="secondary" type="button" onClick={() => setIsGroupEditOpen(false)}>{localize("Cancelar", language)}</button>
                <button className="primary">{localize("Salvar", language)}</button>
              </div>
            </form>
          </section>
        </div>
      )}
      {isGroupDeleteOpen && activeGroup && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (groupDeletePasscode !== activeGroup.organizerPasscode) {
                  setGroupDeleteError("Senha atual incorreta.");
                  return;
                }
                setGroups((currentGroups) =>
                  currentGroups.filter((group) => group.id !== activeGroup.id),
                );
                setCurrentUser((user) =>
                  user
                    ? {
                        ...user,
                        adminGroupIds: (user.adminGroupIds ?? []).filter(
                          (id) => id !== activeGroup.id,
                        ),
                      }
                    : user,
                );
                setActiveGroupId(null);
                setIsGroupDeleteOpen(false);
                setAccess("groups");
              }}
            >
              <p className="form-mode">{localize("EXCLUIR GRUPO", language)}</p>
              <p>{localize("Esta ação não pode ser desfeita.", language)}</p>
              <label className="profile-field">
                {localize("Senha atual", language)}
                <input
                  autoFocus
                  required
                  type="password"
                  value={groupDeletePasscode}
                  onChange={(event) => {
                    setGroupDeletePasscode(event.target.value);
                    setGroupDeleteError("");
                  }}
                />
              </label>
              {groupDeleteError && (
                <small className="error">
                  {localize(groupDeleteError, language)}
                </small>
              )}
              <div className="confirm-dialog-actions">
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setIsGroupDeleteOpen(false)}
                >
                  {localize("Cancelar", language)}
                </button>
                <button className="session-action-button delete">
                  {localize("Deletar", language)}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {isGroupLeaveOpen && activeGroup && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog group-auth-modal" role="dialog">
            <p className="form-mode">{localize("SAIR DO GRUPO", language)}</p>
            <p>{localize("Você deixará de ver os jogos deste grupo.", language)}</p>
            <div className="confirm-dialog-actions">
              <button className="secondary" onClick={() => setIsGroupLeaveOpen(false)}>{localize("Cancelar", language)}</button>
              <button className="session-action-button delete" onClick={() => {
                leaveGroup(activeGroup);
                setActiveGroupId(null);
                setIsGroupLeaveOpen(false);
                setAccess("groups");
              }}>{localize("Sair do grupo", language)}</button>
            </div>
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
            <input
              readOnly
              value={
                inviteKind === "game" && game && activeGroup
                  ? gameInviteCode(activeGroup, game)
                  : `PLAYUP-GROUP-${activeGroup?.id ?? "DEMO"}`
              }
            />
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
                    inviteKind === "game" && game && activeGroup
                      ? gameInviteCode(activeGroup, game)
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
  onViewGame,
  backToGameSelection,
  backToGroups,
  players,
  groupName,
  user,
  isGroupMember,
  onManageGroup,
  onLeaveGroup,
  canCreateGame,
  onCreateGame,
  onProfile,
  join,
  exit,
  requestName,
  setRequestName,
  request,
  requestLeave,
  confirmPayment,
  notice,
  language,
  onLanguageChange,
}: {
  games: GameSession[];
  game: GameSession | null;
  choose: (x: number) => void;
  onViewGame: (game: GameSession) => void;
  backToGameSelection: () => void;
  backToGroups: () => void;
  players: Player[];
  groupName: string;
  user: CurrentUser | null;
  isGroupMember: boolean;
  onManageGroup?: () => void;
  onLeaveGroup?: () => void;
  canCreateGame: boolean;
  onCreateGame: (draft: typeof emptyGame) => string | null;
  onProfile: () => void;
  join: () => boolean;
  exit: () => void;
  requestName: string;
  setRequestName: (x: string) => void;
  request: (e: FormEvent) => boolean;
  requestLeave: () => boolean;
  confirmPayment: (playerId: number, isPaid: boolean) => boolean;
  notice: string;
  language: "pt" | "en";
  onLanguageChange: (language: "pt" | "en") => void;
}) {
  const [activeAction, setActiveAction] = useState<
    "join" | "request" | "leave" | null
  >(null);
  const [isGameListOpen, setIsGameListOpen] = useState(Boolean(game));
  const [participationConfirmation, setParticipationConfirmation] = useState<
    "requested" | null
  >(null);
  const [isGroupLeaveConfirmationOpen, setIsGroupLeaveConfirmationOpen] =
    useState(false);
  const [isGameCreationOpen, setIsGameCreationOpen] = useState(false);
  const [gameDraft, setGameDraft] = useState(emptyGame);
  const [gameCreationError, setGameCreationError] = useState("");
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
  const paidPlayersCount = game?.playerIds.filter((playerId) =>
    game.paidPlayerIds.includes(playerId),
  ).length ?? 0;
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
                {localize("Participantes", language)}: {game.playerIds.length}/
                {game.maxPlayers} ({paidPlayersCount}{" "}
                {localize("pagos", language)})
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
        onProfile={onProfile}
        language={language}
        onLanguageChange={onLanguageChange}
      />
      {!isViewingGame ? (
        <>
          <section className={`game-directory-heading participant-games-heading${canCreateGame ? " participant-game-creator-heading" : ""}`}>
            <h1>
              {groupName && <span className="group-context-name">{groupName}</span>}
              {localize("Escolha o", language)}{" "}
              <em>{localize("jogo", language)}</em>
            </h1>
            <div className="game-directory-actions">
              {onManageGroup && (
                <button className="secondary" onClick={onManageGroup}>
                  {localize("Gerenciar grupo", language)}
                </button>
              )}
              {canCreateGame && (
                <button
                  className="primary"
                  onClick={() => {
                    setGameDraft(emptyGame);
                    setGameCreationError("");
                    setIsGameCreationOpen(true);
                  }}
                >
                  + {localize("Novo jogo", language)}
                </button>
              )}
              {onLeaveGroup && (
                <button
                  className="secondary"
                  onClick={() => setIsGroupLeaveConfirmationOpen(true)}
                >
                  {localize("Sair do grupo", language)}
                </button>
              )}
            </div>
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
                            onViewGame(g);
                            setIsGameListOpen(true);
                          }}
                        >
                          {localize("Ver", language)}
                        </button>
                        <button
                          className="session-action-button confirm"
                          disabled={isEnded || g.cancelled || !isGroupMember || isCurrentUserAttending || isCurrentUserWaiting}
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
      {isGameCreationOpen && (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="confirm-dialog game-form-modal" role="dialog">
            <p className="form-mode">{localize("NOVO JOGO", language)}</p>
            {gameCreationError && <small className="error">{localize(gameCreationError, language)}</small>}
            <GameForm
              draft={gameDraft}
              isEditing={false}
              language={language}
              onChange={setGameDraft}
              onCancel={() => setIsGameCreationOpen(false)}
              onSubmit={(event) => {
                event.preventDefault();
                const error = onCreateGame(gameDraft);
                if (error) {
                  setGameCreationError(error);
                  return;
                }
                setIsGameCreationOpen(false);
              }}
            />
          </section>
        </div>
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
      {isGroupLeaveConfirmationOpen && (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-modal="true"
            className="confirm-dialog participant-action-modal"
            role="dialog"
          >
            <p className="form-mode">{localize("SAIR DO GRUPO", language)}</p>
            <p>{localize("Você deseja sair deste grupo?", language)}</p>
            <div className="confirm-dialog-actions">
              <button
                className="secondary"
                onClick={() => setIsGroupLeaveConfirmationOpen(false)}
              >
                {localize("Cancelar", language)}
              </button>
              <button
                className="session-action-button delete"
                onClick={() => onLeaveGroup?.()}
              >
                {localize("Sair do grupo", language)}
              </button>
            </div>
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
