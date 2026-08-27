import type { BalancedTeams, Player, Position } from "../types";
const goalkeeperLevelScores: Record<number, number> = {
  1: 0.75,
  2: 1.75,
  3: 3,
  4: 4.25,
  5: 5.25,
};
const positionOf = (player: Player): Position => player.position ?? "neutro";
export function playerScoreBreakdown(player: Player) {
  const level = positionOf(player) === "goleiro"
    ? goalkeeperLevelScores[player.level]
    : player.level;
  const mobility = player.mobility === "rapido" ? 0.25 : player.mobility === "lento" ? -0.25 : 0;
  const condition = player.condition === "boa" ? 0.25 : player.condition === "ruim" ? -0.25 : 0;

  return { level, mobility, condition, total: level + mobility + condition };
}
export function playerScore(player: Player) {
  return playerScoreBreakdown(player).total;
}
const score = (players: Player[]) => players.reduce((sum, player) => sum + playerScore(player), 0);
const count = (players: Player[], predicate: (player: Player) => boolean) => players.filter(predicate).length;
const imbalance = (a: Player[], b: Player[]) => { let value = Math.abs(score(a) - score(b)) * 12; (["goleiro", "defesa", "ataque"] as const).forEach(position => value += Math.abs(count(a,p=>positionOf(p)===position)-count(b,p=>positionOf(p)===position))*2); (["rapido", "lento"] as const).forEach(mobility => value += Math.abs(count(a,p=>p.mobility===mobility)-count(b,p=>p.mobility===mobility))); return value; };
export function generateBalancedTeams(players: Player[]): BalancedTeams {
 const sizeA=Math.ceil(players.length/2); const sorted=[...players].sort((a,b)=>playerScore(b)-playerScore(a) || Math.random()-.5); const a:Player[]=[]; const b:Player[]=[];
 // Snake draft guarantees strong and weak players begin split between the teams.
 sorted.forEach((player,index)=>{const target=index%4===0||index%4===3?a:b;(target.length<(target===a?sizeA:players.length-sizeA)?target:(target===a?b:a)).push(player)});
 // Improve the draft with score/position/speed-aware swaps.
 for(let round=0;round<40;round++){let best=imbalance(a,b), swap:[number,number]|null=null;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){const nextA=a.map((p,k)=>k===i?b[j]:p),nextB=b.map((p,k)=>k===j?a[i]:p);const next=imbalance(nextA,nextB);if(next<best-.001){best=next;swap=[i,j]}}if(!swap)break;[a[swap[0]],b[swap[1]]]=[b[swap[1]],a[swap[0]]]}
 const current = imbalance(a,b); const alternatives: [number, number][] = []; for(let i=0;i<a.length;i++) for(let j=0;j<b.length;j++){ const nextA=a.map((p,k)=>k===i?b[j]:p), nextB=b.map((p,k)=>k===j?a[i]:p); if(imbalance(nextA,nextB) <= current + 0.75) alternatives.push([i,j]); } if(alternatives.length){ const [i,j]=alternatives[Math.floor(Math.random()*alternatives.length)]; [a[i],b[j]]=[b[j],a[i]]; } const shuffle = (items: Player[]) => [...items].sort(() => Math.random() - .5); return {teamA:shuffle(a),teamB:shuffle(b),sumA:score(a),sumB:score(b)};
}
