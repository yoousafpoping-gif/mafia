'use client';

import type { Role } from '@/lib/types';

interface AvatarProps {
  size?: number;
  className?: string;
}

const SKIN = '#e8b98a';

function Base({ size = 64, className, children }: AvatarProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden
      style={{ display: 'block' }}
    >
      <circle cx="32" cy="32" r="30" fill="#0d1424" stroke="#24355e" strokeWidth="2" />
      {children}
    </svg>
  );
}

function Face({ y = 26 }: { y?: number }) {
  return (
    <>
      <circle cx="32" cy={y} r="11" fill={SKIN} />
      <circle cx="28" cy={y - 1} r="1.4" fill="#1a1a2e" />
      <circle cx="36" cy={y - 1} r="1.4" fill="#1a1a2e" />
      <path d={`M ${29} ${y + 5} Q 32 ${y + 7} 35 ${y + 5}`} stroke="#8a5a34" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </>
  );
}

export function BossAvatar(props: AvatarProps) {
  return (
    <Base {...props}>
      <path d="M14 58 Q16 44 32 44 Q48 44 50 58 Z" fill="#181820" />
      <path d="M27 46 L32 52 L37 46 L35 44 L29 44 Z" fill="#2b2b38" />
      <Face />
      <rect x="18" y="12" width="28" height="9" rx="3" fill="#111118" />
      <ellipse cx="32" cy="21.5" rx="21" ry="4" fill="#1d1d28" />
      <rect x="40" y="30" width="7" height="3" rx="1.5" fill="#5b3a1e" transform="rotate(-18 40 31)" />
      <circle cx="47.5" cy="28.6" r="1.6" fill="#ff6b35">
        <animate attributeName="opacity" values="1;0.45;1" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="49" cy="24" r="2.4" fill="#9aa0a6" opacity="0.35">
        <animate attributeName="cy" values="24;17" dur="3s" repeatCount="indefinite" />
        <animate attributeName="cx" values="49;53" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0" dur="3s" repeatCount="indefinite" />
      </circle>
    </Base>
  );
}

export function SilencerAvatar(props: AvatarProps) {
  return (
    <Base {...props}>
      <circle cx="32" cy="32" r="29" fill="none" stroke="#dc2626" strokeWidth="1.5" opacity="0.55">
        <animate attributeName="r" values="27;30;27" dur="2.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.6;0.15;0.6" dur="2.2s" repeatCount="indefinite" />
      </circle>
      <path d="M14 58 Q16 44 32 44 Q48 44 50 58 Z" fill="#231318" />
      <Face />
      <rect x="20" y="30" width="24" height="10" rx="5" fill="#3a1218" stroke="#571c25" strokeWidth="1.2" />
      <line x1="26" y1="31" x2="26" y2="39" stroke="#7c2733" strokeWidth="1" />
      <line x1="32" y1="31" x2="32" y2="39" stroke="#7c2733" strokeWidth="1" />
      <line x1="38" y1="31" x2="38" y2="39" stroke="#7c2733" strokeWidth="1" />
      <rect x="19" y="19" width="26" height="4" rx="2" fill="#2b1116" />
    </Base>
  );
}

export function MayorAvatar(props: AvatarProps) {
  return (
    <Base {...props}>
      <path d="M14 58 Q16 44 32 44 Q48 44 50 58 Z" fill="#20304f" />
      <path d="M22 46 L36 58 L42 58 L28 44 Z" fill="#d4a24e" />
      <Face />
      <path d="M20 16 Q32 8 44 16 L44 20 Q32 13 20 20 Z" fill="#d4a24e" />
      <circle cx="32" cy="12" r="2.6" fill="#e5b567" />
      <g transform="translate(44 48)">
        <rect x="-4" y="-1.5" width="8" height="3" rx="1" fill="#8a5a2b" transform="rotate(-30)" />
        <rect x="-5" y="-4" width="4" height="8" rx="1" fill="#a16207" transform="rotate(-30)" />
      </g>
    </Base>
  );
}

export function GoodBoyAvatar(props: AvatarProps) {
  return (
    <Base {...props}>
      <circle cx="32" cy="32" r="28" fill="none" stroke="#34d399" strokeWidth="1.4" opacity="0.4">
        <animate attributeName="opacity" values="0.45;0.12;0.45" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <path d="M15 60 Q14 40 32 40 Q50 40 49 60 Z" fill="#2f4a3d" />
      <path d="M20 44 Q32 34 44 44 Q44 50 40 48 Q32 42 24 48 Q20 50 20 44 Z" fill="#3d6350" />
      <Face y={28} />
      <path d="M27 33 Q32 37 37 33" stroke="#8a5a34" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </Base>
  );
}

export function MedicAvatar(props: AvatarProps) {
  return (
    <Base {...props}>
      <path d="M14 58 Q16 44 32 44 Q48 44 50 58 Z" fill="#e7ecef" />
      <path d="M26 45 L32 51 L38 45 L36 43 L28 43 Z" fill="#cbd5da" />
      <Face />
      <path d="M22 44 Q22 54 30 55 M42 44 Q42 54 34 55" stroke="#2f7d6d" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="30" cy="56" r="2.4" fill="none" stroke="#2f7d6d" strokeWidth="1.6" />
      <circle cx="34" cy="56" r="2.4" fill="none" stroke="#2f7d6d" strokeWidth="1.6" />
      <g transform="translate(46 20)">
        <rect x="-6" y="-2" width="12" height="4" rx="1" fill="#10b981">
          <animate attributeName="fill" values="#10b981;#6ee7b7;#10b981" dur="1.8s" repeatCount="indefinite" />
        </rect>
        <rect x="-2" y="-6" width="4" height="12" rx="1" fill="#10b981">
          <animate attributeName="fill" values="#10b981;#6ee7b7;#10b981" dur="1.8s" repeatCount="indefinite" />
        </rect>
      </g>
    </Base>
  );
}

export function SniperAvatar(props: AvatarProps) {
  return (
    <Base {...props}>
      <path d="M14 58 Q16 44 32 44 Q48 44 50 58 Z" fill="#2c3a2a" />
      <Face />
      <path d="M19 17 Q32 10 45 17 L45 21 Q32 15 19 21 Z" fill="#3c4f38" />
      <circle cx="32" cy="26" r="17" fill="none" stroke="#ef4444" strokeWidth="1.2" opacity="0.85" />
      <line x1="32" y1="5" x2="32" y2="14" stroke="#ef4444" strokeWidth="1.2" opacity="0.85" />
      <line x1="32" y1="38" x2="32" y2="47" stroke="#ef4444" strokeWidth="1.2" opacity="0.85" />
      <line x1="11" y1="26" x2="20" y2="26" stroke="#ef4444" strokeWidth="1.2" opacity="0.85" />
      <line x1="44" y1="26" x2="53" y2="26" stroke="#ef4444" strokeWidth="1.2" opacity="0.85" />
      <circle cx="32" cy="26" r="1.6" fill="#ef4444" />
      <g transform="translate(50 50)">
        <rect x="-1.6" y="-5" width="3.2" height="10" rx="1.4" fill="#b91c1c" />
        <path d="M -1.6 -5 L 0 -8 L 1.6 -5 Z" fill="#d4a24e" />
      </g>
    </Base>
  );
}

export function CitizenAvatar(props: AvatarProps) {
  return (
    <Base {...props}>
      <path d="M14 58 Q16 44 32 44 Q48 44 50 58 Z" fill="#33415c" />
      <Face />
      <path d="M21 20 Q32 12 43 20 Q43 15 32 13 Q21 15 21 20 Z" fill="#4a3b2a" />
    </Base>
  );
}

const AVATARS: Record<Role, (props: AvatarProps) => React.ReactElement> = {
  MAFIA_BOSS: BossAvatar,
  SILENCER: SilencerAvatar,
  MAYOR: MayorAvatar,
  GOOD_BOY: GoodBoyAvatar,
  MEDIC: MedicAvatar,
  SNIPER: SniperAvatar,
  CITIZEN: CitizenAvatar,
  // الأدوار الجديدة بتستعير أفاتار قريب لحد ما يوصل تصميم خاص
  MAFIOSO: BossAvatar,
  FRAMER: SilencerAvatar,
  DETECTIVE: SniperAvatar,
  VIGILANTE: SniperAvatar,
  JOKER: CitizenAvatar,
};

export function RoleAvatar({ role, size = 64, className }: { role: Role } & AvatarProps) {
  const Component = AVATARS[role] ?? CitizenAvatar;
  return <Component size={size} className={className} />;
}

export function BotAvatar({ size = 40, className }: AvatarProps) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden style={{ display: 'block' }}>
      <circle cx="32" cy="32" r="30" fill="#101a2e" stroke="#24355e" strokeWidth="2" />
      <rect x="18" y="22" width="28" height="22" rx="7" fill="#1f2c4a" stroke="#3b5285" strokeWidth="1.5" />
      <circle cx="26" cy="32" r="3.2" fill="#e5b567">
        <animate attributeName="opacity" values="1;0.3;1" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="38" cy="32" r="3.2" fill="#e5b567">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2.4s" repeatCount="indefinite" />
      </circle>
      <line x1="32" y1="22" x2="32" y2="14" stroke="#3b5285" strokeWidth="2" />
      <circle cx="32" cy="12" r="3" fill="#ef4444">
        <animate attributeName="opacity" values="1;0.2;1" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <line x1="24" y1="39" x2="40" y2="39" stroke="#3b5285" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
