'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Crown, Crosshair, Gavel, Lock, MicOff, Skull, Users, VenetianMask, WifiOff } from 'lucide-react';
import { BotAvatar } from './Avatars';
import { METAL_HEADER } from '@/styles/themeConfig';
import { playReactionSound, reactionById } from '@/lib/reactions';
import type { GameState, Phase, PublicPlayer } from '@/lib/types';

const PHASE_AR: Partial<Record<Phase, string>> = {
  LOBBY: 'الاستعداد',
  NIGHT: 'الليل',
  DAY_DISCUSSION: 'النقاش',
  DAY_VOTING: 'المحاكمة',
  DEFENSE_STAGE: 'الدفاع',
  LAST_WORDS: 'آخر كلام',
  GAME_OVER: 'النهاية',
};

interface SeatMath {
  x: number;
  y: number;
  inwardX: number;
  inwardY: number;
}

/**
 * Circular seat layout matching the photographic poker table
 * (table_bg.jpeg = top-down circle with 8 chairs). Positions live inside a
 * square stage so the % radius stays a perfect circle at any screen size.
 */
function seatPos(index: number, total: number): SeatMath {
  const angle = (index / total) * 2 * Math.PI - Math.PI/2;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    // 32% radius: كل الكراسي جوه حدود الشاشة بأمان (كانت 42% وبتقصّ فوق وتحت)
    x: 50 + 32 * cos,
    y: 50 + 32 * sin,
    inwardX: -cos,
    inwardY: -sin,
  };
}

export function CouncilTable({
  state,
  onRevealMayor,
  speakingIds = [],
  recentMessages = {},
  reactions = [],
}: {
  state: GameState;
  onRevealMayor: () => void;
  /** socket ids currently detected as talking (from the voice analysers) */
  speakingIds?: string[];
  /** آخر رسالة شات لكل لاعب — بتظهر كبالونة فوق الكارت */
  recentMessages?: Record<string, string>;
  /** ريأكشنز نشطة — إيموجي 3D بتنفجر فوق كارت اللاعب */
  reactions?: { playerId: string; emojiId: string; at: number; key: number }[];
}) {
  const you = state.you!;
  const canReveal = you.role === 'MAYOR' && you.isAlive && !you.hasRevealed;

  const players = [
    ...state.players.filter((p) => p.isAlive),
    ...state.players.filter((p) => !p.isAlive),
  ];
  const aliveCount = state.players.filter((p) => p.isAlive).length;

  const votesByTarget = new Map<string, number>();
  if (state.phase === 'DAY_DISCUSSION' || state.phase === 'DAY_VOTING' || state.phase === 'DEFENSE_STAGE') {
    for (const entry of state.voteLog ?? []) {
      votesByTarget.set(entry.targetId, (votesByTarget.get(entry.targetId) ?? 0) + 1);
    }
  }
  // زملاء المافيا — العيلة بتتعرف على نفسها من أول ليلة
  const mafiaPartnerIds = new Set((you.partners ?? []).map((partner) => partner.id));
  const maxVotes = Math.max(0, ...votesByTarget.values());
  const showTokens =
    state.phase === 'DAY_DISCUSSION' || state.phase === 'DAY_VOTING' || state.phase === 'DEFENSE_STAGE';

  return (
    <section className="relative flex h-full min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
        <h2 className={`${METAL_HEADER} flex items-center gap-2 text-xl`}>
          <Users
            className="h-5 w-5 text-[#d4af37] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
            strokeWidth={1.5}
          />
          طاولة المجلس
        </h2>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-night-600 bg-night-800/80 px-2 py-1 font-mono text-[10px] font-bold text-slate-300">
            أحياء: {aliveCount}
          </span>
          {canReveal && (
            <motion.button
              animate={{ boxShadow: ['0 0 0px rgba(229,181,103,0)', '0 0 26px rgba(229,181,103,0.45)', '0 0 0px rgba(229,181,103,0)'] }}
              transition={{ repeat: Infinity, duration: 2.2 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={onRevealMayor}
              className="flex items-center gap-2 rounded-xl border border-gold-500/60 bg-gradient-to-r from-gold-600/25 to-gold-500/10 px-4 py-2 text-sm font-bold text-gold-300 transition hover:from-gold-600/40 hover:to-gold-500/20"
            >
              <Crown className="h-4 w-4" />
              اكشف إنك العمدة · ×3
            </motion.button>
          )}
        </div>
      </div>

      <div className="relative min-h-[340px] flex-1">
        {/* vignette خفيف ناعم — مش بقعة منورة وسط الشاشة، وخلف كل الكروت والبالونات (z-0) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/20 to-black/70"
        />

        {/* الخلفية الفوتوغرافية (table_bg.jpeg) معروضة على روت الشاشة —
            الترابيزة نفسها مش محتاجة رسمة تحتها، الكراسي بس اللي بنحسبها */}

        {/* square stage keeps the trigonometry circular on any aspect ratio */}
        <div className="absolute inset-0 z-10 mx-auto aspect-square h-full max-w-full">
          {/* center phase caption — شفاف تمامًا وخلف كل الكروت والبالونات (z-0) */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 px-6 py-4 text-center sm:px-10 sm:py-5">
            <span className="block font-serif text-xl font-black text-gold-500 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] drop-shadow-[0_0_14px_rgba(0,0,0,0.9)] sm:text-2xl">
              {PHASE_AR[state.phase] ?? state.phase}
            </span>
            <span className="mt-0.5 block font-mono text-[9px] tracking-[0.3em] text-slate-300 uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              round {state.round}
            </span>
            <span className="mt-1 flex items-center justify-center gap-1 font-mono text-[10px] font-bold text-blood-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
              <Skull className="h-3 w-3" /> {aliveCount} أرواح
            </span>
          </div>

          {/* seats pinned to the chairs in the photo */}
          {players.map((player, index) => (
            <SeatGroup
              key={player.id}
              player={player}
              math={seatPos(index, players.length)}
              isYou={player.id === you.id}
              votes={votesByTarget.get(player.id) ?? 0}
              isTopAccused={
                showTokens && maxVotes > 0 && (votesByTarget.get(player.id) ?? 0) === maxVotes
              }
              isSpeaking={Boolean(player.sid && speakingIds.includes(player.sid))}
              isDefending={state.defense?.playerId === player.id}
              isMafiaTeammate={
                you.team === 'MAFIA' && you.isAlive && mafiaPartnerIds.has(player.id)
              }
              bubble={recentMessages[player.id]}
              showTokens={showTokens}
              order={index}
              reaction={reactions.filter((r) => r.playerId === player.id).at(-1)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SeatGroup({
  player,
  math,
  isYou,
  votes,
  isTopAccused,
  isSpeaking,
  isDefending,
  isMafiaTeammate,
  bubble,
  showTokens,
  order,
  reaction,
}: {
  player: PublicPlayer;
  math: SeatMath;
  isYou: boolean;
  votes: number;
  isTopAccused: boolean;
  isSpeaking: boolean;
  /** this seat currently stands in the DEFENSE_STAGE spotlight */
  isDefending?: boolean;
  /** viewer is living mafia and this seat is a family member */
  isMafiaTeammate?: boolean;
  /** latest chat message from this player — floats above the card */
  bubble?: string;
  /** آخر ريأكشن وصل لهذا المقعد — إيموجي 3D فوق الكارت */
  reaction?: { playerId: string; emojiId: string; at: number; key: number };
  showTokens: boolean;
  order: number;
}) {
  const dead = !player.isAlive;
  const mayorRevealed = player.hasRevealed;
  const muted = player.isSilenced;

  /* صوت الريأكشن — مكاني: يمين/شمال حسب مقعد اللاعب على الطاولة */
  useEffect(() => {
    if (!reaction) return;
    const pan = (math.x - 50) / 32;
    void playReactionSound(reaction.emojiId, pan);
  }, [reaction?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: isDefending ? 1.25 : 1 }}
      transition={{ delay: order * 0.05, duration: 0.35 }}
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${
        isDefending ? 'z-50' : 'z-10'
      }`}
      style={{ left: `${math.x}%`, top: `${math.y}%` }}
    >
      {/* defense spotlight — warm cone pooling under the accused */}
      {isDefending && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-8 z-0 animate-pulse rounded-full bg-[radial-gradient(circle,_rgba(212,175,55,0.4),_transparent_70%)] blur-xl"
        />
      )}
      {/* 3D reaction pop — إيموجي 3D بتنفجر فوق الكارت بتوهج ذهبي */}
      {reaction && reactionById(reaction.emojiId) && (
        <span
          key={reaction.key}
          className="animate-emoji-pop pointer-events-none absolute -top-20 left-1/2 z-[100] block h-20 w-20"
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-[radial-gradient(circle,_rgba(212,175,55,0.55),_transparent_70%)] blur-md"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reactionById(reaction.emojiId)!.asset}
            alt={reactionById(reaction.emojiId)!.label}
            className="relative h-20 w-20 object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.6)]"
          />
        </span>
      )}
      {/* speech bubble — آخر كلمة قالها اللاعب، بتطفو فوق الكارت */}
      {bubble && (
        <div
          key={bubble}
          className="animate-bubble-in pointer-events-none absolute -top-14 left-1/2 z-[60] w-max max-w-[180px]"
        >
          <div className="rounded-2xl border border-gold-500/50 bg-black/90 px-3 py-1.5 text-center text-xs leading-snug text-gold-100 shadow-[0_8px_24px_rgba(0,0,0,0.7)] backdrop-blur-md">
            <span className="line-clamp-3">{bubble}</span>
          </div>
          {/* downward triangle pointer */}
          <span
            aria-hidden
            className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-black/90"
          />
        </div>
      )}
      {/* talking glow reflecting ON the velvet under the card */}
      {isSpeaking && !dead && (
        <span
          aria-hidden
          className="absolute -bottom-2 left-1/2 z-0 h-3 w-20 -translate-x-1/2 animate-pulse rounded-[50%] bg-red-500/60 blur-md"
        />
      )}

      {/* noir tarot card — velvet face, double gold line, cinematic hover */}
      <div
        className={`relative flex h-28 w-20 flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-[#d4af37]/40 bg-gradient-to-b from-[#1a1410] to-[#0a0806] shadow-[0_4px_20px_rgba(0,0,0,0.8)] transition-all duration-300 sm:h-32 sm:w-24 ${
          dead ? 'opacity-70 grayscale' : ''
        } ${
          isSpeaking && !dead
            ? // active speaker — crimson neon ring
              'ring-2 ring-red-600 shadow-[0_4px_20px_rgba(0,0,0,0.8),0_0_25px_rgba(220,38,38,0.8)]'
            : mayorRevealed
              ? 'ring-2 ring-gold-400 shadow-[0_4px_20px_rgba(0,0,0,0.8),0_0_18px_rgba(212,175,55,0.5)]'
              : muted && player.isAlive
                ? 'ring-2 ring-blood-500 shadow-[0_4px_20px_rgba(0,0,0,0.8)]'
                : isTopAccused
                  ? 'animate-pulse ring-2 ring-blood-400 shadow-[0_4px_20px_rgba(0,0,0,0.8)]'
                  : isYou
                    ? 'ring-2 ring-gold-500/80 shadow-[0_4px_20px_rgba(0,0,0,0.8)]'
                    : 'shadow-[0_4px_20px_rgba(0,0,0,0.8)]'
        } ${
          dead
            ? ''
            : 'cursor-pointer hover:-translate-y-2 hover:border-[#ffd700] hover:shadow-[0_4px_20px_rgba(0,0,0,0.8),0_0_25px_rgba(212,175,55,0.4)]'
        }`}
      >
        {/* face-down tarot backing: retro diagonal stripes + gold emblem */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 [background:repeating-linear-gradient(45deg,_rgba(212,175,55,0.09)_0_6px,_transparent_6px_12px)]"
        />
        {/* inner hairline — the second line of the metallic double border */}
        <span aria-hidden className="pointer-events-none absolute inset-1 rounded-lg border border-[#d4af37]/25" />
        <span aria-hidden className="absolute bottom-1 right-1.5 font-serif text-[9px] font-black text-[#d4af37]/40">
          VII
        </span>

        {dead ? (
          /* DEAD state — dark overlay + stamped verdict */
          <div className="relative z-10 flex flex-col items-center gap-1">
            <Skull className="h-7 w-7 text-slate-600 sm:h-9 sm:w-9" strokeWidth={1.5} />
            <span className="-rotate-12 rounded border-2 border-blood-600/80 px-1 font-mono text-[9px] font-black tracking-widest text-blood-500">
              مرحوم
            </span>
          </div>
        ) : (
          /* avatar inside circular gold-ring frame */
          <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#d4af37]/70 bg-night-950/80 shadow-[0_0_14px_rgba(212,175,55,0.35)] sm:h-12 sm:w-12">
            {player.isBot ? (
              <BotAvatar size={40} />
            ) : (
              <span className="font-serif text-base font-black text-gold-200 sm:text-lg">
                {player.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
        )}

        {isMafiaTeammate && !dead && (
          <span
            title="زميلك في العيلة"
            className="absolute left-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-md border border-gold-300/60 bg-blood-600/85 shadow-[0_0_10px_rgba(220,38,38,0.7)]"
          >
            <VenetianMask className="h-3 w-3 text-gold-200" strokeWidth={1.5} />
          </span>
        )}
        {mayorRevealed && (
          <span className="absolute -top-2.5 left-1/2 z-20 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-gold-300/80 bg-gradient-to-b from-gold-400 to-gold-700 shadow-[0_0_12px_rgba(229,181,103,0.8)]">
            <Crown className="h-3 w-3 text-night-950" />
          </span>
        )}
        {isTopAccused && !dead && (
          <Crosshair
            className="absolute -right-2 -top-2 z-20 h-5 w-5 animate-pulse text-blood-400 drop-shadow-[0_0_6px_rgba(230,57,70,0.85)]"
            strokeWidth={1.5}
          />
        )}
        {muted && player.isAlive && (
          <>
            {/* glassmorphic lock overlay frosted over the mouth of the card */}
            <span className="absolute inset-x-2 top-5 z-10 flex flex-col items-center gap-0.5 rounded-lg border border-white/25 bg-white/10 px-1 py-1 backdrop-blur-sm sm:top-8">
              <Lock className="h-3 w-3 text-slate-200 sm:h-3.5 sm:w-3.5" strokeWidth={1.5} />
              <span className="font-mono text-[7px] font-black tracking-wider text-slate-200">مسكت</span>
            </span>
            <span className="absolute -bottom-1 -left-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-blood-400/70 bg-night-950 shadow-[0_0_10px_rgba(239,68,68,0.6)]">
              <MicOff className="h-2.5 w-2.5 text-blood-400" strokeWidth={1.5} />
            </span>
          </>
        )}
        {!player.isConnected && (
          <span className="absolute -bottom-1 -right-1 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 bg-night-950">
            <WifiOff className="h-2.5 w-2.5 text-slate-400" strokeWidth={1.5} />
          </span>
        )}
        {player.isBot && !dead && (
          <span className="absolute -left-1.5 -top-1 z-20 text-[10px]" title="بوت">🤖</span>
        )}

        {showTokens && votes > 0 && !dead && (
          <VoteTokens count={votes} dx={math.inwardX} dy={math.inwardY} />
        )}
      </div>

      <span
        className={`z-20 mt-1 max-w-[80px] truncate rounded-full border border-gold-500/30 bg-black/80 px-2 py-0.5 text-center text-[10px] font-bold leading-snug text-gold-200 shadow-[0_0_12px_rgba(212,175,55,0.25)] sm:max-w-[92px] ${
          dead ? 'border-slate-700 bg-night-900/90 text-slate-500 line-through' : ''
        } ${isYou ? 'ring-1 ring-gold-500/60' : ''}`}
      >
        {player.name}
        {isYou && ' ★'}
      </span>
    </motion.div>
  );
}

function VoteTokens({ count, dx, dy }: { count: number; dx: number; dy: number }) {
  const shown = Math.min(count, 5);
  const arrowDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
      className="pointer-events-none absolute left-1/2 top-1/2 z-30 flex flex-col items-center gap-0.5"
      style={{ transform: `translate(-50%, -50%) translate(${dx * 46}px, ${dy * 46}px)` }}
    >
      <span className="flex flex-col items-center">
        {Array.from({ length: shown }).map((_, i) => (
          <span
            key={i}
            className="-my-0.5 block h-3 w-3 rounded-full border border-red-300/50 bg-gradient-to-b from-red-400 to-red-700 shadow-[0_0_8px_rgba(239,68,68,0.65)]"
            style={{ transform: `translate(${i % 2 === 0 ? -1.5 : 1.5}px, ${i * -0.5}px)` }}
          />
        ))}
        {count > 5 && (
          <span className="rounded-full bg-blood-600 px-1 font-mono text-[8px] font-black text-white shadow-[0_0_8px_rgba(220,38,38,0.7)]">
            ×{count}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className="block h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-blood-400 drop-shadow-[0_0_4px_rgba(239,68,68,0.7)]"
        style={{ transform: `rotate(${arrowDeg}deg)` }}
      />
    </motion.span>
  );
}

export function VoteCountHint({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <Gavel className="h-3 w-3" /> وصل {count} صوت
    </span>
  );
}
