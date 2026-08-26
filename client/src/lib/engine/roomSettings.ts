import { config } from './config';

import { LIMITS } from './constants';

export interface RoomSettings {
  targetPlayerCount: number | null;
  mafiaCount: number | null;
  timers: {
    nightMs: number;
    discussionMs: number;
    votingMs: number;
    defenseMs: number;
    lastWordsMs: number;
  };
  voting: {
    mayorWeight: 1 | 2 | 3;
    tiePolicy: 'NO_EXECUTION' | 'RANDOM_TOP' | 'REVOTE';
  };
}

export const ROOM_TIMER_LIMITS_SECONDS = { min: 10, max: 300 } as const;

export function defaultRoomSettings(): RoomSettings {
  return {
    targetPlayerCount: null,
    mafiaCount: null,
    timers: {
      nightMs: config.timers.NIGHT_MS,
      discussionMs: config.timers.DAY_DISCUSSION_MS,
      votingMs: config.timers.DAY_VOTING_MS,
      defenseMs: config.timers.DEFENSE_MS,
      lastWordsMs: config.timers.LAST_WORDS_MS,
    },
    voting: {
      mayorWeight: 3,
      tiePolicy: 'NO_EXECUTION',
    },
  };
}

export function maxMafiaCount(playerCount: number): number {
  return Math.max(1, Math.min(4, Math.floor((playerCount - 1) / 2)));
}

export function effectiveMafiaCount(settings: RoomSettings, playerCount: number): number {
  if (settings.mafiaCount !== null) return settings.mafiaCount;
  if (playerCount <= 7) return 1;
  if (playerCount <= 11) return 2;
  return 3;
}

function timerMs(value: unknown, fallback: number): number {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds)) return fallback;
  return Math.round(milliseconds);
}

export function normalizeRoomSettings(
  input: Partial<RoomSettings> | null | undefined,
  playerCount: number,
  current = defaultRoomSettings(),
): RoomSettings {
  const targetRaw = input?.targetPlayerCount;
  const targetPlayerCount = targetRaw === null || targetRaw === undefined
    ? current.targetPlayerCount
    : Math.round(Number(targetRaw));
  const mafiaRaw = input?.mafiaCount;
  const mafiaCount = mafiaRaw === null || mafiaRaw === undefined
    ? current.mafiaCount
    : Math.round(Number(mafiaRaw));
  const next: RoomSettings = {
    targetPlayerCount,
    mafiaCount,
    timers: {
      nightMs: timerMs(input?.timers?.nightMs, current.timers.nightMs),
      discussionMs: timerMs(input?.timers?.discussionMs, current.timers.discussionMs),
      votingMs: timerMs(input?.timers?.votingMs, current.timers.votingMs),
      defenseMs: timerMs(input?.timers?.defenseMs, current.timers.defenseMs),
      lastWordsMs: timerMs(input?.timers?.lastWordsMs, current.timers.lastWordsMs),
    },
    voting: {
      mayorWeight: input?.voting?.mayorWeight ?? current.voting.mayorWeight,
      tiePolicy: input?.voting?.tiePolicy ?? current.voting.tiePolicy,
    },
  };
  validateRoomSettings(next, playerCount);
  return next;
}

export function validateRoomSettings(settings: RoomSettings, playerCount: number): void {
  if (
    settings.targetPlayerCount !== null &&
    (!Number.isInteger(settings.targetPlayerCount) ||
      settings.targetPlayerCount < LIMITS.MIN_PLAYERS ||
      settings.targetPlayerCount > LIMITS.MAX_PLAYERS)
  ) {
    throw new RangeError(`عدد اللاعبين المطلوب لازم يكون من ${LIMITS.MIN_PLAYERS} إلى ${LIMITS.MAX_PLAYERS}`);
  }

  const compositionCount = settings.targetPlayerCount ?? playerCount;
  if (
    settings.mafiaCount !== null &&
    (!Number.isInteger(settings.mafiaCount) ||
      settings.mafiaCount < 1 ||
      settings.mafiaCount > maxMafiaCount(compositionCount))
  ) {
    throw new RangeError(`عدد المافيا لازم يكون من 1 إلى ${maxMafiaCount(compositionCount)} حسب عدد اللاعبين الحالي`);
  }

  const minMs = ROOM_TIMER_LIMITS_SECONDS.min * 1000;
  const maxMs = ROOM_TIMER_LIMITS_SECONDS.max * 1000;
  for (const duration of Object.values(settings.timers)) {
    if (!Number.isInteger(duration) || duration < minMs || duration > maxMs) {
      throw new RangeError(
        `مدة كل مرحلة لازم تكون بين ${ROOM_TIMER_LIMITS_SECONDS.min} و${ROOM_TIMER_LIMITS_SECONDS.max} ثانية`,
      );
    }
  }
  if (![1, 2, 3].includes(settings.voting.mayorWeight)) {
    throw new RangeError('وزن صوت العمدة لازم يكون 1 أو 2 أو 3');
  }
  if (!['NO_EXECUTION', 'RANDOM_TOP', 'REVOTE'].includes(settings.voting.tiePolicy)) {
    throw new RangeError('قاعدة التعادل غير مدعومة');
  }
}
