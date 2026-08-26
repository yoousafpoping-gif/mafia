import { LIMITS } from './game/constants.js';
import { logger } from './utils/logger.js';

/**
 * البحث السريع — ملحقة بسيطة فوق مدير الأوض:
 * 1) لو فيه أوضة عامة في LOBBY فيها مكان → نرجّع كودها واللاعب بينضم ليها.
 * 2) لو مفيش → نعمل أوضة عامة جديدة وهو المستنى غيره.
 *
 * أوض "اعمل أوضة" العادية بتفضل خاصة بالكود — البحث السريع بس اللي
 * بيشوف الأوض العامة.
 */
export function quickMatch(manager, { name, socketId, cosmetics }) {
  // 1) أول أوضة عامة مفتوحة فيها مكان وفيها بني آدم حقيقي
  for (const room of manager.rooms.values()) {
    if (!room.isPublic) continue;
    if (room.phase !== 'LOBBY') continue;
    if (room.players.size >= LIMITS.MAX_PLAYERS) continue;
    const hasHuman = [...room.players.values()].some((p) => p.isConnected && !p.isBot);
    if (!hasHuman) continue;
    logger.info(`Quick match: joining public room ${room.code} (${room.players.size} seated)`);
    return { code: room.code, created: false };
  }

  // 2) ولا ولا وحدة → أوضة عامة جديدة واللاعب هو الهوست
  const { room } = manager.createRoom({ name, socketId, isPublic: true, cosmetics });
  logger.info(`Quick match: created public room ${room.code}`);
  return { code: room.code, created: true };
}
