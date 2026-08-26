import { config } from '../config/index.js';
import { assert, ErrorCodes, GameError } from '../errors/GameError.js';
import { logger } from '../utils/logger.js';
import { randomToken, secureShuffle } from '../utils/random.js';
import { sanitizeChatText, sanitizeName } from '../utils/validate.js';
import { buildDeck } from './composition.js';
import {
  DEATH_CAUSES,
  LIMITS,
  NIGHT_ABILITIES,
  PHASES,
  ROLES,
  ROLE_TEAMS,
  TEAMS,
} from './constants.js';
import { resolveNightActions } from './logic/nightResolution.js';
import { resolveTally, tallyVotes, voteWeightOf } from './logic/voteResolution.js';
import { pushService } from '../push/pushService.js';

/** إيموجي الريأكشنز المسموح بيها (whitelist) — الخمسة الأولى مجانية والباقي من المتجر */
const REACTION_IDS = Object.freeze([
  'evil_laugh', 'applause', 'gasp', 'shush', 'target',
  'fire', 'skull', 'money', 'clap_gold',
]);

/** كوزمتكس اللاعب المجهّزة — بتوصل مع الانضمام وبنثق فيها زي الاسم (عرض فقط) */
function sanitizeCosmetics(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = (value) => (typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value) ? value : null);
  const cardFrame = id(raw.cardFrame);
  const title = id(raw.title);
  if (!cardFrame && !title) return null;
  return { cardFrame: cardFrame ?? 'frame-classic', title };
}

const DAY_PHASES = new Set([PHASES.DAY_DISCUSSION, PHASES.DAY_VOTING, PHASES.DEFENSE_STAGE]);
const CHAT_PHASES = new Set([
  PHASES.LOBBY,
  PHASES.DAY_DISCUSSION,
  PHASES.DAY_VOTING,
  PHASES.DEFENSE_STAGE,
  PHASES.LAST_WORDS,
  PHASES.GAME_OVER,
]);
const MAYOR_PHASES = new Set([PHASES.DAY_DISCUSSION, PHASES.DAY_VOTING, PHASES.DEFENSE_STAGE]);

/* البوت "بشري": بيفكر 3-7 ثواني قبل أي فعل أو تصويت */
const BOT_THINK_MIN_MS = 3000;
const BOT_THINK_MAX_MS = 7000;

/* ============================================================
   Smart Bot Chat — Heuristic NLP dictionary. Static, randomized,
   context-aware Egyptian Arabic replies keyed by bot name & intent
   (accusation / question / voting / greeting / default).
   Bots missing from the dictionary fall back to "بوت حسن".
   ============================================================ */
const BOT_DICTIONARY = {
  'بوت سارة': {
    accusation: [
      'أنا مش مافيا يا كداب، أنت اللي شكلك مافيا!',
      'عينك مني ليه؟ دور على المافيا الحقيقية وراجلني في حالي.',
      'لو فضلت تتهم فيا هخلي الناس كلها تصوت ضدك!',
      'أنا بكدب؟ طب والله لآخد حقي منك في التصويت.',
    ],
    question: [
      'أنا شاكة في اللي ساكت من الصبح ده.',
      'مش عارفة بس حاسة إن في حد بيسوحنا.',
      'ركزوا في كلام الناس وهتعرفوا مين بيكدب.',
    ],
    voting: [
      'أنا هصوت ضد اللي بيتكلم كتير.',
      'يا جماعة نركز عشان لو طلعنا حد بريء هنخسر.',
      'صوتوا معايا ضد اللي بيحاول يوقع بينا.',
    ],
    greeting: [
      'يلا يا جماعة ننجز عشان خايفة أموت.',
      'أهلًا، يارب نطلع المافيا النهاردة وما نتغفلش.',
      'جاهزين؟ أنا عيني في وسط راسي.',
    ],
    default: [
      'سيبوني أفكر شوية، الموضوع مش سهل.',
      'أنا حاسة إن المافيا بيضحكوا علينا دلوقتي.',
      'بلاش تشتيت يا جماعة، ركزوا.',
    ],
  },
  'بوت عم صابر': {
    accusation: [
      'يا ابني بطل رمي بلا، أنا راجل كبير وعايز أعيش في حالي.',
      'لو أنا مافيا كنت خلصت عليك أول واحد، احترم شيبتي.',
      'بتتبلى عليا ليه؟ أنا طول الليل نايم في بيتي.',
      'العب بعيد يا شاطر أنا عديت بالكلام ده زمان.',
    ],
    question: [
      'يا ابني أنا نظري ضعيف ومش مركز، شوفوا انتوا شاكين في مين.',
      'المافيا تلاقيه أكتر واحد عامل نفسه بريء وملاك.',
      'أنا شاكك في اللي عمال يوقع الناس في بعضها ده.',
    ],
    voting: [
      'صوتوا بالعدل يا ولاد عشان ربنا ما يحاسبناش.',
      'أنا هصوت زي ما الأغلبية تصوت، مش عايز وجع دماغ.',
      'يا ريت نخلص بسرعة عشان عايز أنام.',
    ],
    greeting: [
      'مساء الخير يا ولاد، ربنا يسترها علينا الليلة.',
      'أنا جاهز، بس بالراحة عليا في الكلام.',
      'يلا يا سيدي توكلنا على الله.',
    ],
    default: [
      'يا ابني أنا مش فاهم حاجة من اللي بيحصل ده.',
      'يا رب تنجينا من المافيا دي.',
      'اسكتوا شوية خلونا نعرف نفكر.',
    ],
  },
  'بوت نجوان': {
    accusation: [
      'أنا طول الليل ساكتة، بتتبلوا عليا ليه؟',
      'حرام عليكم تظلموني، أنا مواطنة غلبانة.',
      'أنتوا بتدوروا على أي كبش فدا وخلاص؟',
      'والله العظيم ما أنا، دوروا كويس.',
    ],
    question: [
      'تفتكروا مين اللي عملها بالليل؟ أنا خايفة أقول اسم يطلع غلط.',
      'أنا تايهة خالص، حد يقولي أصوت لمين؟',
      'مش يمكن يكون اللي مات ده هو اللي كان بيخطط؟',
    ],
    voting: [
      'أنا همشي ورا كلامكم في التصويت عشان خايفة.',
      'بلاش نظلم حد يا جماعة أرجوكم.',
      'لو متأكدين أنا هصوت معاكم.',
    ],
    greeting: [
      'هاي يا جماعة، أنا خايفة أوي.',
      'يارب ما حد يموت الليلة دي.',
      'يلا نبدأ، بس بالراحة عليا.',
    ],
    default: [
      'أنا قلبي مقبوض من اللعبة دي.',
      'يا رب نكسب المرة دي.',
      'حد يحميني يا جماعة بالليل أرجوكم.',
    ],
  },
  'بوت حسن': {
    accusation: [
      'يا عم أنا مالي! أنا في حالي من أول الجيم.',
      'بتلبسني تهمة ليه؟ ما تركز مع الباقيين.',
      'لو طلعتوني هتخسروا مواطن صالح، براحتكم.',
      'كلامك كله غلط في غلط، أنا بريء.',
    ],
    question: [
      'أنا بقول نراقب اللي بيحاول يوجه التصويت.',
      'محدش يثق في حد هنا، كله بيمثل.',
      'عايزين خطة عشان نصطادهم واحد واحد.',
    ],
    voting: [
      'أنا مجهز صوتي للي هيثبت عليه الدليل.',
      'التصويت ده أمانة، ركزوا قبل ما تدوسوا.',
      'هصوت للي بيعمل دوشة عالفاضي.',
    ],
    greeting: [
      'يلا بينا يا شباب، الجيم ده بتاعنا.',
      'أنا مصحصح ومحدش هيعرف يغفلني.',
      'سلام للجميع، جاهزين للضرب؟',
    ],
    default: [
      'والله اللعب معاكم متعب أعصاب.',
      'الواحد مش عارف يصدق مين ويكدب مين.',
      'شغلوا دماغكم شوية يا شباب.',
    ],
  },
};

/** Mention aliases → dictionary key ("بوت <اسم>"). */
const BOT_MENTION_ALIASES = {
  'بوت سارة': ['سارة', 'ساره'],
  'بوت عم صابر': ['صابر', 'عم صابر'],
  'بوت نجوان': ['نجوان'],
  'بوت حسن': ['حسن'],
  'بوت مصطفى': ['مصطفى', 'مصطفي'],
  'بوت سوسن': ['سوسن'],
  'بوت فرح': ['فرح'],
  'بوت حلا': ['حلا'],
  'بوت شريف': ['شريف'],
  'بوت دُدو': ['دُدو', 'دودو'],
};
const BOT_REACTION_COOLDOWN_MS = 2500;
/** Bots banter wherever general chat is socially open (not last words/night). */
const BOT_REACTION_PHASES = new Set([
  PHASES.LOBBY,
  PHASES.DAY_DISCUSSION,
  PHASES.DAY_VOTING,
]);

export class GameRoom {
  constructor(io, code, host) {
    this.io = io;
    this.code = code;
    this.phase = PHASES.LOBBY;
    this.round = 0;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
    this.phaseEndsAt = null;
    this.timer = null;
    this.players = new Map();
    this.nightActions = new Map();
    this.expectedNightActors = new Set();
    this.votes = new Map();
    this.awaitingRevenge = null;
    this.lastBotReactionAt = 0;
    this.rematchVotes = new Set();
    // إحصائية عرض فقط: إجمالي الأصوات اللي اتصبت على كل لاعب طول الماتش
    // بتتغذى من castVote وبتتصفّى مع كل لعبة جديدة — شاشة النصر بتعرضها.
    this.voteTally = new Map();
    this.botTimers = new Set();
    this.result = null;
    this.eventLog = [];
    this.lastWordsPlayerId = null;
    this.defensePlayerId = null;
    this.lastNightDeaths = [];
    this.pendingNightReport = null;

    const hostPlayer = this._createPlayer(host.name, host.socketId, sanitizeCosmetics(host.cosmetics));
    hostPlayer.isHost = true;
    this.players.set(hostPlayer.id, hostPlayer);
    this.hostId = hostPlayer.id;
  }

  addPlayer({ name, socketId, cosmetics }) {
    assert(
      this.phase === PHASES.LOBBY,
      ErrorCodes.GAME_IN_PROGRESS,
      'This match has already started. Ask the host to restart it after the game ends.',
    );
    assert(
      this.players.size < LIMITS.MAX_PLAYERS,
      ErrorCodes.ROOM_FULL,
      `Room is full (max ${LIMITS.MAX_PLAYERS} players)`,
    );

    const cleanName = sanitizeName(name);
    const nameTaken = [...this.players.values()].some(
      (player) => player.isConnected && player.name.toLowerCase() === cleanName.toLowerCase(),
    );
    assert(!nameTaken, ErrorCodes.NAME_TAKEN, `"${cleanName}" is already seated in this room`);

    const player = this._createPlayer(cleanName, socketId, sanitizeCosmetics(cosmetics));
    // لو الأوضة فضلت من غير هوست (الكل اتقطع ورجع) — أول داخل جديد ياخد الأوضة
    if (![...this.players.values()].some((p) => p.isHost)) {
      player.isHost = true;
      this.hostId = player.id;
    }
    this.players.set(player.id, player);
    this.touch();
    this.broadcastUpdate();
    return player;
  }

  reattach({ token, socketId, cosmetics }) {
    assert(
      typeof token === 'string' && token.length > 0,
      ErrorCodes.VALIDATION_ERROR,
      'A valid rejoin token is required',
    );
    const player = [...this.players.values()].find((candidate) => candidate.token === token);
    assert(player, ErrorCodes.VALIDATION_ERROR, 'No seat in this room matches that rejoin token');

    player.socketId = socketId;
    player.isConnected = true;
    // الكوزمتكس بتنعش عند الرجوع — اللاعب ممكن يكون جهّز حاجة جديدة
    const freshCosmetics = sanitizeCosmetics(cosmetics);
    if (freshCosmetics) player.cosmetics = freshCosmetics;
    const hostAlive = [...this.players.values()].some((p) => p.isHost);
    if (!hostAlive) {
      // رجوع لأوضة فضلت من غير هوست — الراجع بياخدها
      player.isHost = true;
    }
    this.hostId = [...this.players.values()].find((p) => p.isHost)?.id ?? player.id;
    this.touch();
    this.broadcastUpdate();

    if (
      this.phase === PHASES.NIGHT &&
      !this.awaitingRevenge &&
      this.expectedNightActors.has(player.id) &&
      !this.nightActions.has(player.id)
    ) {
      this._sendNightPrompt(player);
    }
    if (this.awaitingRevenge?.playerId === player.id) {
      this._sendRevengePrompt(player);
    }
    return player;
  }

  handleDisconnect(socketId) {
    const player = [...this.players.values()].find((p) => p.socketId === socketId);
    if (!player) return false;

    player.socketId = null;
    player.isConnected = false;

    if (this.phase === PHASES.LOBBY) {
      this.players.delete(player.id);
      if (player.id === this.hostId) {
        const successor = [...this.players.values()].find((p) => p.isConnected);
        if (successor) {
          successor.isHost = true;
          this.hostId = successor.id;
          logger.info(`Host migrated to ${successor.name} in room ${this.code}`);
        }
      }
    } else {
      this.rematchVotes.delete(player.id);

      if (player.id === this.hostId && this.phase === PHASES.GAME_OVER) {
        const successor = [...this.players.values()].find((p) => p.isConnected);
        if (successor) {
          successor.isHost = true;
          this.hostId = successor.id;
          logger.info(`Host migrated to ${successor.name} in room ${this.code}`);
        }
      }

      if (this.phase === PHASES.GAME_OVER && !this.awaitingRevenge) {
        const connected = [...this.players.values()].filter((p) => p.isConnected);
        const unanimous =
          connected.length >= LIMITS.MIN_PLAYERS &&
          connected.every((p) => this.rematchVotes.has(p.id));
        if (unanimous) {
          logger.info(`Room ${this.code}: rematch triggered after departure`);
          this._beginRematch();
          return true;
        }
      }
    }

    this.touch();
    this.broadcastUpdate();
    return true;
  }

  /**
   * زرار "إعادة اللعب" من شاشة النصر — بيعمل reset كامل من غير ما حد
   * يتقطع عنه الاتصال. في جلسات البوتات (أو اللاعب الوحيد المتصل) الهوست
   * بيعيد على طول؛ في الجلسات الأونلاين بيتحول لصوت ريفانش — اللعبة بترجع
   * لما كل المتصلين يوافقوا.
   */
  requestPlayAgain(playerId) {
    assert(
      this.phase === PHASES.GAME_OVER,
      ErrorCodes.PHASE_INVALID,
      'إعادة اللعب متاحة بعد ما اللعبة تخلص بس',
    );
    const requester = this._requirePlayer(playerId);
    const connectedHumans = [...this.players.values()].filter(
      (p) => p.isConnected && !p.isBot,
    );

    if (requester.isHost && connectedHumans.length <= 1) {
      logger.info(`Room ${this.code}: play-again instant restart by host`);
      this._beginRematch();
      return { restarted: true };
    }

    const vote = this.voteRematch(playerId, true);
    return { restarted: false, ready: vote?.ready ?? true };
  }

  startGame(requesterId) {
    const requester = this._requirePlayer(requesterId);
    assert(requester.isHost, ErrorCodes.HOST_ONLY, 'Only the host can start the game');

    if (this.phase === PHASES.GAME_OVER) this._resetForRematch();
    this._launchMatch();
  }

  addBot(requesterId, count = 1) {
    const requester = this._requirePlayer(requesterId);
    assert(requester.isHost, ErrorCodes.HOST_ONLY, 'لصاحب الأوضة بس إضافة بوتات');
    assert(
      this.phase === PHASES.LOBBY,
      ErrorCodes.GAME_IN_PROGRESS,
      'البوتات بتتجاب قبل ما اللعبة تبدأ بس',
    );

    const requested = Math.max(1, Math.min(LIMITS.MAX_PLAYERS, Number(count) || 1));
    for (let i = 0; i < requested; i += 1) {
      assert(
        this.players.size < LIMITS.MAX_PLAYERS,
        ErrorCodes.ROOM_FULL,
        `الأوضة اتملت (${LIMITS.MAX_PLAYERS} لاعب)`,
      );
      const bot = this._createPlayer(this._nextBotName(), null);
      bot.isBot = true;
      this.players.set(bot.id, bot);
      logger.info(`Room ${this.code}: bot joined as ${bot.name}`);
    }

    this.touch();
    this.broadcastUpdate();
  }

  _nextBotName() {
    const pool = ['حسن', 'نجوان', 'مصطفى', 'سارة', 'عم صابر', 'سوسن', 'فرح', 'حلا', 'شريف', 'دُدو'];
    const taken = new Set(
      [...this.players.values()].map((player) => player.name.toLowerCase()),
    );
    for (const candidate of pool) {
      const full = `بوت ${candidate}`;
      if (!taken.has(full.toLowerCase())) return full;
    }
    let suffix = this.players.size + 1;
    while (taken.has(`بوت ${suffix}`)) suffix += 1;
    return `بوت ${suffix}`;
  }

  voteRematch(playerId, ready = true) {    assert(
      this.phase === PHASES.GAME_OVER,
      ErrorCodes.PHASE_INVALID,
      'Rematch votes are only accepted after the game ends',
    );
    const player = this._requirePlayer(playerId);

    if (!ready) {
      this.rematchVotes.delete(player.id);
      this.touch();
      this.broadcastUpdate();
      return { ready: false };
    }

    this.rematchVotes.add(player.id);
    this.touch();

    const connected = [...this.players.values()].filter((p) => p.isConnected);
    const unanimous =
      connected.length >= LIMITS.MIN_PLAYERS &&
      connected.every((p) => this.rematchVotes.has(p.id));
    if (unanimous) {
      logger.info(`Room ${this.code}: unanimous rematch vote, restarting`);
      this._beginRematch();
      return { started: true };
    }

    this.broadcastUpdate();
    return { ready: true };
  }

  submitNightAction(playerId, targetId) {
    assert(
      targetId === null || typeof targetId === 'string',
      ErrorCodes.VALIDATION_ERROR,
      'targetId must be a player id or null to skip',
    );
    assert(this.phase === PHASES.NIGHT, ErrorCodes.PHASE_INVALID, 'Night actions are only accepted at night');
    assert(
      !this.awaitingRevenge,
      ErrorCodes.PHASE_INVALID,
      'The town is waiting on a dying Good Boy',
    );

    const player = this._requirePlayer(playerId);
    assert(player.isAlive, ErrorCodes.PLAYER_DEAD, 'Dead players cannot use abilities');

    const ability = NIGHT_ABILITIES[player.role];
    assert(ability, ErrorCodes.ROLE_MISMATCH, `${player.role ?? 'Your role'} has no night ability`);

    if (!this.expectedNightActors.has(player.id)) {
      if (player.role === ROLES.SNIPER) {
        throw new GameError(ErrorCodes.NO_BULLETS_LEFT, 'Your only bullet has already been spent');
      }
      throw new GameError(ErrorCodes.ACTION_NOT_ALLOWED, 'You are not expected to act tonight');
    }
    assert(
      !this.nightActions.has(player.id),
      ErrorCodes.ALREADY_SUBMITTED,
      'Tonight\u2019s action has already been sealed',
    );

    if (targetId !== null) {
      const target = this._requirePlayer(targetId);
      assert(
        this._isValidTargetFor(player, target),
        ErrorCodes.TARGET_INVALID,
        'That target is not valid for your ability',
      );
    }

    this.nightActions.set(player.id, { ability, targetId });
    this.touch();
    this._emitToPlayer(player, 'action:accepted', { kind: 'NIGHT_ABILITY', ability, targetId });

    if ([...this.expectedNightActors].every((id) => this.nightActions.has(id))) {
      this._resolveNight();
    }
  }

  submitRevenge(playerId, targetId) {
    const revenge = this.awaitingRevenge;
    assert(revenge, ErrorCodes.ACTION_NOT_ALLOWED, 'There is no revenge decision pending');
    assert(
      revenge.playerId === playerId,
      ErrorCodes.ACTION_NOT_ALLOWED,
      'Only the fallen Good Boy may answer this prompt',
    );
    assert(
      targetId === null || typeof targetId === 'string',
      ErrorCodes.VALIDATION_ERROR,
      'targetId must be a player id or null to spare them',
    );

    const { onDone, extraDeaths } = revenge;

    if (targetId !== null) {
      const target = this._requirePlayer(targetId);
      assert(target.isAlive, ErrorCodes.TARGET_INVALID, 'That player is already dead');
      assert(
        !revenge.excluded.has(targetId),
        ErrorCodes.TARGET_INVALID,
        'That player is already dying tonight',
      );
      extraDeaths.push({ id: targetId, cause: DEATH_CAUSES.GOOD_BOY_REVENGE });
    }

    this.awaitingRevenge = null;
    this._clearTimer();
    this._emitToPlayer(this.players.get(playerId), 'action:accepted', {
      kind: 'GOOD_BOY_REVENGE',
      targetId,
    });
    this.touch();
    onDone(extraDeaths);
  }

  revealMayor(playerId) {
    const player = this._requirePlayer(playerId);
    assert(
      MAYOR_PHASES.has(this.phase),
      ErrorCodes.PHASE_INVALID,
      'The Mayor can only reveal during the day',
    );
    assert(player.isAlive, ErrorCodes.PLAYER_DEAD, 'Fallen mayors cannot address the town');
    assert(player.role === ROLES.MAYOR, ErrorCodes.ROLE_MISMATCH, 'Only the Mayor can do that');
    assert(
      !player.hasRevealed,
      ErrorCodes.MAYOR_ALREADY_REVEALED,
      'You have already revealed yourself',
    );

    player.hasRevealed = true;
    this.touch();
    this._logEvent(`العمدة ${player.name} كشف نفسه — صوته بقى Ã—3`, 'MAYOR');
    this.io.to(this.code).emit('game:mayor_revealed', { playerId: player.id, name: player.name });
    this.broadcastUpdate();
    logger.info(`Room ${this.code}: Mayor ${player.name} revealed (vote weight x3)`);
  }

  castVote(voterId, targetId) {
    assert(typeof targetId === 'string', ErrorCodes.VALIDATION_ERROR, 'A vote requires a targetId');
    assert(
      this.phase === PHASES.DAY_VOTING || this.phase === PHASES.DEFENSE_STAGE,
      ErrorCodes.PHASE_INVALID,
      'Voting is not open right now',
    );
    assert(!this.awaitingRevenge, ErrorCodes.PHASE_INVALID, 'The vote is paused by a dying curse');

    const voter = this._requirePlayer(voterId);
    assert(voter.isAlive, ErrorCodes.PLAYER_DEAD, 'Dead players cannot vote');
    // During the DEFENSE_STAGE votes may be shifted or confirmed freely;
    // during DAY_VOTING they lock on first cast.
    const voteShift = this.phase === PHASES.DEFENSE_STAGE && this.votes.has(voterId);
    if (!voteShift) {
      assert(!this.votes.has(voterId), ErrorCodes.ALREADY_VOTED, 'Your vote is already locked in');
    }

    const target = this._requirePlayer(targetId);
    assert(target.isAlive, ErrorCodes.TARGET_INVALID, 'You cannot vote for a dead player');
    assert(
      target.id !== voter.id,
      ErrorCodes.SELF_TARGET_FORBIDDEN,
      'Voting for yourself is forbidden',
    );

    this.votes.set(voterId, targetId);
    this.voteTally.set(targetId, (this.voteTally.get(targetId) ?? 0) + 1);
    this.touch();
    // Live tally broadcast — this is what makes DEFENSE_STAGE shifts visible.
    this.broadcastUpdate();
    this._emitToPlayer(voter, 'action:accepted', {
      kind: 'VOTE',
      targetId,
      weight: voteWeightOf(voter),
    });

    const expected = this._alivePlayers().length;
    this.io.to(this.code).emit('vote:progress', { cast: this.votes.size, expected });
    if (this.votes.size >= expected) this._resolveVotes();
  }

  /**
   * ريأكشن إيموجي — بث فوري لكل الأوضة فوق كارت المُرسل.
   * مسموح في أي مرحلة ولو اللاعب ميت — دي بهجة مش معلومات لعب.
   */
  sendReaction(senderId, emojiId) {
    const sender = this._requirePlayer(senderId);
    assert(
      typeof emojiId === 'string' && REACTION_IDS.includes(emojiId),
      ErrorCodes.VALIDATION_ERROR,
      'Unknown reaction',
    );
    this.io.to(this.code).emit('reaction:show', {
      playerId: sender.id,
      emojiId,
    });
  }

  postChat(senderId, rawText) {
    const text = sanitizeChatText(rawText, config.chat.maxLength);
    const sender = this._requirePlayer(senderId);
    const nightFamilyChannel =
      this.phase === PHASES.NIGHT && sender.isAlive && sender.team === TEAMS.MAFIA;
    assert(
      CHAT_PHASES.has(this.phase) || nightFamilyChannel,
      ErrorCodes.PHASE_INVALID,
      'Chat is closed right now',
    );
    if (this.phase !== PHASES.GAME_OVER && this.phase !== PHASES.LOBBY && !nightFamilyChannel) {
      assert(sender.isAlive, ErrorCodes.PLAYER_DEAD, 'Ghosts cannot speak to the living');
    }
    assert(
      !sender.isSilenced || this.phase === PHASES.GAME_OVER,
      ErrorCodes.CHAT_BLOCKED,
      'You have been silenced for the day',
    );

    const message = {
      from: { id: sender.id, name: sender.name, cosmetics: sender.cosmetics ?? null },
      text,
      at: Date.now(),
    };

    if (nightFamilyChannel) {
      // Secret family line — living mafia ears only.
      const familySockets = [...this.players.values()]
        .filter((p) => p.isAlive && p.team === TEAMS.MAFIA && p.socketId && p.id !== sender.id)
        .map((p) => p.socketId);
      if (familySockets.length > 0) this.io.to(familySockets).emit('chat:message', message);
    } else {
      this.io.to(this.code).emit('chat:message', message);
    }

    // Smart bot banter — only REAL humans trigger reactions.
    if (!sender.isBot && !nightFamilyChannel) this._handleBotReaction(text);
    return { sent: true };
  }

  syncFor(playerId) {
    return this.privateState(playerId);
  }

  isEmpty() {
    return ![...this.players.values()].some((player) => player.isConnected);
  }

  touch() {
    this.lastActivityAt = Date.now();
  }

  _logEvent(text, kind = 'INFO') {
    this.eventLog.push({ kind, text, round: this.round, at: Date.now() });
    if (this.eventLog.length > 60) this.eventLog.splice(0, this.eventLog.length - 60);
  }

  dispose() {
    this._clearBotTimers();
    this._clearTimer();
  }

  publicState() {
    return {
      code: this.code,
      phase: this.phase,
      round: this.round,
      deadline: this.phaseEndsAt,
      awaitingRevenge: this.awaitingRevenge ? { source: this.awaitingRevenge.source } : null,
      lastWords:
        this.phase === PHASES.LAST_WORDS && this.lastWordsPlayerId
          ? { playerId: this.lastWordsPlayerId }
          : null,
      defense:
        this.phase === PHASES.DEFENSE_STAGE && this.defensePlayerId
          ? { playerId: this.defensePlayerId }
          : null,
      eventLog: this.eventLog.slice(-40),
      // Morning newspaper rides INSIDE the game state so any sync/rejoin
      // during the day still carries it.
      nightReport: this.pendingNightReport ?? { victim: null, silenced: null },
        votesCast: this.votes.size,
        votesExpected: this._alivePlayers().length,
        voteLog: DAY_PHASES.has(this.phase)
          ? [...this.votes.entries()].map(([voterId, targetId]) => ({ voterId, targetId }))
          : [],
        voteTally: Object.fromEntries(this.voteTally),
        rematchVotes: [...this.rematchVotes],
        result: this.result,
      players: [...this.players.values()].map((player) => ({
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        isBot: Boolean(player.isBot),
        isConnected: player.isConnected,
        isAlive: player.isAlive,
        isSilenced: player.isSilenced,
        micEnabled: this._micEnabled(player),
        hasRevealed: player.hasRevealed,
        voteWeight: voteWeightOf(player),
        sid: player.socketId ?? null,
        cosmetics: player.cosmetics ?? null,
      })),
    };
  }

  privateState(playerId) {
    const player = this._requirePlayer(playerId);
    const base = this.publicState();
    return {
      ...base,
      you: {
        id: player.id,
        name: player.name,
        isHost: player.isHost,
        cosmetics: player.cosmetics ?? null,
        role: player.role,
        team: player.team,
        isAlive: player.isAlive,
        isSilenced: player.isSilenced,
        hasRevealed: player.hasRevealed,
        bulletsLeft: player.bulletsLeft,
        ability: NIGHT_ABILITIES[player.role] ?? null,
        partners: this._partnersOf(player),
        hasSubmittedNightAction: this.nightActions.has(player.id),
        voteTarget: this.votes.get(player.id) ?? null,
      },
    };
  }

  broadcastUpdate() {
    this.io.to(this.code).emit('room:update', this.publicState());
    this._broadcastVoicePolicies();
  }

  _broadcastVoicePolicies() {
    for (const player of this.players.values()) {
      if (!player.isConnected) continue;
      this._emitToPlayer(player, 'voice:policy', this._buildVoicePolicy(player));
    }
  }

  _buildVoicePolicy(player) {
    const connected = [...this.players.values()].filter(
      (candidate) => candidate.isConnected && candidate.socketId,
    );
    const dayPhase = DAY_PHASES.has(this.phase);
    const socialPhase = this.phase === PHASES.LOBBY || this.phase === PHASES.GAME_OVER;
    const nightPhase = this.phase === PHASES.NIGHT;
    const lastWordsPhase = this.phase === PHASES.LAST_WORDS;
    const defensePhase = this.phase === PHASES.DEFENSE_STAGE;

    let channel = 'MUTED';
    if (socialPhase) channel = 'LOBBY';
    else if (nightPhase && player.isAlive && player.team === TEAMS.MAFIA) channel = 'MAFIA';
    else if ((lastWordsPhase || defensePhase) && player.isAlive) channel = 'TOWN';
    else if (!player.isAlive) channel = 'DEAD';
    else if (dayPhase) channel = 'TOWN';

    let canSpeak = false;
    let canHear = false;
    let audible = [];

    const socketsOf = (filter) =>
      connected.filter(filter).map((peer) => peer.socketId);

    if (channel === 'LOBBY') {
      canSpeak = true;
      canHear = true;
      audible = socketsOf((peer) => peer.id !== player.id);
    } else if (channel === 'MAFIA') {
      // Strictly the two-family line: MAFIA_BOSS <-> SILENCER, everyone else muted.
      canSpeak = true;
      canHear = true;
      audible = socketsOf((peer) => peer.team === TEAMS.MAFIA && peer.id !== player.id);
    } else if (channel === 'TOWN' && (lastWordsPhase || defensePhase)) {
      // Trial speech: only the accused (defending or last words) is audible town-wide.
      const speakerId = lastWordsPhase ? this.lastWordsPlayerId : this.defensePlayerId;
      canHear = true;
      if (player.id === speakerId) {
        canSpeak = true;
        audible = socketsOf((peer) => peer.id !== player.id);
      } else {
        canSpeak = false;
        const accused = connected.find((peer) => peer.id === speakerId);
        audible = accused?.socketId ? [accused.socketId] : [];
      }
    } else if (channel === 'TOWN') {
      canHear = true;
      canSpeak = !player.isSilenced;
      audible = socketsOf((peer) => peer.isAlive && !peer.isSilenced && peer.id !== player.id);
    } else if (channel === 'DEAD') {
      canSpeak = false;
      canHear = dayPhase;
      if (dayPhase) audible = socketsOf((peer) => peer.isAlive && !peer.isSilenced);
    }

    return { channel, canSpeak, canHear, audible, phase: this.phase, round: this.round };
  }

  _createPlayer(name, socketId, cosmetics = null) {
    return {
      id: randomToken(),
      token: randomToken(),
      socketId,
      name,
      isHost: false,
      isConnected: true,
      cosmetics,
      role: null,
      team: null,
      isAlive: true,
      isSilenced: false,
      hasRevealed: false,
      bulletsLeft: 0,
      deathCause: null,
      deathRound: 0,
    };
  }

  _assignRole(player, role) {
    player.role = role;
    player.team = ROLE_TEAMS[role];
    player.bulletsLeft = role === ROLES.SNIPER || role === ROLES.VIGILANTE ? 1 : 0;
  }

  /**
   * Dynamic, scalable distribution: pool is derived from players.length,
   * shuffled, then dealt. Each client gets its role privately and mafia
   * members additionally receive their full teammates list.
   */
  assignRoles(players) {
    const deck = buildDeck(players.length);
    players.forEach((player, index) => this._assignRole(player, deck[index]));

    const mafiaTeammates = players
      .filter((p) => p.team === TEAMS.MAFIA)
      .map((p) => ({ id: p.id, name: p.name }));

    for (const player of players) {
      this._emitToPlayer(player, 'game:role_assigned', {
        roleName: player.role,
        team: player.team,
        abilities: NIGHT_ABILITIES[player.role] ?? null,
      });
      if (player.team === TEAMS.MAFIA && mafiaTeammates.length > 0) {
        this._emitToPlayer(player, 'game:mafia_team_revealed', { teammates: mafiaTeammates });
      }
    }
  }

  _launchMatch() {
    assert(this.phase === PHASES.LOBBY, ErrorCodes.GAME_IN_PROGRESS, 'The game is already running');
    assert(
      this.players.size >= LIMITS.MIN_PLAYERS,
      ErrorCodes.NOT_ENOUGH_PLAYERS,
      `At least ${LIMITS.MIN_PLAYERS} players are needed to start`,
    );
    assert(
      this.players.size <= LIMITS.MAX_PLAYERS,
      ErrorCodes.TOO_MANY_PLAYERS,
      `A game supports at most ${LIMITS.MAX_PLAYERS} players`,
    );

    const deck = buildDeck(this.players.size);
    const seats = [...this.players.values()];
    // Dynamic matrix deal + private role/teammates events.
    this.assignRoles(seats);

    logger.info(`Room ${this.code}: game started with ${seats.length} players`);
    for (const player of seats) {
      this._emitToPlayer(player, 'game:started', this.privateState(player.id));
    }
    // Web Push لبداية اللعبة — دورك نزل
    pushService.notifyRoom(this, {
      title: 'حارة المافيا — اللعبة بدأت!',
      body: `الأدوار اتوزعت في الأوضة ${this.code} · افتح دورك بسرعة`,
      url: `/game/${this.code}`,
    });
    this._advanceToNight();
  }

  _beginRematch() {
    this._resetForRematch(true);
    this._launchMatch();
  }

  _resetForRematch(silent = false) {
    for (const player of this.players.values()) {
      player.role = null;
      player.team = null;
      player.isAlive = true;
      player.isSilenced = false;
      player.hasRevealed = false;
      player.bulletsLeft = 0;
      player.deathCause = null;
      player.deathRound = 0;
    }
    this.round = 0;
    this.result = null;
    this.eventLog = [];
    this.lastWordsPlayerId = null;
    this.defensePlayerId = null;
    this.lastNightDeaths = [];
    this.pendingNightReport = null;
    this.nightActions.clear();
    this.votes.clear();
    this.voteTally.clear();
    this.rematchVotes.clear();
    this.awaitingRevenge = null;
    this._clearBotTimers();
    this._clearTimer();
    this.phase = PHASES.LOBBY;
    if (!silent) this.broadcastUpdate();
  }

  _bots() {
    return [...this.players.values()].filter((player) => player.isBot);
  }

  _scheduleBot(fn, minMs, maxMs) {
    const delay = minMs + Math.floor(Math.random() * Math.max(1, maxMs - minMs));
    const timer = setTimeout(() => {
      this.botTimers.delete(timer);
      try {
        fn();
      } catch {
        /* stale bot tick */
      }
    }, delay);
    this.botTimers.add(timer);
  }

  _clearBotTimers() {
    for (const timer of this.botTimers) clearTimeout(timer);
    this.botTimers.clear();
  }

  /** بث حالة "البوت بيفكر" — الواجهة بتعرض مؤشر تفكير جنب اسمه لحد ما يتصرف */
  _notifyBotThinking(playerId, kind) {
    this.io.to(this.code).emit('bot:thinking', { playerId, kind, at: Date.now() });
  }

  _scheduleNightBots() {
    for (const bot of this._bots()) {
      if (!this.expectedNightActors.has(bot.id)) continue;
      this._notifyBotThinking(bot.id, 'night');
      this._scheduleBot(
        () => {
          if (this.phase !== PHASES.NIGHT || this.awaitingRevenge) return;
          const current = this.players.get(bot.id);
          if (!current || !current.isAlive || this.nightActions.has(current.id)) return;
          const options = this._alivePlayers().filter((target) =>
            this._isValidTargetFor(current, target),
          );
          const holdFire = current.role === ROLES.SNIPER && Math.random() < 0.35;
          const targetId = options.length && !holdFire
            ? options[Math.floor(Math.random() * options.length)].id
            : null;
          this.submitNightAction(current.id, targetId);
        },
        BOT_THINK_MIN_MS,
        BOT_THINK_MAX_MS,
      );
    }
  }

  _scheduleVoteBots() {
    for (const bot of this._bots()) {
      if (!bot.isAlive) continue;
      this._notifyBotThinking(bot.id, 'vote');
      this._scheduleBot(
        () => {
          if (this.phase !== PHASES.DAY_VOTING || this.awaitingRevenge) return;
          const current = this.players.get(bot.id);
          if (!current || !current.isAlive || this.votes.has(current.id)) return;
          const candidates = this._alivePlayers().filter((p) => p.id !== current.id);
          if (!candidates.length) return;
          this.castVote(current.id, candidates[Math.floor(Math.random() * candidates.length)].id);
        },
        BOT_THINK_MIN_MS,
        BOT_THINK_MAX_MS,
      );
    }
  }

  /**
   * Heuristic NLP reaction: detect the message intent with regex chains
   * (accusation → question → voting → greeting → default), force-select a
   * bot when the player mentions one by name, otherwise answer with a
   * random ALIVE bot. Reply is picked from BOT_DICTIONARY and sent after a
   * 2000–4500ms "typing" delay. Day discussion only, cooldown-gated.
   */
  _handleBotReaction(text) {
    if (!BOT_REACTION_PHASES.has(this.phase)) return;
    if (this.lastBotReactionAt && Date.now() - this.lastBotReactionAt < BOT_REACTION_COOLDOWN_MS) {
      return;
    }

    const aliveBots = this._bots().filter((bot) => bot.isAlive && !bot.isSilenced);
    if (!aliveBots.length) return;

    // ١. تحديد النية (Intent) بسلاسل regex بالترتيب
    const msg = text.toLowerCase();
    let intent = 'default';
    if (/(مافيا|كداب|تكدب|قاتل|قتلت|خاين|انت|انتي|ظالم)/.test(msg)) intent = 'accusation';
    else if (/(مين|شاكين|تفتكروا|رأيكم|نعمل|ازاي|ليه)/.test(msg)) intent = 'question';
    else if (/(صوت|نصوت|فوت|نطلع|اعدام|نقتل)/.test(msg)) intent = 'voting';
    else if (/(سلام|هاي|شباب|يلا|جاهزين|مساء)/.test(msg)) intent = 'greeting';

    // ٢. لو اللاعب نادى ببوت بالاسم → البوت ده هو اللي بيرد، غير كده عشوائي
    let speaker = null;
    for (const [dictKey, aliases] of Object.entries(BOT_MENTION_ALIASES)) {
      if (aliases.some((alias) => msg.includes(alias))) {
        const named = aliveBots.find((bot) => bot.name === dictKey);
        if (named) {
          speaker = named;
          break;
        }
      }
    }
    if (!speaker) speaker = aliveBots[Math.floor(Math.random() * aliveBots.length)];

    // ٣. الرد من قاموس البوت (أو فالباك "بوت حسن") حسب النية
    const botData = BOT_DICTIONARY[speaker.name] || BOT_DICTIONARY['بوت حسن'];
    const responses = botData[intent] || botData.default;
    const reply = responses[Math.floor(Math.random() * responses.length)];
    this.lastBotReactionAt = Date.now();
    logger.info(
      `Room ${this.code}: bot ${speaker.name} reacting (intent=${intent}) to "${text.slice(0, 40)}"`,
    );

    // Typing simulation — 2000ms..4500ms before the reply lands.
    this._notifyBotThinking(speaker.id, 'chat');
    this._scheduleBot(() => {
      if (!BOT_REACTION_PHASES.has(this.phase)) return;
      const current = this.players.get(speaker.id);
      if (!current || !current.isAlive || current.isSilenced) return;
      this.io.to(this.code).emit('chat:message', {
        from: { id: current.id, name: current.name },
        text: reply,
        at: Date.now(),
      });
    }, 2000, 4500);
  }

  _scheduleBotChat() {
    const aliveBots = this._bots().filter((bot) => bot.isAlive);
    if (!aliveBots.length) return;

    const lines = this._botChatLines();
    const speakers = [...aliveBots].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.6 ? 1 : 2);

    speakers.forEach((bot, index) => {
      this._notifyBotThinking(bot.id, 'chat');
      this._scheduleBot(
        () => {
          if (this.phase !== PHASES.DAY_DISCUSSION) return;
          const current = this.players.get(bot.id);
          if (!current || !current.isAlive || current.isSilenced) return;
          const line = lines[Math.floor(Math.random() * lines.length)];
          if (!line) return;
          this.io.to(this.code).emit('chat:message', {
            from: { id: current.id, name: current.name },
            text: line,
            at: Date.now(),
          });
        },
        1400 + index * 2800,
        3000 + index * 3000,
      );
    });
  }

  _botChatLines() {
    const lines = [];
    const fallen = (this.lastNightDeaths ?? []).filter(Boolean);
    const mayor = [...this.players.values()].find((player) => player.hasRevealed && player.isAlive);

    if (fallen.length > 1) {
      lines.push(
        `اتنين راحوا في ليلة واحدة؟! ${fallen.map((d) => d.name).join(' و ')}.. المافيا جعانة الليلة`,
        `شهداء كتير: ${fallen.map((d) => d.name).join('، ')} — لازم نستهدف صح النهارده`,
      );
    } else if (fallen.length === 1) {
      lines.push(
        `يا حرام ${fallen[0].name}.. كان لسه عايشن معانا`,
        `الليل شال ${fallen[0].name}.. خدوا بالكوا من نفسكوا`,
        `سلام ${fallen[0].name}.. اللي عمل كده هيتكشف قريب`,
      );
    } else {
      lines.push(
        'الليلة عدت من غير ضحايا.. المافيا بتريق علينا',
        'مفيش موتى الليلة دي؟ يبقى الحماية شغالة.. أو حد بيستعرض',
      );
    }

    if (mayor) {
      lines.push(`العمدة ${mayor.name} اتكشف — صوته بقى Ã—3، اسمعوا كلامه`);
    }

    lines.push(
      'في حد بينا بيكذب علينا كل يوم.. مين؟',
      'يلا نركز: مين كان ساكت طول الليل؟',
      'أنا مشبوهيني من حد قاعد قدامي.. بس هسيبكم تحكموا',
    );

    return lines;
  }

  _advanceToNight(elimination = null) {
    this.round += 1;
    this.phase = PHASES.NIGHT;
    this.votes.clear();
    this.nightActions.clear();
    this.awaitingRevenge = null;
    // Yesterday's news is old news — wipe before the next night begins.
    this.pendingNightReport = null;
    for (const player of this.players.values()) player.isSilenced = false;

    this.expectedNightActors = new Set(
      [...this.players.values()].filter((player) => this._canActAtNight(player)).map((p) => p.id),
    );

    this._armTimer(config.timers.NIGHT_MS, () => this._resolveNight());
    // Cinematic execution scene rides with the night transition when the
    // council just voted someone out.
    this.broadcastPhase({ elimination });
    this.broadcastUpdate();
    for (const id of this.expectedNightActors) {
      this._sendNightPrompt(this.players.get(id));
    }
    this._scheduleNightBots();
  }

  _canActAtNight(player) {
    if (!player.isAlive) return false;
    if (!NIGHT_ABILITIES[player.role]) return false;
    if (
      (player.role === ROLES.SNIPER || player.role === ROLES.VIGILANTE) &&
      player.bulletsLeft <= 0
    ) {
      return false;
    }
    return true;
  }

  _sendNightPrompt(player) {
    const options = this._alivePlayers()
      .filter((target) => this._isValidTargetFor(player, target))
      .map((target) => ({ id: target.id, name: target.name }));

    this._emitToPlayer(player, 'action:request', {
      kind: 'NIGHT_ABILITY',
      ability: NIGHT_ABILITIES[player.role],
      allowsSkip: true,
      options,
      deadline: this.phaseEndsAt,
    });
  }

  _isValidTargetFor(actor, target) {
    if (!target.isAlive) return false;
    if (actor.role === ROLES.MEDIC) return true;
    if (target.id === actor.id) return false;
    if (
      ROLE_TEAMS[actor.role] === TEAMS.MAFIA &&
      ROLE_TEAMS[target.role] === TEAMS.MAFIA
    ) {
      return false;
    }
    return true;
  }  _resolveNight() {
    if (this.phase !== PHASES.NIGHT) return;
    this._clearTimer();

    const outcome = resolveNightActions(this.players, this.nightActions);

    if (outcome.silenceTargetId) {
      const silenced = this.players.get(outcome.silenceTargetId);
      if (silenced) silenced.isSilenced = true;
    }
    if (outcome.shotFired) {
      const shooter = this.players.get(outcome.shooterId);
      if (shooter) shooter.bulletsLeft = Math.max(0, shooter.bulletsLeft - 1);
    }
    if (outcome.vigilanteFired) {
      const shooter = this.players.get(outcome.vigilanteShooterId);
      if (shooter) shooter.bulletsLeft = Math.max(0, shooter.bulletsLeft - 1);
    }

    // Detective verdict travels privately — a whisper, never a town crier.
    if (outcome.investigation) {
      const detective = this.players.get(outcome.investigation.detectiveId);
      const { targetName, verdict } = outcome.investigation;
      if (detective?.socketId && detective.isAlive) {
        this.io.to(detective.socketId).emit('chat:message', {
          from: { id: '__detective__', name: 'المحقق فيك' },
          text:
            verdict === 'MAFIA'
              ? `${targetName} طلع عليه آثار مافيا.. متطمنش كتير، بس خد بالك.`
              : `${targetName} فحصته مشوار.. مفيش عليه شيئًا يديناه.`,
          at: Date.now(),
        });
      }
    }

    const fallenGoodBoy = outcome.deaths
      .map((id) => this.players.get(id))
      .find((player) => player?.role === ROLES.GOOD_BOY);

    if (fallenGoodBoy) {
      this._beginRevenge({
        deadPlayer: fallenGoodBoy,
        source: 'NIGHT',
        excluded: outcome.deaths,
        onDone: (extraDeaths) => {
          for (const { id, cause } of extraDeaths) outcome.addDeath(id, cause);
          this._finishNight(outcome);
        },
      });
      return;
    }

    this._finishNight(outcome);
  }

  _finishNight(outcome) {
    this.nightActions.clear();
    const deaths = outcome.deaths.map((id) =>
      this._applyDeath(id, outcome.deathCauses.get(id) ?? ['UNKNOWN']),
    );
    this.lastNightDeaths = deaths.filter(Boolean);

    this.io.to(this.code).emit('game:night_result', {
      round: this.round,
      events: outcome.events,
      deaths,
    });
    if (deaths.length > 0) {
      const names = deaths.map((d) => d.name).join(' و');
      this._logEvent(`بعد ليلة ${this.round}: سقط ${names}`, 'NIGHT');
    } else {
      this._logEvent(`ليلة ${this.round} عدّت من غير ضحايا`, 'NIGHT');
    }

    // Snapshot for the morning newspaper — consumed by the phase broadcast
    // below and kept in game state for the whole day (syncs/rejoins included).
    const silenced = [...this.players.values()].find((p) => p.isSilenced && p.isAlive);
    this.pendingNightReport = {
      victim: deaths[0]?.name ?? null,
      silenced: silenced?.name ?? null,
    };

    this.broadcastUpdate();

    if (this._checkWin()) return;
    this._openDiscussion();
  }

  _openDiscussion() {
    this.phase = PHASES.DAY_DISCUSSION;
    this._armTimer(config.timers.DAY_DISCUSSION_MS, () => this._openVoting());
    // Night results ride along with the phase change at the exact shift
    // moment; the same report also lives in game state (publicState).
    const nightReport = this.pendingNightReport ?? { victim: null, silenced: null };
    this.broadcastPhase({ nightReport });
    this.broadcastUpdate();
    this._scheduleBotChat();
  }

  _openVoting() {
    this.phase = PHASES.DAY_VOTING;
    this.votes.clear();
    this._armTimer(config.timers.DAY_VOTING_MS, () => this._resolveVotes());
    this.broadcastPhase();
    this.broadcastUpdate();
    this._scheduleVoteBots();
  }

  _resolveVotes() {
    if (this.phase !== PHASES.DAY_VOTING) return;
    this._clearTimer();

    const voters = this._alivePlayers();
    const tally = tallyVotes(this.players, this.votes);
    const { eliminatedId, tied, topCount } = resolveTally(tally);

    const tallyRows = [...tally.entries()]
      .map(([pid, weightedVotes]) => ({
        playerId: pid,
        name: this.players.get(pid)?.name ?? 'Unknown',
        weightedVotes,
      }))
      .sort((a, b) => b.weightedVotes - a.weightedVotes);

    const weights = voters.map((player) => ({
      playerId: player.id,
      name: player.name,
      weight: voteWeightOf(player),
    }));

    const eliminatedPlayer = eliminatedId ? this.players.get(eliminatedId) : null;

    this.io.to(this.code).emit('game:vote_result', {
      round: this.round,
      tally: tallyRows,
      weights,
      tied,
      topCount,
      eliminated: eliminatedPlayer
        ? { id: eliminatedPlayer.id, name: eliminatedPlayer.name, role: eliminatedPlayer.role }
        : null,
    });

    if (!eliminatedPlayer) {
      this._logEvent(`محاكمة ${this.round}: الأصوات تعادلت.. محدش بيتشنق النهارده`, 'VOTE');
      this.broadcastUpdate();
      this._advanceToNight();
      return;
    }

    // The verdict is read; the accused steps into the DEFENSE spotlight while
    // the table may still shift its votes for DEFENSE_MS.
    this._beginDefense(eliminatedPlayer);
  }

  _beginDefense(accused) {
    this.phase = PHASES.DEFENSE_STAGE;
    this.defensePlayerId = accused.id;
    this._logEvent(
      `${accused.name} فوق منصة الاتهام! عنده ${Math.round(config.timers.DEFENSE_MS / 1000)} ثانية يدافع.. والتصويت لسه بيتحرك!`,
      'DEFENSE',
    );
    this._armTimer(config.timers.DEFENSE_MS, () => this._finishDefense());
    this.broadcastPhase();
    this.broadcastUpdate();
    logger.info(
      `Room ${this.code}: ${accused.name} defends (${config.timers.DEFENSE_MS}ms, vote shifting open)`,
    );
  }

  _finishDefense() {
    if (this.phase !== PHASES.DEFENSE_STAGE) return;
    this._clearTimer();
    this.defensePlayerId = null;

    // Recount with the FINAL shifted votes before reading the verdict.
    const tally = tallyVotes(this.players, this.votes);
    const { eliminatedId } = resolveTally(tally);
    const condemned = eliminatedId ? (this.players.get(eliminatedId) ?? null) : null;

    if (!condemned || !condemned.isAlive) {
      // Shifts dissolved the majority — nobody hangs today.
      this._logEvent('التصويت اتلخبط في الدقيقة الأخيرة.. محدش اتحكم عليه النهاردة!', 'DEFENSE');
      this.broadcastUpdate();
      this._advanceToNight();
      return;
    }

    this._beginLastWords(condemned);
  }

  _beginLastWords(accused) {
    this.phase = PHASES.LAST_WORDS;
    this.lastWordsPlayerId = accused.id;
    this._logEvent(`${accused.name} طلع المنصة.. ليه ٢٠ ثانية آخر كلام`, 'LAST_WORDS');
    this._armTimer(config.timers.LAST_WORDS_MS, () => this._finishLastWords());
    this.broadcastPhase();
    this.broadcastUpdate();
    logger.info(`Room ${this.code}: ${accused.name} gets last words (${config.timers.LAST_WORDS_MS}ms)`);
  }

  _finishLastWords() {
    if (this.phase !== PHASES.LAST_WORDS) return;
    this._clearTimer();

    const accused = this.lastWordsPlayerId ? this.players.get(this.lastWordsPlayerId) ?? null : null;
    this.lastWordsPlayerId = null;

    let eliminatedInfo = null;
    if (accused && accused.isAlive) {
      eliminatedInfo = this._applyDeath(accused.id, [DEATH_CAUSES.VOTE_ELIMINATION]);
      this._logEvent(`قرار المجلس نزل على ${accused.name}`, 'EXECUTION');
    }

    // JOKER — being voted out IS his win condition.
    if (accused && accused.role === ROLES.JOKER && eliminatedInfo) {
      this.broadcastUpdate();
      this._endGame(TEAMS.NEUTRAL, `الجوكر ${accused.name} اتحكم عليه.. وكسب الرهان لوحده!`);
      return;
    }

    // Cinematic payload — the client plays the execution scene on night fall.
    const eliminationPayload =
      eliminatedInfo && accused ? { playerId: accused.id, name: accused.name, role: accused.role } : null;

    this.broadcastUpdate();

    const proceed = (extraDeaths = []) => {
      for (const { id, cause } of extraDeaths) {
        this._applyDeath(id, [cause]);
      }
      this.broadcastUpdate();
      if (this._checkWin()) return;
      this._advanceToNight(eliminationPayload);
    };

    if (eliminatedInfo && accused?.role === ROLES.GOOD_BOY) {
      this._beginRevenge({
        deadPlayer: accused,
        source: 'VOTE',
        excluded: [accused.id],
        onDone: proceed,
      });
      return;
    }

    proceed();
  }

  _beginRevenge({ deadPlayer, source, excluded, onDone }) {
    this.awaitingRevenge = {
      playerId: deadPlayer.id,
      source,
      excluded: new Set(excluded),
      extraDeaths: [],
      onDone,
    };
    this.touch();
    this._armTimer(config.timers.REVENGE_MS, () => this.submitRevenge(deadPlayer.id, null));
    this.broadcastPhase();
    this.broadcastUpdate();
    this._sendRevengePrompt(deadPlayer);
    if (deadPlayer.isBot) {
      this._notifyBotThinking(deadPlayer.id, 'night');
      this._scheduleBot(() => {
        if (!this.awaitingRevenge || this.awaitingRevenge.playerId !== deadPlayer.id) return;
        const options = this._alivePlayers().filter(
          (candidate) => !this.awaitingRevenge.excluded.has(candidate.id),
        );
        const targetId = options.length && Math.random() < 0.7
          ? options[Math.floor(Math.random() * options.length)].id
          : null;
        this.submitRevenge(deadPlayer.id, targetId);
      }, BOT_THINK_MIN_MS, BOT_THINK_MAX_MS);
    }
    logger.info(`Room ${this.code}: Good Boy ${deadPlayer.name} fell (${source}) \u2014 revenge pending`);
  }

  _sendRevengePrompt(player) {
    const revenge = this.awaitingRevenge;
    if (!revenge) return;
    const options = this._alivePlayers()
      .filter((candidate) => !revenge.excluded.has(candidate.id))
      .map((candidate) => ({ id: candidate.id, name: candidate.name }));

    this._emitToPlayer(player, 'good_boy:prompt', {
      source: revenge.source,
      options,
      deadline: this.phaseEndsAt,
    });
  }

  _applyDeath(playerId, causes) {
    const player = this.players.get(playerId);
    if (!player) return null;
    player.isAlive = false;
    player.deathRound = this.round;
    player.deathCause = causes.join(' & ');
    return { id: player.id, name: player.name, role: player.role, causes };
  }

  _checkWin() {
    const alive = this._alivePlayers();
    const mafiaCount = alive.filter((p) => p.team === TEAMS.MAFIA).length;
    const townCount = alive.length - mafiaCount;

    if (mafiaCount === 0) {
      this._endGame(TEAMS.TOWN, 'آخر مافيا في البلد اتشال. الأهالي كسبوا.');
      return true;
    }
    if (mafiaCount >= townCount) {
      this._endGame(TEAMS.MAFIA, 'المافيا بقت بتعادل الأهالي.. الشوارع بقت ملكها.');
      return true;
    }
    return false;
  }

  _endGame(winner, reason) {
    this.phase = PHASES.GAME_OVER;
    this.awaitingRevenge = null;
    this._clearTimer();
    this.result = {
      winner,
      reason,
      roster: [...this.players.values()].map((player) => ({
        id: player.id,
        name: player.name,
        role: player.role,
        isAlive: player.isAlive,
        isHost: player.isHost,
        cosmetics: player.cosmetics ?? null,
      })),
    };
    this.io.to(this.code).emit('game:over', this.result);
    this._logEvent(`${winner === TEAMS.MAFIA ? 'المافيا' : 'الأهالي'} كسبوا — ${reason}`, 'WIN');
    this.broadcastUpdate();
    logger.info(`Room ${this.code}: game over \u2014 ${winner} wins`);
  }

  broadcastPhase(extra = null) {
    this.io.to(this.code).emit('phase:change', {
      phase: this.phase,
      round: this.round,
      deadline: this.phaseEndsAt,
      awaitingRevenge: this.awaitingRevenge ? { source: this.awaitingRevenge.source } : null,
      ...(extra ?? {}),
    });
    // Web Push لما النهار يطلع — للمشتركين اللي التاب مقفول
    if (this.phase === PHASES.DAY_DISCUSSION) {
      pushService.notifyRoom(this, {
        title: 'حارة المافيا — الصبح طلع!',
        body: `النقاش بدأ في الأوضة ${this.code} · جولة ${this.round} — ارجع بسرعة`,
        url: `/game/${this.code}`,
      });
    }
  }

  _micEnabled(player) {
    if (this.phase === PHASES.LOBBY || this.phase === PHASES.GAME_OVER) {
      return player.isConnected;
    }
    if (this.phase === PHASES.LAST_WORDS) return player.id === this.lastWordsPlayerId;
    if (this.phase === PHASES.DEFENSE_STAGE) return player.id === this.defensePlayerId;
    if (DAY_PHASES.has(this.phase)) return player.isAlive && !player.isSilenced;
    return false;
  }

  _alivePlayers() {
    return [...this.players.values()].filter((player) => player.isAlive);
  }

  _partnersOf(player) {
    if (player.team !== TEAMS.MAFIA) return [];
    return [...this.players.values()]
      .filter((other) => other.team === TEAMS.MAFIA && other.id !== player.id)
      .map((other) => ({ id: other.id, name: other.name, isAlive: other.isAlive }));
  }

  _requirePlayer(playerId) {
    const player = this.players.get(playerId);
    assert(player, ErrorCodes.NOT_IN_ROOM, 'You are not seated in this room');
    return player;
  }

  _emitToPlayer(player, event, payload) {
    if (player.socketId) {
      this.io.to(player.socketId).emit(event, payload);
    }
  }

  _armTimer(durationMs, onExpire) {
    this._clearTimer();
    this.phaseEndsAt = Date.now() + durationMs;
    this.timer = setTimeout(() => {
      this.timer = null;
      try {
        onExpire();
      } catch (error) {
        const detail = error instanceof GameError ? `${error.code}: ${error.message}` : error;
        logger.warn(`Room ${this.code} timer callback failed:`, detail);
      }
    }, durationMs);
  }

  _clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
