import type { Role, Team } from './types';

const KEY = 'mafia-player-stats-v1';

export interface PlayerStats {
  games: number;
  wins: number;
  losses: number;
  rolePlays: Partial<Record<Role, number>>;
  xp: number;
}

export interface PlayerProfile {
  stats: PlayerStats;
  level: number;
  title: string;
}

const EMPTY_STATS: PlayerStats = {
  games: 0,
  wins: 0,
  losses: 0,
  rolePlays: {},
  xp: 0,
};

/** صورة المواطن هي الـfallback الرسمي لأي دور ملوش أرت */
export const FALLBACK_ROLE_IMAGE = '/assets/roles/citizen.png';

/**
 * سجل أرت الأدوار — كل الدور مرتبط بملفه في /assets/roles/.
 * الصور بتترندر ديناميكيًا في كروت اللاعبين ومودال كشف الدور.
 */
export const ROLE_IMAGE: Record<Role, string> = {
  MAFIA_BOSS: '/assets/roles/mafia_boss.png',
  SILENCER: '/assets/roles/silencer.png',
  MAYOR: '/assets/roles/mayor.png',
  GOOD_BOY: '/assets/roles/good_boy.png',
  MEDIC: '/assets/roles/medic.png',
  SNIPER: '/assets/roles/sniper.png',
  CITIZEN: '/assets/roles/citizen.png',
  DETECTIVE: '/assets/roles/detective.png',
  FRAMER: '/assets/roles/polisher.png',
  VIGILANTE: '/assets/roles/avenger.png',
  JOKER: '/assets/roles/joker.png',
  // المافيوزو معندوش أرت خاص — بيورث صورة المواطن
  MAFIOSO: FALLBACK_ROLE_IMAGE,
};

export function roleImage(role: Role | null | undefined): string {
  if (!role) return FALLBACK_ROLE_IMAGE;
  return ROLE_IMAGE[role] ?? FALLBACK_ROLE_IMAGE;
}

const TITLES: { minLevel: number; title: string }[] = [
  { minLevel: 12, title: 'أسطورة الحي — The Living Legend' },
  { minLevel: 9, title: 'الدون — The Don' },
  { minLevel: 7, title: 'المحقق الصامت — Silent Investigator' },
  { minLevel: 5, title: 'صوت المجلس — Voice of the Council' },
  { minLevel: 3, title: 'عين صاحية — Watchful Eye' },
  { minLevel: 1, title: 'مبتدئ الحي — Alley Rookie' },
];

function load(): PlayerStats {
  if (typeof window === 'undefined') return EMPTY_STATS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY_STATS };
    const parsed = JSON.parse(raw) as Partial<PlayerStats>;
    return {
      games: parsed.games ?? 0,
      wins: parsed.wins ?? 0,
      losses: parsed.losses ?? 0,
      rolePlays: parsed.rolePlays ?? {},
      xp: parsed.xp ?? 0,
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function save(stats: PlayerStats) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    /* storage unavailable */
  }
}

export function levelFor(xp: number): number {
  // Each level costs a bit more XP than the last.
  let level = 1;
  let needed = 100;
  let remaining = xp;
  while (remaining >= needed && level < 99) {
    remaining -= needed;
    level += 1;
    needed = Math.round(needed * 1.35);
  }
  return level;
}

export function titleFor(level: number): string {
  return TITLES.find((tier) => level >= tier.minLevel)?.title ?? TITLES[TITLES.length - 1].title;
}

export function getProfile(): PlayerProfile {
  const stats = load();
  const level = levelFor(stats.xp);
  return { stats, level, title: titleFor(level) };
}

/** Call once when a game ends. Returns true when the record was applied. */
export function recordGameResult(
  youId: string,
  winner: Team,
  roster: { id: string; role: Role; isAlive: boolean }[],
): boolean {
  const you = roster.find((entry) => entry.id === youId);
  if (!you) return false;
  const stats = load();
  const won = you.role.startsWith('MAFIA') || you.role === 'SILENCER'
    ? winner === 'MAFIA'
    : winner === 'TOWN';

  stats.games += 1;
  if (won) stats.wins += 1;
  else stats.losses += 1;

  stats.rolePlays[you.role] = (stats.rolePlays[you.role] ?? 0) + 1;
  stats.xp += won ? (you.isAlive ? 120 : 80) : you.isAlive ? 25 : 15;
  save(stats);
  return true;
}
