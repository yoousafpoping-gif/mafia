---
title: Mafia Server
emoji: 🎩
colorFrom: red
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# حارة المافيا 🎩

لعبة مافيا P2P متعددة اللاعبين — الأوضات بتشتغل في متصفح الهوست، والسيرفر ده
بيعمل matchmaking + صدارة + PeerJS signaling على مسار `/peerjs`.

- **الواجهة**: Next.js (static export) — `client/`
- **السيرفر**: Node.js + Express + Socket.io + PeerJS mount — `server/index.js`
- **التشغيل المحلي**: `npm run dev` (سيرفر على 4000) + `cd server/peerjs && npm run dev` (على 9000) + `cd client && npm run dev` (على 3000)

فحص الصحة: `GET /health` — فحص الـ signaling: `GET /peerjs/peerjs/id?ts=1`
