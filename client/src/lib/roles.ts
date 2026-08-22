import {
  Crown,
  Crosshair,
  Fingerprint,
  Frame,
  HeartHandshake,
  Laugh,
  Skull,
  Syringe,
  Target,
  User,
  VenetianMask,
  VolumeX,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Ability, Role, Team } from './types';

export interface RoleMeta {
  label: string;
  team: Team;
  tagline: string;
  abilityText: string;
  nightAbility?: Ability;
  icon: LucideIcon;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  MAFIA_BOSS: {
    label: 'زعيم المافيا',
    team: 'MAFIA',
    tagline: 'إنت اللي بتفضّل مين يعيش ومين يموت',
    abilityText:
      'كل ليل بتختار ضحية تتشال من اللعبة. ظبّط نفسك مع ساكت الأهالي — لازم متسيبش الأهالي يعدّوك الصبح.',
    nightAbility: 'KILL',
    icon: VenetianMask,
  },
  SILENCER: {
    label: 'ساكت الأهالي',
    team: 'MAFIA',
    tagline: 'همستك شماتة على لسانه',
    abilityText:
      'كل ليل بتختار حد يسكت يوم كامل — مش هيقدر يتكلم، والميك هيتقفل، وصوته بيعد صفر في المحاكمة.',
    nightAbility: 'SILENCE',
    icon: VolumeX,
  },
  MAYOR: {
    label: 'العمدة',
    team: 'TOWN',
    tagline: 'صوت العمدة صوت عيد',
    abilityText:
      'مرة واحدة في اللعبة، بالنهار، تكشف إنك العمدة — وساعتك بتبقى ×3 في التصويت وتقلب المحاكمة.',
    icon: Crown,
  },
  GOOD_BOY: {
    label: 'الولد الطيب',
    team: 'TOWN',
    tagline: 'وفادته مش بتموت معاه',
    abilityText:
      'لو حد قتلك — بالليل أو بالتصويت — بتختار في نفس اللحظة حد ينزل معاك تحت التراب.',
    icon: HeartHandshake,
  },
  MEDIC: {
    label: 'الدكتور',
    team: 'TOWN',
    tagline: 'الموت مستني حد.. بس مش مستنيك',
    abilityText:
      'كل ليل بتحمي حد من المافيا — وينفع تحمي نفسك كمان. لو المافيا جات عليه، هيعيش ويصحى الصبح.',
    nightAbility: 'SAVE',
    icon: Syringe,
  },
  SNIPER: {
    label: 'القناص',
    team: 'TOWN',
    tagline: 'طلقة واحدة.. مفيش تانية',
    abilityText:
      'معاك رصاصة واحدة للعبة كلها. اطلق بالليل في أي حد — بس خلي بالك، لو ضحيتك بريء هتموت معاه.',
    nightAbility: 'SHOOT',
    icon: Crosshair,
  },
  CITIZEN: {
    label: 'مواطن عادي',
    team: 'TOWN',
    tagline: 'صوتك سلاحك الوحيد',
    abilityText:
      'مفيش عندك قدرات ليلية — بس عينك وذكاءك هما اللي هيحموا البلد. ناقش وصوّت صح وطلع المافيا قبل ما تاخد آخر نفس.',
    icon: User,
  },
  MAFIOSO: {
    label: 'المافيوزو',
    team: 'MAFIA',
    tagline: 'إيد الزعيم اليمنى.. والسلاح الأعزر',
    abilityText:
      'أنت من عيلة المافيا. بتتفق مع زملائك في الليل على اللي هيتمتصفيح، والزعيم هو اللي بينفذ. اكسر صوت الأبرياء وامشي في النور من غير شك.',
    nightAbility: 'KILL',
    icon: Target,
  },
  FRAMER: {
    label: 'المُلمِّع',
    team: 'MAFIA',
    tagline: 'بلّط البريء لحد ما يبان مذنب',
    abilityText:
      'كل ليل بتلمّع مواطن بريء بالأدلة المزيفة — المحقق لما يفحصه هيقراه مافيا! تضليل تحقيقاتهم هو درع العيلة الحقيقي.',
    nightAbility: 'FRAME',
    icon: Frame,
  },
  DETECTIVE: {
    label: 'المحقق',
    team: 'TOWN',
    tagline: 'الأدلة مش بتكدب.. أصحابها اللي بيدوّروا',
    abilityText:
      'كل ليل بتختار حد وتفحصه سرًا: هيوصلك إن كان «من المافيا» ولا «نضيف». بس خد بالك من التلميع — الشكوك قد تكون فخ.',
    nightAbility: 'INVESTIGATE',
    icon: Fingerprint,
  },
  VIGILANTE: {
    label: 'المنتقم',
    team: 'TOWN',
    tagline: 'عدالة بأيد ضلمة.. رصاصة واحدة بس',
    abilityText:
      'معاك رصاصة واحدة طوال اللعبة. لو متأكد من حد، اقتله بالليل من غير محاكمة. غلطت؟ دم البريء يفضل على إيديك للأبد.',
    nightAbility: 'SHOOT',
    icon: Zap,
  },
  JOKER: {
    label: 'الجوكر',
    team: 'NEUTRAL',
    tagline: 'بيهزر مع الكل.. وكسبته لو عدومكم حكم عليا',
    abilityText:
      'إنت مش مع مافيا ولا مع أهالي — لعبتك لوحدك: لو المجلس صوّط عليك وإعدمك، تكسب فورًا! خلّيهم يشكوا فيك من غير ما يبان إنك عايز تموت.',
    icon: Laugh,
  },
};

export const ABILITY_LABEL: Record<Ability, string> = {
  KILL: 'اختار ضحيتك',
  SILENCE: 'سكت حد الليلة',
  SAVE: 'احمي حد الليلة',
  SHOOT: 'اطلق النار',
  FRAME: 'لمّع بريء بالأدلة المزيفة',
  INVESTIGATE: 'حقّق في خلفية لاعب',
};

export function roleIcon(role: Role | null | undefined): LucideIcon {
  if (!role) return Skull;
  return ROLE_META[role]?.icon ?? User;
}

export function roleLabel(role: Role | null | undefined): string {
  if (!role) return 'مجهول';
  return ROLE_META[role]?.label ?? role;
}
