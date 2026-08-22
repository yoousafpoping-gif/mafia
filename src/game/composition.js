import { LIMITS, ROLES } from './constants.js';
import { secureShuffle } from '../utils/random.js';

/**
 * Dynamic role matrix — pool composition by player count:
 *   6-7  : Godfather + Doctor + Detective              + citizens
 *   8-9  : Godfather + Mafioso + Doctor + Detective + Joker + citizens
 *   10-11: Godfather + Framer  + Doctor + Detective + Vigilante + Joker + citizens
 *   12+  : Godfather + Mafioso + Framer + the four specials      + citizens
 * Rooms under 6 fall back to the legacy micro-game pool.
 */
export function buildRolePool(playerCount) {
  const pool = [];
  if (playerCount <= 5) {
    pool.push(ROLES.MAFIA_BOSS, ROLES.MEDIC, ROLES.MAYOR);
    if (playerCount >= 5) pool.push(ROLES.GOOD_BOY);
    while (pool.length < playerCount) pool.push(ROLES.CITIZEN);
    return pool;
  }

  if (playerCount <= 7) {
    // 1 Mafia, 2 special citizens
    pool.push(ROLES.MAFIA_BOSS, ROLES.MEDIC, ROLES.DETECTIVE);
  } else if (playerCount <= 9) {
    // 2 Mafia, 3 specials
    pool.push(ROLES.MAFIA_BOSS, ROLES.MAFIOSO, ROLES.MEDIC, ROLES.DETECTIVE, ROLES.JOKER);
  } else if (playerCount <= 11) {
    // 2 Mafia, 4 specials
    pool.push(
      ROLES.MAFIA_BOSS,
      ROLES.FRAMER,
      ROLES.MEDIC,
      ROLES.DETECTIVE,
      ROLES.VIGILANTE,
      ROLES.JOKER,
    );
  } else {
    // 12+: 3 Mafia, 4 specials
    pool.push(
      ROLES.MAFIA_BOSS,
      ROLES.MAFIOSO,
      ROLES.FRAMER,
      ROLES.MEDIC,
      ROLES.DETECTIVE,
      ROLES.VIGILANTE,
      ROLES.JOKER,
    );
  }

  while (pool.length < playerCount) pool.push(ROLES.CITIZEN);
  return pool;
}

export function buildDeck(playerCount) {
  if (!Number.isInteger(playerCount)) {
    throw new TypeError(`playerCount must be an integer, received ${playerCount}`);
  }
  if (playerCount < LIMITS.MIN_PLAYERS || playerCount > LIMITS.MAX_PLAYERS) {
    throw new RangeError(`playerCount must be between ${LIMITS.MIN_PLAYERS} and ${LIMITS.MAX_PLAYERS}`);
  }
  return secureShuffle(buildRolePool(playerCount));
}
