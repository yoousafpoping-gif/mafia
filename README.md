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

## إعداد تسجيل الدخول Firebase (Google وFacebook)

1. أنشئ Web App من Firebase Console ثم انسخ `client/.env.local.example` إلى `client/.env.local` واملأ قيم `NEXT_PUBLIC_FIREBASE_*` العامة فقط. لا تضع service-account keys أو Facebook App Secret في ملفات الكلاينت.
2. من **Authentication → Sign-in method** فعّل Google وFacebook.
3. في Facebook Developers اضبط **Valid OAuth Redirect URI** إلى `https://<project-id>.firebaseapp.com/__/auth/handler`، ثم ضع App ID وApp Secret داخل إعداد مزود Facebook في Firebase Console فقط.
4. من **Authentication → Settings → Authorized domains** أضف `localhost` للتطوير، ودومين الإنتاج الفعلي (Netlify/Vercel أو الدومين المخصص) بدون بروتوكول أو مسار.
5. أضف نفس قيم `NEXT_PUBLIC_FIREBASE_*` إلى إعدادات بيئة منصة النشر ثم أعد بناء الواجهة.

وضع الضيف لا يحتاج Firebase: الرصيد والمقتنيات والتقدم تُحفظ في `localStorage` على الجهاز، ولا تُرسل إلى API الحسابات السحابية. حسابات Google/Facebook تستخدم API المحمي بتوكن Firebase.
