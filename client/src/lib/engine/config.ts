// Client-side game timers (server config dropped). Tune via env if desired.
function num(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  timers: {
    NIGHT_MS: num(process.env.NEXT_PUBLIC_NIGHT_MS, 30_000),
    DAY_DISCUSSION_MS: num(process.env.NEXT_PUBLIC_DAY_DISCUSSION_MS, 75_000),
    DAY_VOTING_MS: num(process.env.NEXT_PUBLIC_DAY_VOTING_MS, 30_000),
    DEFENSE_MS: num(process.env.NEXT_PUBLIC_DEFENSE_TIME, 30_000),
    REVENGE_MS: num(process.env.NEXT_PUBLIC_REVENGE_MS, 15_000),
    LAST_WORDS_MS: num(process.env.NEXT_PUBLIC_LAST_WORDS_MS, 20_000),
  },
  chat: {
    maxLength: 280,
  },
};
