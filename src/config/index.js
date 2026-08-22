const num = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  // Render بيحقن PORT تلقائيًا — محليًا 4000
  port: num(process.env.PORT, 4000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  // Origins المسموح بيها (سوكت + REST): CORS_ORIGIN بالأولوية، بعدين CLIENT_URL
  // (رابط الفرونت على Vercel)، والافتراضي * للتشغيل المحلي.
  corsOrigins: (process.env.CORS_ORIGIN ?? process.env.CLIENT_URL ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  timers: {
    NIGHT_MS: num(process.env.NIGHT_MS, 30_000),
    DAY_DISCUSSION_MS: num(process.env.DAY_DISCUSSION_MS, 75_000),
    DAY_VOTING_MS: num(process.env.DAY_VOTING_MS, 30_000),
    DEFENSE_MS: num(process.env.DEFENSE_TIME, 30_000),
    REVENGE_MS: num(process.env.REVENGE_MS, 15_000),
    LAST_WORDS_MS: num(process.env.LAST_WORDS_MS, 20_000),
  },
  chat: {
    maxLength: 280,
  },
  sweepIntervalMs: num(process.env.SWEEP_INTERVAL_MS, 60_000),
  emptyRoomTtlMs: num(process.env.EMPTY_ROOM_TTL_MS, 120_000),
  roomIdleTtlMs: num(process.env.ROOM_IDLE_TTL_MS, 1_800_000),
};
