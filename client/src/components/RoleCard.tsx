'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowLeft, ShieldCheck, Users } from 'lucide-react';
import { ROLE_META } from '@/lib/roles';
import { GOLD_FRAME } from '@/styles/themeConfig';
import { roleImage } from '@/lib/stats';
import type { Role } from '@/lib/types';

/* ================= shared noir particles ================= */

const EMBER_SPOTS = [
  { left: '6%', top: '78%', dur: '1.9s', delay: '0s', s: 4 },
  { left: '14%', top: '88%', dur: '2.3s', delay: '0.5s', s: 3 },
  { left: '86%', top: '82%', dur: '1.7s', delay: '0.3s', s: 4 },
  { left: '94%', top: '68%', dur: '2.5s', delay: '0.8s', s: 3 },
  { left: '50%', top: '94%', dur: '2.1s', delay: '1.1s', s: 3 },
  { left: '70%', top: '90%', dur: '1.8s', delay: '0.2s', s: 4 },
];

/** Rising fire embers — identical physics to the landing-screen sparks. */
export function Embers({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}>
      {EMBER_SPOTS.map((spot, i) => (
        <i
          key={i}
          className="spark absolute block rounded-full"
          style={{
            left: spot.left,
            top: spot.top,
            width: spot.s,
            height: spot.s,
            animationDelay: spot.delay,
            ['--sdur' as string]: spot.dur,
            background: i % 2 === 0 ? '#fbbf24' : '#f97316',
            boxShadow: '0 0 7px rgba(245,158,11,0.85)',
          }}
        />
      ))}
    </span>
  );
}

/* ================= Noir portrait illustrations ================= */

interface PortraitProps {
  className?: string;
}

function PortraitSvg({
  id,
  className,
  children,
  bgFrom = '#171226',
  bgTo = '#07050c',
}: PortraitProps & { id: string; children: React.ReactNode; bgFrom?: string; bgTo?: string }) {
  return (
    <svg
      viewBox="0 0 200 260"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden
      style={{ display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={bgFrom} />
          <stop offset="1" stopColor={bgTo} />
        </linearGradient>
        <filter id={`${id}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="linear" slope="0.08" /></feComponentTransfer>
          <feComposite operator="over" in2="SourceGraphic" />
        </filter>
      </defs>
      <rect width="200" height="260" fill={`url(#${id}-bg)`} />
      {children}
      <rect width="200" height="260" filter={`url(#${id}-grain)`} opacity="0.5" style={{ mixBlendMode: 'overlay' }} />
    </svg>
  );
}

function BossPortrait({ className }: PortraitProps) {
  return (
    <PortraitSvg id="pb" bgFrom="#1d1526" bgTo="#080509" className={className}>
      <g opacity="0.09">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={-40 + i * 44} y={-60} width="16" height="420" fill="#f3d68b" transform="rotate(14 100 130)" />
        ))}
      </g>
      <path d="M20 260 Q26 176 62 160 L138 160 Q174 176 180 260 Z" fill="#131019" />
      <g stroke="#f3d68b" strokeWidth="0.7" opacity="0.16">
        {[52, 66, 80, 120, 134, 148].map((x) => (
          <line key={x} x1={x} y1="168" x2={x - 8} y2="260" />
        ))}
      </g>
      <path d="M86 158 L100 186 L114 158 Z" fill="#e8e4da" />
      <path d="M96 162 L100 184 L104 162 Z" fill="#7a1220" />
      <ellipse cx="100" cy="112" rx="34" ry="38" fill="#caa27a" />
      <path d="M66 108 Q64 150 88 156 L74 118 Z" fill="#a97c55" opacity="0.6" />
      <path d="M78 96 Q100 84 122 96 L122 106 Q100 94 78 106 Z" fill="#1b1b22" />
      <path d="M30 92 Q100 68 170 92 L166 102 Q100 80 34 102 Z" fill="#101016" />
      <path d="M42 88 Q100 46 158 88 Q160 76 100 58 Q40 76 42 88 Z" fill="#16161e" />
      <rect x="56" y="82" width="88" height="10" rx="5" fill="#7a1220" />
      <path d="M50 90 Q100 72 150 90" stroke="#3a3a46" strokeWidth="1.4" fill="none" opacity="0.8" />
      <path d="M84 116 q4 -3 8 0 M108 116 q4 -3 8 0" stroke="#241a12" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="89" cy="121" r="2" fill="#0c0a08" />
      <circle cx="111" cy="121" r="2" fill="#0c0a08" />
      <path d="M92 140 Q100 145 108 140" stroke="#6d4a2c" strokeWidth="2" fill="none" strokeLinecap="round" />
      <g transform="rotate(-22 132 150)">
        <rect x="118" y="146" width="34" height="8" rx="3.5" fill="#6b4423" />
        <rect x="149" y="146.8" width="7" height="6.4" rx="2" fill="#3f2a15" />
        <circle cx="157.5" cy="150" r="3" fill="#ff6b35">
          <animate attributeName="opacity" values="1;0.35;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
      </g>
      <path d="M164 136 q7 -10 -2 -19 q-8 -9 2 -18" stroke="#c9ced4" strokeWidth="3.4" fill="none" strokeLinecap="round" opacity="0.4">
        <animate attributeName="opacity" values="0.45;0;0.45" dur="3.4s" repeatCount="indefinite" />
        <animate attributeName="d" values="M164 136 q7 -10 -2 -19 q-8 -9 2 -18; M167 136 q-6 -11 3 -20 q7 -9 -2 -17; M164 136 q7 -10 -2 -19 q-8 -9 2 -18" dur="3.4s" repeatCount="indefinite" />
      </path>
      <path d="M34 250 Q38 190 60 168" stroke="#e5b567" strokeWidth="2.5" fill="none" opacity="0.35" />
    </PortraitSvg>
  );
}

function SilencerPortrait({ className }: PortraitProps) {
  return (
    <PortraitSvg id="ps" bgFrom="#200a10" bgTo="#070304" className={className}>
      <path d="M100 -10 L28 260 L172 260 Z" fill="#f3d68b" opacity="0.05" />
      <path d="M18 260 Q30 168 100 158 Q170 168 182 260 Z" fill="#170a0f" />
      <path d="M100 34 Q52 44 54 108 Q56 158 84 166 L116 166 Q144 158 146 108 Q148 44 100 34 Z" fill="#1d0c12" />
      <path d="M62 96 Q62 142 88 150 L112 150 Q138 142 138 96 Q138 62 100 60 Q62 62 62 96 Z" fill="#c99871" />
      <g>
        <path
          d="M60 118 Q60 158 100 160 Q140 158 140 118 Q140 104 128 102 L72 102 Q60 104 60 118 Z"
          fill="#2a1016"
          stroke="#571c25"
          strokeWidth="2"
        >
          <animate attributeName="stroke-opacity" values="1;0.3;1" dur="2.6s" repeatCount="indefinite" />
        </path>
        <path d="M76 110 L76 150 M88 108 L88 154 M100 108 L100 155 M112 108 L112 154 M124 110 L124 150" stroke="#7c2733" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M64 108 Q100 98 136 108" stroke="#3a1218" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      <path d="M70 92 q6 -5 13 -1 M117 91 q7 -4 13 1" stroke="#241a12" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="81" cy="97" r="2.6" fill="#efe6d8" />
      <circle cx="119" cy="97" r="2.6" fill="#efe6d8" />
      <path d="M56 84 L20 76 M144 84 L180 76" stroke="#571c25" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="105" r="52" fill="none" stroke="#ef4444" strokeWidth="1.6" opacity="0.3">
        <animate attributeName="r" values="48;56;48" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0.08;0.4" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <path d="M36 250 Q42 196 62 174" stroke="#ef4444" strokeWidth="2.5" fill="none" opacity="0.4" />
    </PortraitSvg>
  );
}

function MayorPortrait({ className }: PortraitProps) {
  return (
    <PortraitSvg id="pm" bgFrom="#0e1530" bgTo="#05070f" className={className}>
      {[[30, 40], [168, 60], [44, 210], [160, 190], [100, 24], [24, 120], [178, 140]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.6" fill="#e5b567" opacity="0.5">
          <animate attributeName="opacity" values="0.55;0.1;0.55" dur={`${2 + i * 0.4}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <path d="M18 260 Q26 178 64 162 L136 162 Q174 178 182 260 Z" fill="#141d33" />
      <path d="M64 162 L100 260 L136 162 L120 156 L100 176 L80 156 Z" fill="#d4a24e" opacity="0.9" />
      <path d="M64 162 L100 260 L136 162" fill="none" stroke="#8a5f1d" strokeWidth="2" opacity="0.7" />
      {[74, 88, 102, 116].map((x, i) => (
        <circle key={i} cx={x + (i % 2)} cy={172 + Math.abs(x - 100) * 0.9} r="4.5" fill="none" stroke="#e5b567" strokeWidth="1.6" opacity="0.85" />
      ))}
      <ellipse cx="100" cy="110" rx="33" ry="37" fill="#d9ae83" />
      <path d="M67 100 Q66 60 100 54 Q134 60 133 100 L126 96 Q100 84 74 96 Z" fill="#d8d8de" />
      <path d="M67 100 Q70 78 84 70 L80 100 Z" fill="#b9b9c2" />
      <path d="M120 70 Q130 78 133 100 L124 98 Q122 80 114 72 Z" fill="#b9b9c2" />
      <path d="M78 104 q7 -5 15 -1 M107 103 q8 -4 15 1" stroke="#3a2a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="87" cy="111" r="2.4" fill="#171310" />
      <circle cx="113" cy="111" r="2.4" fill="#171310" />
      <circle cx="115.5" cy="108.5" r="9.5" fill="none" stroke="#f3d68b" strokeWidth="2">
        <animate attributeName="opacity" values="0.95;0.5;0.95" dur="3.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="112.5" cy="105.5" r="2" fill="#fffbe8" opacity="0.9">
        <animate attributeName="opacity" values="0.9;0.2;0.9" dur="3.2s" repeatCount="indefinite" />
      </circle>
      <path d="M125 118 Q138 132 132 152" stroke="#f3d68b" strokeWidth="1.4" fill="none" opacity="0.7" />
      <path d="M86 132 Q100 140 114 132 L112 137 Q100 144 88 137 Z" fill="#9a9aa4" />
      <path d="M92 148 Q100 153 108 148" stroke="#7c5230" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M30 250 Q36 198 58 172" stroke="#e5b567" strokeWidth="2.5" fill="none" opacity="0.4" />
    </PortraitSvg>
  );
}

function GoodBoyPortrait({ className }: PortraitProps) {
  return (
    <PortraitSvg id="pg" bgFrom="#0d1a14" bgTo="#040906" className={className}>
      <path d="M-20 30 L220 150 L220 170 L-20 50 Z" fill="#e7f5ec" opacity="0.06" />
      <circle cx="100" cy="112" r="58" fill="none" stroke="#34d399" strokeWidth="1.6" opacity="0.25">
        <animate attributeName="r" values="54;62;54" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.32;0.06;0.32" dur="3s" repeatCount="indefinite" />
      </circle>
      <path d="M34 260 Q28 170 62 148 Q84 134 100 134 Q116 134 138 148 Q172 170 166 260 Z" fill="#20402f" />
      <path d="M56 132 Q60 84 100 80 Q140 84 144 132 Q146 158 128 150 Q112 118 100 118 Q88 118 72 150 Q54 158 56 132 Z" fill="#2c5442" />
      <path d="M84 150 L80 190 M116 150 L120 190" stroke="#9fc7b2" strokeWidth="3" strokeLinecap="round" />
      <circle cx="80" cy="192" r="3" fill="#9fc7b2" />
      <circle cx="120" cy="192" r="3" fill="#9fc7b2" />
      <ellipse cx="100" cy="116" rx="29" ry="31" fill="#e3b489" />
      <path d="M78 108 q8 -6 16 -1 M106 107 q8 -5 16 1" stroke="#3a2a1a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="88" cy="115" r="3.4" fill="#20150d" />
      <circle cx="112" cy="115" r="3.4" fill="#20150d" />
      <circle cx="89.4" cy="113.6" r="1.1" fill="#fff" />
      <circle cx="113.4" cy="113.6" r="1.1" fill="#fff" />
      <path d="M92 134 Q100 139 108 134" stroke="#8a5a34" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M40 250 Q44 206 60 182" stroke="#6ee7b7" strokeWidth="2.5" fill="none" opacity="0.35" />
    </PortraitSvg>
  );
}

function MedicPortrait({ className }: PortraitProps) {
  return (
    <PortraitSvg id="pd" bgFrom="#071715" bgTo="#030a09" className={className}>
      <path d="M100 60 L108 84 L132 84 L112 98 L120 122 L100 108 L80 122 L88 98 L68 84 L92 84 Z" fill="#10b981" opacity="0.08" />
      <path d="M20 260 Q28 180 64 164 L136 164 Q172 180 180 260 Z" fill="#dfe7ea" />
      <path d="M64 164 L100 208 L136 164 L118 158 L100 176 L82 158 Z" fill="#b9c6cc" />
      <g transform="rotate(-14 100 216)">
        <rect x="52" y="212" width="96" height="7" rx="3.5" fill="none" stroke="#10b981" strokeWidth="3" />
      </g>
      <circle cx="58" cy="222" r="6" fill="none" stroke="#10b981" strokeWidth="3" />
      <circle cx="142" cy="222" r="6" fill="none" stroke="#10b981" strokeWidth="3" />
      <ellipse cx="100" cy="110" rx="31" ry="35" fill="#dcae82" />
      <path d="M69 96 Q100 78 131 96 L131 104 Q100 88 69 104 Z" fill="#0f3f38" />
      <circle cx="100" cy="92" r="11" fill="#123c36" stroke="#2f7d6d" strokeWidth="2.4" />
      <circle cx="100" cy="92" r="4" fill="#9ff0e0" opacity="0.5">
        <animate attributeName="opacity" values="0.65;0.15;0.65" dur="2.8s" repeatCount="indefinite" />
      </circle>
      <path d="M79 106 q7 -5 14 -1 M107 105 q7 -4 14 1" stroke="#33241a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="87" cy="112" r="2.4" fill="#1c130c" />
      <circle cx="113" cy="112" r="2.4" fill="#1c130c" />
      <path
        d="M70 126 Q70 150 100 152 Q130 150 130 126 Q130 118 120 118 L80 118 Q70 118 70 126 Z"
        fill="#e7ecef"
        stroke="#c3ced4"
        strokeWidth="1.6"
      />
      <path d="M70 128 L58 140 M130 128 L142 140" stroke="#c3ced4" strokeWidth="3" strokeLinecap="round" />
      <path d="M84 134 h32 M100 118 v0" stroke="#c3ced4" strokeWidth="1.4" opacity="0.7" />
      <circle cx="100" cy="135" r="3.4" fill="#10b981" opacity="0.85">
        <animate attributeName="fill" values="#10b981;#6ee7b7;#10b981" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <path d="M32 250 Q38 202 58 178" stroke="#6ee7b7" strokeWidth="2.5" fill="none" opacity="0.4" />
    </PortraitSvg>
  );
}

function SniperPortrait({ className }: PortraitProps) {
  return (
    <PortraitSvg id="pn" bgFrom="#0a1220" bgTo="#03060c" className={className}>
      <circle cx="100" cy="118" r="86" fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.18" />
      <circle cx="100" cy="118" r="70" fill="none" stroke="#ef4444" strokeWidth="0.8" strokeDasharray="4 10" opacity="0.25">
        <animateTransform attributeName="transform" type="rotate" from="0 100 118" to="360 100 118" dur="20s" repeatCount="indefinite" />
      </circle>
      <path d="M22 260 Q30 182 64 166 L136 166 Q170 182 178 260 Z" fill="#22301f" />
      <path d="M64 166 L100 214 L136 166 L118 160 L100 180 L82 160 Z" fill="#2c3a2a" />
      <ellipse cx="100" cy="112" rx="31" ry="34" fill="#c9986f" />
      <path d="M68 96 Q100 74 132 96 L132 90 Q100 70 68 90 Z" fill="#1c2418" />
      <path d="M66 94 Q100 72 134 94 L134 102 Q100 82 66 102 Z" fill="#39482f" />
      <path d="M80 108 q8 -6 16 -1 M104 107 q8 -5 16 1" stroke="#2c1e12" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M84 114 L96 114" stroke="#1c130c" strokeWidth="3" strokeLinecap="round" />
      <path d="M104 114 L116 114" stroke="#1c130c" strokeWidth="3" strokeLinecap="round" />
      <circle cx="90" cy="114" r="1.8" fill="#d8cbb8" />
      <circle cx="110" cy="114" r="1.8" fill="#d8cbb8" />
      <path d="M88 136 Q100 141 112 136" stroke="#6d4a2c" strokeWidth="2" fill="none" strokeLinecap="round" />
      <g transform="rotate(-30 40 240)">
        <rect x="-10" y="232" width="120" height="9" rx="4" fill="#0c0f0a" />
        <rect x="-16" y="230" width="14" height="13" rx="3" fill="#151a12" />
      </g>
      <line x1="-10" y1="114" x2="210" y2="106" stroke="#ff2b2b" strokeWidth="1.4" opacity="0.75">
        <animate attributeName="opacity" values="0.8;0.25;0.8" dur="1.8s" repeatCount="indefinite" />
      </line>
      <circle cx="100" cy="110" r="3" fill="#ff2b2b" opacity="0.9">
        <animate attributeName="r" values="2.4;3.6;2.4" dur="1.8s" repeatCount="indefinite" />
      </circle>
    </PortraitSvg>
  );
}

function CitizenPortrait({ className }: PortraitProps) {
  return (
    <PortraitSvg id="pc" bgFrom="#141a2b" bgTo="#06080f" className={className}>
      <circle cx="156" cy="52" r="34" fill="#e5b567" opacity="0.1" />
      <path d="M24 260 Q32 184 66 168 L134 168 Q168 184 176 260 Z" fill="#33415c" />
      <path d="M66 168 L100 206 L134 168 L118 162 L100 180 L82 162 Z" fill="#26324a" />
      <ellipse cx="100" cy="114" rx="30" ry="33" fill="#d9ab7e" />
      <path d="M70 100 Q100 82 130 100 L130 94 Q100 78 70 94 Z" fill="#4a3b2a" />
      <path d="M64 102 Q100 84 136 102 L136 108 Q100 92 64 108 Z" fill="#5a4936" />
      <path d="M82 110 q7 -4 14 0 M104 110 q7 -4 14 0" stroke="#33241a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="89" cy="116" r="2.4" fill="#1c130c" />
      <circle cx="111" cy="116" r="2.4" fill="#1c130c" />
      <path d="M93 134 Q100 138 107 134" stroke="#7c5230" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M36 250 Q40 206 58 184" stroke="#e5b567" strokeWidth="2.5" fill="none" opacity="0.3" />
    </PortraitSvg>
  );
}

const PORTRAITS: Record<Role, (props: PortraitProps) => React.ReactElement> = {
  MAFIA_BOSS: BossPortrait,
  SILENCER: SilencerPortrait,
  MAYOR: MayorPortrait,
  GOOD_BOY: GoodBoyPortrait,
  MEDIC: MedicPortrait,
  SNIPER: SniperPortrait,
  CITIZEN: CitizenPortrait,
  // الأدوار الجديدة بتستعير رسومات العيلة/الأهالي لحد ما يوصل أرت خاص
  MAFIOSO: BossPortrait,
  FRAMER: SilencerPortrait,
  DETECTIVE: SniperPortrait,
  VIGILANTE: SniperPortrait,
  JOKER: CitizenPortrait,
};

export function RolePortrait({ role, className }: { role: Role } & PortraitProps) {
  const Component = PORTRAITS[role] ?? CitizenPortrait;
  return <Component className={className} />;
}

/**
 * High-res local artwork (`/assets/roles/*.png`) inside a strict 3:4 frame,
 * falling back to the noir SVG portrait when an asset is missing.
 */
function PortraitFrame({ role }: { role: Role }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const src = roleImage(role);
  const showArtwork = failedSrc !== src;

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-night-900">
      {showArtwork ? (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 60vw, 240px"
          className="object-cover w-full h-full rounded-lg"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <RolePortrait role={role} />
      )}
    </div>
  );
}

/* ================= Ornate corner flourish ================= */

function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={`pointer-events-none absolute h-9 w-9 text-gold-400 ${className ?? ''}`} aria-hidden>
      <path d="M4 44 V14 Q4 4 14 4 H44" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.85" />
      <path d="M9 44 V18 Q9 9 18 9 H44" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="14" cy="14" r="2.4" fill="currentColor" opacity="0.9" />
      <path d="M20 20 Q28 22 30 30" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.55" />
    </svg>
  );
}

/* ================= Team styling ================= */

const TEAM_STYLE = {
  MAFIA: {
    chip: 'border-blood-500/60 bg-blood-600/20 text-blood-300',
    accent: 'text-blood-400',
    objective: 'border-blood-500/35 bg-gradient-to-br from-blood-700/25 to-transparent',
    teamLabel: 'المافيا',
    titleClass: 'text-metallic-blood',
  },
  TOWN: {
    chip: 'border-gold-500/60 bg-gold-500/15 text-gold-300',
    accent: 'text-gold-400',
    objective: 'border-gold-500/35 bg-gradient-to-br from-gold-600/15 to-transparent',
    teamLabel: 'الأهالي',
    titleClass: 'text-metallic-gold',
  },
  NEUTRAL: {
    chip: 'border-violet-500/60 bg-violet-500/15 text-violet-300',
    accent: 'text-violet-300',
    objective: 'border-violet-500/35 bg-gradient-to-br from-violet-600/20 to-transparent',
    teamLabel: 'المحايد',
    titleClass: 'text-violet-300',
  },
} as const;

export interface RoleCardPartner {
  id: string;
  name: string;
  isAlive: boolean;
}

export function RoleCard({
  role,
  partners,
  actionLabel,
  onAction,
}: {
  role: Role;
  partners?: RoleCardPartner[];
  actionLabel?: string;
  onAction?: () => void;
}) {
  const meta = ROLE_META[role];
  const team = TEAM_STYLE[meta.team];

  return (
    <div className="relative flex h-full flex-col leather-bg p-5 sm:p-6">
      <Embers className="z-20 opacity-70" />
      <CornerOrnament className="left-1.5 top-1.5" />
      <CornerOrnament className="right-1.5 top-1.5 rotate-90" />
      <CornerOrnament className="bottom-1.5 right-1.5 rotate-180" />
      <CornerOrnament className="bottom-1.5 left-1.5 -rotate-90" />

      <div className="flex items-start justify-between gap-2 px-1">
        <span className={`rounded-full border px-3 py-0.5 text-[11px] font-black tracking-wider ${team.chip}`}>
          {team.teamLabel}
        </span>
        <span className="mt-0.5 font-mono text-[9px] tracking-[0.35em] text-slate-600 uppercase">
          secret role
        </span>
      </div>

      <h3 className="text-metallic-gold mt-2 text-center font-serif text-lg font-black tracking-[0.18em]">
        اتكشف دورك
      </h3>

      <div className="relative mx-auto mt-2 w-full max-w-[240px]">
        {/* team aura pulse — crimson for the family, gold for the town */}
        <span
          aria-hidden
          className={`absolute -inset-3 rounded-2xl blur-xl ${
            meta.team === 'MAFIA' ? 'bg-blood-600/35' : 'bg-gold-500/25'
          }`}
          style={{ animation: 'ledPulse 3s ease-in-out infinite' }}
        />
        {/* beveled gold frame, same recipe as the landing menu buttons */}
        <div
          className={`${GOLD_FRAME} relative aspect-[3/4] w-full overflow-hidden rounded-xl shadow-[inset_0_0_40px_rgba(0,0,0,0.75),0_0_30px_rgba(0,0,0,0.55)]`}
        >
          <PortraitFrame role={role} />
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/[0.09] to-transparent" />
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-14 skew-x-[-16deg] bg-white/[0.07] blur-sm"
            initial={{ left: '-25%' }}
            animate={{ left: '115%' }}
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2.5 }}
          />
          <span className="absolute bottom-1.5 right-2 font-mono text-[8px] tracking-[0.3em] text-slate-500/80 uppercase">
            noir · no.04
          </span>
        </div>
      </div>

      <p className={`mt-3 text-center font-serif text-2xl font-black leading-tight ${team.titleClass}`}>
        {team.teamLabel} &middot; {meta.label}
      </p>
      <p className="mt-1 text-center text-xs italic text-slate-400">{meta.tagline}</p>

      <div className={`mt-3 rounded-xl border p-3 ${team.objective}`}>
        <p className="flex items-start gap-2 text-[13px] leading-relaxed text-slate-200">
          <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${team.accent}`} />
          <span>
            <span className={`font-black ${team.accent}`}>مهمتك: </span>
            {meta.abilityText}
          </span>
        </p>
      </div>

      {partners && partners.length > 0 && (
        <div className="mt-2.5 px-1">
          <p className="flex items-center gap-1.5 font-mono text-[9px] font-semibold tracking-[0.3em] text-slate-500 uppercase">
            <Users className="h-3 w-3" /> أهل بيتك
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            {partners.map((partner) => (
              <li key={partner.id} className={`text-xs font-bold ${TEAM_STYLE.MAFIA.accent}`}>
                {partner.name}
                {!partner.isAlive && <span className="ml-1 text-slate-600">(ميت)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {actionLabel && onAction && (
        <div className="mt-auto flex justify-end pt-3">
          <button
            onClick={onAction}
            className="group flex transform-gpu items-center gap-2 rounded-full bg-gradient-to-r from-blood-700 via-blood-500 to-gold-500 py-2.5 pr-6 pl-5 font-black text-white shadow-[0_0_26px_rgba(220,38,38,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all duration-200 hover:scale-[1.05] hover:brightness-115 hover:shadow-[0_0_38px_rgba(239,68,68,0.7)] active:scale-[0.97]"
          >
            {actionLabel}
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          </button>
        </div>
      )}
    </div>
  );
}
