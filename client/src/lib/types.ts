export type Phase =
  | 'LOBBY'
  | 'NIGHT'
  | 'DAY_DISCUSSION'
  | 'DAY_VOTING'
  | 'DEFENSE_STAGE'
  | 'LAST_WORDS'
  | 'GAME_OVER';

export type Role =
  | 'MAFIA_BOSS'
  | 'SILENCER'
  | 'MAYOR'
  | 'GOOD_BOY'
  | 'MEDIC'
  | 'SNIPER'
  | 'CITIZEN'
  | 'MAFIOSO'
  | 'FRAMER'
  | 'DETECTIVE'
  | 'VIGILANTE'
  | 'JOKER';

export type Team = 'MAFIA' | 'TOWN' | 'NEUTRAL';
export type Ability = 'KILL' | 'SILENCE' | 'SAVE' | 'SHOOT' | 'FRAME' | 'INVESTIGATE';

export type VoiceChannel = 'LOBBY' | 'MAFIA' | 'TOWN' | 'DEAD' | 'MUTED';

export interface VoicePolicy {
  channel: VoiceChannel;
  canSpeak: boolean;
  canHear: boolean;
  audible: string[];
  phase: Phase;
  round: number;
}

export interface PublicPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isBot: boolean;
  isConnected: boolean;
  isAlive: boolean;
  isSilenced: boolean;
  micEnabled: boolean;
  hasRevealed: boolean;
  voteWeight: number;
  sid?: string | null;
}

export interface LogEvent {
  kind: 'NIGHT' | 'MAYOR' | 'VOTE' | 'EXECUTION' | 'LAST_WORDS' | 'WIN' | 'INFO';
  text: string;
  round: number;
  at: number;
}

export interface PartnerInfo {
  id: string;
  name: string;
  isAlive: boolean;
}

export interface YouState {
  id: string;
  name: string;
  isHost: boolean;
  role: Role | null;
  team: Team | null;
  isAlive: boolean;
  isSilenced: boolean;
  hasRevealed: boolean;
  bulletsLeft: number;
  ability: Ability | null;
  partners: PartnerInfo[];
  hasSubmittedNightAction: boolean;
  voteTarget: string | null;
}

export interface RoomResult {
  winner: Team;
  reason: string;
  roster: {
    id: string;
    name: string;
    role: Role;
    isAlive: boolean;
    isHost: boolean;
  }[];
}

export interface GameState {
  code: string;
  phase: Phase;
  round: number;
  deadline: number | null;
  awaitingRevenge: { source: 'NIGHT' | 'VOTE' } | null;
  lastWords?: { playerId: string } | null;
  defense?: { playerId: string } | null;
  eventLog?: LogEvent[];
  nightReport?: { victim: string | null; silenced: string | null } | null;
  elimination?: { playerId: string; name: string; role: Role } | null;
  nightResults?: { victimName: string | null; silencedName: string | null } | null;
  votesCast: number;
  votesExpected: number;
  voteLog?: { voterId: string; targetId: string }[];
  /** إجمالي الأصوات اللي اتصبت على كل لاعب طول الماتش (شاشة النصر) */
  voteTally?: Record<string, number>;
  rematchVotes?: string[];
  result: RoomResult | null;
  players: PublicPlayer[];
  you?: YouState;
}

export interface TargetOption {
  id: string;
  name: string;
}

export interface ActionRequest {
  kind: 'NIGHT_ABILITY';
  ability: Ability;
  allowsSkip: boolean;
  options: TargetOption[];
  deadline: number | null;
}

export interface RevengePrompt {
  source: 'NIGHT' | 'VOTE';
  options: TargetOption[];
  deadline: number | null;
}

export interface NightEvent {
  kind: string;
  text: string;
}

export interface DeathInfo {
  id: string;
  name: string;
  role: Role;
  causes: string[];
}

export interface NightResultPayload {
  round: number;
  events: NightEvent[];
  deaths: DeathInfo[];
}

export interface TallyRow {
  playerId: string;
  name: string;
  weightedVotes: number;
}

export interface WeightRow {
  playerId: string;
  name: string;
  weight: number;
}

export interface VoteResultPayload {
  round: number;
  tally: TallyRow[];
  weights: WeightRow[];
  tied: boolean;
  topCount: number;
  eliminated: { id: string; name: string; role: Role } | null;
}

export interface MayorRevealPayload {
  playerId: string;
  name: string;
}

export interface ChatMessage {
  from: { id: string; name: string };
  text: string;
  at: number;
}

export interface SeatRecord {
  code: string;
  playerId: string;
  token: string;
  name: string;
}

export interface JoinSuccess {
  code: string;
  playerId: string;
  token: string;
  rejoined?: boolean;
  state: GameState;
}

export interface AppError {
  code: string;
  message: string;
}
