import type { BalancedTeams, Player, Position } from "../types";

const goalkeeperLevelScores: Record<number, number> = {
  1: 0.75,
  2: 1.75,
  3: 3,
  4: 4.25,
  5: 5.25,
};

const positions: Position[] = ["goleiro", "defesa", "ataque", "neutro"];
const positionOf = (player: Player): Position => player.position ?? "neutro";

export function playerScoreBreakdown(player: Player) {
  const level =
    positionOf(player) === "goleiro"
      ? goalkeeperLevelScores[player.level]
      : player.level;
  const mobility =
    player.mobility === "rapido" ? 0.25 : player.mobility === "lento" ? -0.25 : 0;
  const condition =
    player.condition === "boa" ? 0.25 : player.condition === "ruim" ? -0.25 : 0;

  return { level, mobility, condition, total: level + mobility + condition };
}

export function playerScore(player: Player) {
  return playerScoreBreakdown(player).total;
}

const score = (players: Player[]) =>
  players.reduce((sum, player) => sum + playerScore(player), 0);

const count = (players: Player[], predicate: (player: Player) => boolean) =>
  players.filter(predicate).length;

type Balance = {
  attributeDifference: number;
  positionDifference: number;
  scoreDifference: number;
};

const compareBalance = (first: Balance, second: Balance) => {
  if (first.positionDifference !== second.positionDifference) {
    return first.positionDifference - second.positionDifference;
  }
  if (first.scoreDifference !== second.scoreDifference) {
    return first.scoreDifference - second.scoreDifference;
  }
  return first.attributeDifference - second.attributeDifference;
};

const balanceOf = (teamA: Player[], teamB: Player[]): Balance => ({
  positionDifference: positions.reduce(
    (difference, position) =>
      difference +
      Math.abs(
        count(teamA, (player) => positionOf(player) === position) -
          count(teamB, (player) => positionOf(player) === position),
      ),
    0,
  ),
  scoreDifference: Math.abs(score(teamA) - score(teamB)),
  attributeDifference:
    Math.abs(
      count(teamA, (player) => player.mobility === "rapido") -
        count(teamB, (player) => player.mobility === "rapido"),
    ) +
    Math.abs(
      count(teamA, (player) => player.mobility === "lento") -
        count(teamB, (player) => player.mobility === "lento"),
    ) +
    Math.abs(
      count(teamA, (player) => player.condition === "boa") -
        count(teamB, (player) => player.condition === "boa"),
    ) +
    Math.abs(
      count(teamA, (player) => player.condition === "ruim") -
        count(teamB, (player) => player.condition === "ruim"),
    ),
});

const splitsGoalkeepers = (
  teamA: Player[],
  teamB: Player[],
  totalGoalkeepers: number,
) =>
  totalGoalkeepers < 2 ||
  (count(teamA, (player) => positionOf(player) === "goleiro") > 0 &&
    count(teamB, (player) => positionOf(player) === "goleiro") > 0);

type TeamCandidate = {
  teamA: Player[];
  teamB: Player[];
  balance: Balance;
};

const hasSameMembers = (first: Player[], second: Player[]) =>
  first.length === second.length &&
  first.every((player) => second.some((candidate) => candidate.id === player.id));

const isSameSplit = (candidate: TeamCandidate, previous: BalancedTeams) =>
  (hasSameMembers(candidate.teamA, previous.teamA) &&
    hasSameMembers(candidate.teamB, previous.teamB)) ||
  (hasSameMembers(candidate.teamA, previous.teamB) &&
    hasSameMembers(candidate.teamB, previous.teamA));

export function generateBalancedTeams(
  players: Player[],
  previousTeams?: BalancedTeams | null,
): BalancedTeams {
  const teamASize = Math.ceil(players.length / 2);
  const totalGoalkeepers = count(
    players,
    (player) => positionOf(player) === "goleiro",
  );
  const candidates: TeamCandidate[] = [];

  // Games are normally small (10–12 players). Evaluating every valid split
  // prevents a later random swap from putting both goalkeepers on one team.
  const evaluate = (indices: number[], nextIndex: number) => {
    if (indices.length === teamASize) {
      const selected = new Set(indices);
      const teamA = indices.map((index) => players[index]);
      const teamB = players.filter((_, index) => !selected.has(index));
      if (!splitsGoalkeepers(teamA, teamB, totalGoalkeepers)) return;

      candidates.push({ teamA, teamB, balance: balanceOf(teamA, teamB) });
      return;
    }

    const remainingSlots = teamASize - indices.length;
    for (
      let index = nextIndex;
      index <= players.length - remainingSlots;
      index += 1
    ) {
      evaluate([...indices, index], index + 1);
    }
  };

  evaluate([], 0);

  const rankedCandidates = candidates.sort((first, second) =>
    compareBalance(first.balance, second.balance),
  );
  const bestCandidate = rankedCandidates[0];
  // A re-balance should create a genuinely new split when a comparably fair
  // option exists. Inverting Team A/Team B alone is deliberately excluded.
  const comparableAlternatives = previousTeams && bestCandidate
    ? rankedCandidates.filter(
        (candidate) =>
          !isSameSplit(candidate, previousTeams) &&
          candidate.balance.positionDifference ===
            bestCandidate.balance.positionDifference &&
          candidate.balance.scoreDifference <=
            bestCandidate.balance.scoreDifference + 1.5 &&
          candidate.balance.attributeDifference <=
            bestCandidate.balance.attributeDifference + 2,
      )
    : [];
  const selectedCandidate = comparableAlternatives.length
    ? comparableAlternatives[
        Math.floor(Math.random() * comparableAlternatives.length)
      ]
    : bestCandidate;
  const teamA = selectedCandidate?.teamA ?? players.slice(0, teamASize);
  const selected = new Set(teamA);
  const teamB = players.filter((player) => !selected.has(player));

  return {
    teamA,
    teamB,
    sumA: selectedCandidate ? score(selectedCandidate.teamA) : score(teamA),
    sumB: selectedCandidate ? score(selectedCandidate.teamB) : score(teamB),
  };
}
