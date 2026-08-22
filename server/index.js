import http from 'node:http';
import express from 'express';
import { Server as SocketIoServer } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import { config } from '../src/config/index.js';
import { GameStateManager } from '../src/game/GameStateManager.js';
import { logger } from '../src/utils/logger.js';
import { registerSocketHandlers } from '../src/sockets/index.js';
import { profileStore } from '../src/profiles/profileStore.js';
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

// إنشاء/تحديث بروفايل بعد تسجيل الدخول (جوجل أو الوضع المحلي)
app.post('/api/profile', (req, res) => {
  try {
    const { uid, displayName, photoURL, provider } = req.body ?? {};
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'uid is required' });
    }
    res.json({ profile: profileStore.upsert({ uid, displayName, photoURL, provider }) });
  } catch (error) {
    logger.error(`profile upsert failed: ${error.message}`);
    res.status(500).json({ error: 'PROFILE_DOWN' });
  }
});

// تسجيل نتيجة ماتش — فوز/خسارة + كوينز + عدّادات الأسبوع
app.post('/api/profile/:uid/result', (req, res) => {
  try {
    const profile = profileStore.recordResult(req.params.uid, Boolean(req.body?.won));
    if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
    res.json({ profile });
  } catch (error) {
    logger.error(`profile result failed: ${error.message}`);
    res.status(500).json({ error: 'PROFILE_DOWN' });
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
