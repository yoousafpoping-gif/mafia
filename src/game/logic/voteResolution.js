import { ROLES, VOTE_WEIGHTS } from '../constants.js';

export function voteWeightOf(player) {
  if (!player.isAlive) return 0;
  if (player.isSilenced) return VOTE_WEIGHTS.SILENCED;
  if (player.hasRevealed && player.role === ROLES.MAYOR) return VOTE_WEIGHTS.MAYOR_REVEALED;
  return VOTE_WEIGHTS.BASE;
}

export function tallyVotes(players, votes) {
  const tally = new Map();
  for (const voter of players.values()) {
    if (!voter.isAlive) continue;
    const targetId = votes.get(voter.id);
    if (!targetId) continue;
    tally.set(targetId, (tally.get(targetId) ?? 0) + voteWeightOf(voter));
  }
  return tally;
}

export function resolveTally(tally) {
  let best = null;
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
