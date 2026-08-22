// سيرفر PeerJS مستقل — signaling لأوضات اللعبة بدل الاعتماد على السحابة العامة.
// التشغيل المحلي: npm install ثم npm run dev (افتراضي على البورت 9000).
// في الإنتاج يمكن نشره لوحده (خدمة منفصلة) أو استخدام نفس المسار /peerjs
// المركّب على سيرمر اللعبة الرئيسي — الاتنين متوافقين مع الكلاينت.
import { PeerServer } from 'peer';

const PORT = Number(process.env.PORT) || 9000;

const server = PeerServer({
  port: PORT,
  path: '/peerjs',
  // allow_discovery: false افتراضيًا — مفيش عرض لقائمة الـ ids للغرباء
});

server.on('connection', (client) => {
  console.log(`[peer] connected: ${client.getId()}`);
});

server.on('disconnect', (client) => {
  console.log(`[peer] disconnected: ${client.getId()}`);
});

server.on('error', (error) => {
  console.error('[peer] server error:', error);
});

console.log(`[peer] PeerJS signaling server listening on port ${PORT} at /peerjs`);
