import http from 'node:http';
import express from 'express';
import { Server as SocketIoServer } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import { config } from '../src/config/index.js';
import { GameStateManager } from '../src/game/GameStateManager.js';
import { logger } from '../src/utils/logger.js';
import { registerSocketHandlers } from '../src/sockets/index.js';
import { profileStore } from '../src/profiles/profileStore.js';
import { COSMETIC_CATALOG } from '../src/profiles/catalog.js';
import { verifyFirebaseToken } from '../src/auth/firebaseAuth.js';
import { pushService } from '../src/push/pushService.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json());
// كل الـJSON responses بتطلع UTF-8 صريح — العربي في الأسماء والرسائل مبيبوظش
app.use((_req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

const server = http.createServer(app);
const io = new SocketIoServer(server, {
  cors: {
    origin: config.corsOrigins.includes('*') ? '*' : config.corsOrigins,
    methods: ['GET', 'POST'],
  },
});

/* CORS لroutes الـ REST (البروفايل والصدارة) — إعدادات socket.io
   فوق بتغطي الويب-سوكت بس، والفetch من الكلاينت بيعدي من هنا. */
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  const allowAll = config.corsOrigins.includes('*');
  if (origin && (allowAll || config.corsOrigins.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const manager = new GameStateManager(io);

/* ===== PeerJS signaling — نفس الخدمة على مسار /peerjs =====
   الأوضات P2P (هوست المتصفح) بس محتاجة broker للتعارف الأولي.
   تركيبه هنا بدل خدمة منفصلة: نفس الاستيقاظ من السكون، نفس الدومين،
   والكلاينت بيتوصل عبر NEXT_PUBLIC_PEER_SERVER=<رابط الخدمة>/peerjs */
const peerServer = ExpressPeerServer(server, {});
peerServer.on('connection', (client) => logger.info(`peerjs: ${client.getId()} connected`));
peerServer.on('disconnect', (client) => logger.info(`peerjs: ${client.getId()} disconnected`));
peerServer.on('error', (error) => logger.error('peerjs server error:', error.message));
app.use('/peerjs', peerServer);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Number(process.uptime().toFixed(1)),
    rooms: manager.rooms.size,
    connectedPlayers: manager.socketIndex.size,
  });
});

/* ===== بروفايلات اللاعبين ولوحة الصدارة الأسبوعية ===== */

// لوحة الصدارة — أعلى 10 لاعبين الأسبوع ده
app.get('/api/leaderboard', (_req, res) => {
  try {
    res.json({ ...profileStore.weekInfo(), players: profileStore.topPlayers(10) });
  } catch (error) {
    logger.error(`leaderboard failed: ${error.message}`);
    res.status(500).json({ error: 'LEADERBOARD_DOWN' });
  }
});

app.get('/api/store/catalog', (_req, res) => res.json({ items: COSMETIC_CATALOG }));

function idempotencyKey(req) {
  return req.get('idempotency-key') ?? req.body?.idempotencyKey;
}

function profileError(res, error) {
  const explicitStatus = Number(error?.status);
  const status = explicitStatus >= 400 && explicitStatus <= 599 ? explicitStatus
    : error.code === 'INSUFFICIENT_COINS' || error.code === 'INSUFFICIENT_GEMS' || error.code === 'ALREADY_OWNED' || error.code === 'DAILY_CLAIMED' || error.code === 'QUEST_CLAIMED' || error.code === 'QUEST_INCOMPLETE' || error.code === 'LOGIN_REWARD_CLAIMED' || error.code === 'LOGIN_REWARD_LOCKED' || error.code === 'LOGIN_REWARD_SEQUENCE' ? 409
      : error.code === 'ITEM_NOT_FOUND' || error.code === 'ITEM_NOT_OWNED' || error.code === 'QUEST_NOT_FOUND' || error.code === 'LOGIN_REWARD_NOT_FOUND' ? 404
        : error.code === 'IDEMPOTENCY_REQUIRED' ? 400 : 500;
  if (status === 500) logger.error(`profile operation failed: ${error.message}`);
  return res.status(status).json({ error: error.code ?? 'PROFILE_DOWN' });
}

app.get('/api/profile', verifyFirebaseToken, (req, res) => {
  const profile = profileStore.get(req.auth.uid);
  if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
  return res.json({ profile });
});

app.post('/api/profile', verifyFirebaseToken, (req, res) => {
  try {
    const token = req.auth.token;
    const profile = profileStore.upsert({
      uid: req.auth.uid,
      displayName: req.body?.displayName ?? token.name,
      photoURL: req.body?.photoURL ?? token.picture,
      provider: token.firebase?.sign_in_provider ?? 'firebase',
    });
    return res.json({ profile });
  } catch (error) {
    return profileError(res, error);
  }
});

app.post('/api/profile/player-name', verifyFirebaseToken, (req, res) => {
  try {
    const profile = profileStore.setPlayerName(req.auth.uid, req.body?.playerName);
    if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    return res.json({ profile });
  } catch (error) {
    return profileError(res, error);
  }
});

/* حذف الحساب — الكلاينت بينادي ده قبل حذف حساب Firebase Auth لأن التوكن
   بيتلغي بعد حذف الحساب من Auth. Idempotent عمداً: لو البروفايل مش
   موجود (اتمسح في محاولة سابقة فشلت بعدها) بنرد نجاح مش 404. */
app.delete('/api/profile', verifyFirebaseToken, (req, res) => {
  try {
    const existed = profileStore.remove(req.auth.uid);
    pushService.removeSubscription(req.auth.uid);
    logger.info(`profile deleted: uid=${req.auth.uid} existed=${existed}`);
    return res.json({ deleted: true, existed });
  } catch (error) {
    return profileError(res, error);
  }
});

app.post('/api/profile/result', verifyFirebaseToken, (req, res) => {
  try {
    const { roomCode, playerId } = req.body ?? {};
    const room = manager.rooms.get(String(roomCode ?? '').toUpperCase());
    const seat = room?.result?.roster?.find((entry) => entry.id === playerId);
    if (!room || room.phase !== 'GAME_OVER' || !seat || !room.result) {
      return res.status(409).json({ error: 'RESULT_NOT_VERIFIED' });
    }
    const playerTeam = ['MAFIA_BOSS', 'MAFIOSO', 'SILENCER', 'FRAMER'].includes(seat.role)
      ? 'MAFIA' : seat.role === 'JOKER' ? 'NEUTRAL' : 'TOWN';
    const outcome = profileStore.recordResult(req.auth.uid, {
      idempotencyKey: idempotencyKey(req),
      roomCode: room.code,
      winner: room.result.winner,
      playerTeam,
      role: seat.role,
      alive: seat.isAlive,
    });
    if (!outcome) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    return res.json(outcome);
  } catch (error) {
    return profileError(res, error);
  }
});

app.post('/api/store/purchase', verifyFirebaseToken, (req, res) => {
  try {
    const outcome = profileStore.purchase(req.auth.uid, req.body?.itemId, idempotencyKey(req));
    if (!outcome) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    return res.json(outcome);
  } catch (error) {
    return profileError(res, error);
  }
});

app.post('/api/store/equip', verifyFirebaseToken, (req, res) => {
  try {
    const outcome = profileStore.equip(req.auth.uid, req.body?.itemId, idempotencyKey(req));
    if (!outcome) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    return res.json(outcome);
  } catch (error) {
    return profileError(res, error);
  }
});

/* ===== المتجر الموسّع: الجواهر، صناديق الحظ، الهدية والعروض اليومية، التحويل ===== */

app.get('/api/store/daily', verifyFirebaseToken, (req, res) => {
  try {
    return res.json(profileStore.dailyStatus(req.auth.uid));
  } catch (error) {
    return profileError(res, error);
  }
});

app.post('/api/store/open-box', verifyFirebaseToken, (req, res) => {
  try {
    const outcome = profileStore.openBox(req.auth.uid, req.body?.boxId, idempotencyKey(req));
    if (!outcome) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    return res.json(outcome);
  } catch (error) {
    return profileError(res, error);
  }
});

app.post('/api/store/claim-daily', verifyFirebaseToken, (req, res) => {
  try {
    const outcome = profileStore.claimDaily(req.auth.uid, idempotencyKey(req));
    if (!outcome) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    return res.json(outcome);
  } catch (error) {
    return profileError(res, error);
  }
});

app.post('/api/profile/quests/claim', verifyFirebaseToken, (req, res) => {
  try {
    const outcome = profileStore.claimQuest(req.auth.uid, req.body?.questId, idempotencyKey(req));
    if (!outcome) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    return res.json(outcome);
  } catch (error) {
    return profileError(res, error);
  }
});

app.post('/api/profile/login-rewards/claim', verifyFirebaseToken, (req, res) => {
  try {
    const outcome = profileStore.claimLoginReward(req.auth.uid, req.body?.day, idempotencyKey(req));
    if (!outcome) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    return res.json(outcome);
  } catch (error) {
    return profileError(res, error);
  }
});

app.post('/api/store/convert', verifyFirebaseToken, (req, res) => {
  try {
    const outcome = profileStore.convertCoins(req.auth.uid, idempotencyKey(req));
    if (!outcome) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    return res.json(outcome);
  } catch (error) {
    return profileError(res, error);
  }
});

/* ===== Web Push — مفاتيح VAPID واشتراكات المتصفح ===== */

app.get('/api/push/vapid-public-key', (_req, res) => {
  res.json({ publicKey: pushService.vapidPublicKey });
});

app.post('/api/push/subscribe', (req, res) => {
  const { playerId, name, subscription } = req.body ?? {};
  if (!playerId || !subscription?.endpoint) {
    return res.status(400).json({ error: 'playerId and subscription are required' });
  }
  pushService.saveSubscription(playerId, name, subscription);
  res.json({ subscribed: true });
});

app.post('/api/push/unsubscribe', (req, res) => {
  pushService.removeSubscription(req.body?.playerId);
  res.json({ unsubscribed: true });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

registerSocketHandlers(io, manager);

server.listen(config.port, () => {
  logger.info(`Advanced Mafia server listening on port ${config.port}`);
});

const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down`);
  manager.stop();
  io.close();
  server.close();
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection:', reason));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});
