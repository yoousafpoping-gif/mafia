import { ROLES, VOTE_WEIGHTS, type EnginePlayer } from './constants';

type PlayerMap = Map<string, EnginePlayer>;

export function voteWeightOf(
  player: EnginePlayer,
  mayorWeight: number = VOTE_WEIGHTS.MAYOR_REVEALED,
): number {
  if (!player.isAlive) return 0;
  if (player.isSilenced) return VOTE_WEIGHTS.SILENCED;
  if (player.hasRevealed && player.role === ROLES.MAYOR) return mayorWeight;
  return VOTE_WEIGHTS.BASE;
}

export function tallyVotes(
  players: PlayerMap,
  votes: Map<string, string>,
  mayorWeight: number = VOTE_WEIGHTS.MAYOR_REVEALED,
) {
  const tally = new Map<string, number>();
  for (const voter of players.values()) {
    if (!voter.isAlive) continue;
    const targetId = votes.get(voter.id);
    if (!targetId) continue;
    tally.set(targetId, (tally.get(targetId) ?? 0) + voteWeightOf(voter, mayorWeight));
  }
  return tally;
}

export function resolveTally(tally: Map<string, number>) {
  let best: { playerId: string; count: number } | null = null;
  let tied = false;

  for (const [playerId, count] of tally.entries()) {
    if (!best || count > best.count) {
      best = { playerId, count };
      tied = false;
    } else if (count === best.count) {
      tied = true;
    }
  }

  if (!best || best.count <= 0) {
    return { eliminatedId: null, tied: false, topCount: 0 };
  }

  return { eliminatedId: tied ? null : best.playerId, tied, topCount: best.count };
}
