# دليل شامل: حارة المافيا (Haret El Mafia) — مرجع كامل لأي AI Agent

> هذا الملف مكتوب ليكون مرجعًا كاملًا لأي مطور أو AI agent يريد فهم اللعبة وتعديلها.
> آخر تحديث: 2026-08-23 · اللعبة منشورة على: **https://mafia-b1d7e.web.app**

---

## 1) إيه هي اللعبة؟

لعبة مافيا (Werewolf/Mafia) مصرية بالعامية، متصفح فقط (Browser game)، من **4 إلى 12 لاعب**، كل لاعب على جهازه (موبايل/كمبيوتر)، مع دعم بوتات ذكية للعب التجريبي، شات كتابي، ريأكشنز إيموجي، ودردشة صوتية لايف (WebRTC mesh) مع قنوات حسب المرحلة (خط المافيا السري ليلًا مثلًا).

- **الاسم:** حارة المافيا — مجلس الظلام · لا تثق في حد
- **اللغة:** واجهة عربية RTL بالكامل (مصرية)، كود وتعليقات مختلطة عربي/إنجليزي
- **التقنية:** Next.js 16 (static export) + TypeScript + Tailwind CSS + framer-motion
- **البنية:** P2P بدون سيرفر لعب — محرك اللعبة بيجري في متصفح صاحب الأوضة (الهوست)

---

## 2) البنية التقنية (Architecture)

```
┌─────────────┐   Firestore (signaling)   ┌─────────────┐
│   Host      │◄────── offers/answers ────►│   Guest     │
│  (browser)  │                            │  (browser)  │
│             │◄═════ WebRTC DataChannel ══►│             │
│ GameRoom    │   (كل رسائل اللعبة P2P)     │ RoomClient  │
│ (engine)    │                            │             │
└─────────────┘                            └─────────────┘
      │                                          │
      └────────── Firebase Hosting ──────────────┘
              (الواجهة الثابتة + CDN جوجل)
```

**الفكرة الجوهرية:** مفيش سيرفر Node.js شغال. أول واحد بيعمل الأوضة = الهوست، ومتصفحه بيشغّل محرك اللعبة كامل (`GameRoom`). الضيوف بيتوصلوا بيه مباشرة عبر WebRTC DataChannel. **Firestore بيُستخدم فقط كوسيط signaling** لتبادل الـ offer/answer/ICE في أول الاتصال، وبعدها كل حاجة P2P.

**تبعيات السحابة (Firebase project: `mafia-b1d7e`):**
| الخدمة | الاستخدام | الحالة |
|---|---|---|
| Firebase Hosting | نشر الواجهة (static) | شغال — mafia-b1d7e.web.app |
| Cloud Firestore | signaling + إعدادات TURN | شغال |
| Firebase Auth | دخول جوجل | محتاج تفعيل Google Provider من الكونسول |
| ExpressTURN | TURN relay للعبور بين الشبكات | شغال (1000GB/شهر مجانًا) |

---

## 3) شجرة الملفات المهمة

```
E:\mafia\
├── firebase.json              # إعدادات Hosting + Firestore rules
├── firestore.rules            # قواعد الأمان (rooms/** + config/** مفتوحين)
├── .firebaserc                # المشروع mafia-b1d7e
├── DEPLOY.md                  # خطوات النشر + TURN + القواعد
├── AI-GUIDE.md                # هذا الملف
├── client/                    # ← كل اللعبة هنا
│   ├── .env.local             # مفاتيح Firebase (NEXT_PUBLIC_FIREBASE_*)
│   ├── next.config.ts         # output: 'export' (static)
│   ├── public/                # أصول ثابتة (صور الأدوار، أصوات، sw.js)
│   └── src/
│       ├── app/
│       │   ├── page.tsx       # الرئيسية (منيو الدخول)
│       │   └── game/page.tsx  # صفحة اللعبة (تقرأ ?code=XXXX من الـ URL)
│       ├── components/        # كل الواجهات (تحت)
│       ├── hooks/
│       │   ├── useMafiaGame.ts   # جسر React ↔ الشبكة ↔ المحرك (الحالة المركزية)
│       │   └── useVoiceChat.ts   # دردشة صوتية WebRTC mesh + كشف المتكلم
│       ├── context/AuthContext.tsx  # دخول جوجل + وضع محلي احتياطي
│       └── lib/
│           ├── p2p.ts         # ★ النقل: RoomHost / RoomClient / Envelope
│           ├── ice.ts         # STUN/TURN (env ← Firestore config/turn ← STUN)
│           ├── net.ts         # ★ RoomNet + handlers المحرك + relay الصوت
│           ├── firebase.ts    # تهيئة Firebase
│           ├── engine/
│           │   └── GameRoom.ts  # ★★ محرك اللعبة كامل (الأدوار/المراحل/التصويت)
│           ├── types.ts       # كل الأنواع (GameState, Phase, Player...)
│           ├── roles.ts       # تعريف الأدوار وتسمياتها
│           ├── seat.ts        # قعدة اللاعب المحفوظة (localStorage + توكن rejoin)
│           └── reactions.ts / sfx.ts / audioManager.ts  # إيموجي وأصوات
├── server/                    # ⚠️ LEGACY — كود Socket.io قديم مش مستخدم في النشر
└── Dockerfile                 # ⚠️ LEGACY — كان للاستضافة الحاوية
```

### المكونات الرئيسية (components/)
| الملف | الشاشة/الوظيفة |
|---|---|
| `GameClient.tsx` | الموزّع الرئيسي: يقرر أي شاشة تظهر حسب الـ phase، ويجمع كل حاجة |
| `LandingScreen.tsx` | الرئيسية: اسمك، اعمل أوضة، بحث سريع، دخول بكود، تمرين بوتات |
| `LobbyView.tsx` | اللوبي: قائمة اللاعبين، نسخ لينك الدعوة، ضيف بوتات، بدء اللعب |
| `TopBar.tsx` | الشريط العلوي: كود الأوضة، تايمر، زرار المايك، خروج (موبايل: 4 أزرار بس) |
| `CouncilTable.tsx` | طاولة المجلس: كروت اللاعبين على **مسرح بيضاوي** (seatPos بنسب %) |
| `NightOverlay.tsx` | شاشة الليل: "الليلة رقم X" + فعل دورك (تبدأ تحت التوب بار top-14) |
| `VotingPanel.tsx` | المحاكمة: أزرار المرشحين + شيت سفلي على الموبايل |
| `ChatDock.tsx` | الشريط السفلي: شات + ريأكشنز إيموجي 3D |
| `PhaseTransition.tsx` | انتقالات سينمائية بين المراحل (1.7 ثانية) |
| `NewspaperModal.tsx` / `MorningReport.tsx` | جريدة الصبح (تقرير الليل) |
| `ExecutionOverlay.tsx` / `NewsFlashModal.tsx` | مشهد الإعدام + خبر عاجل |
| `GameOverScreen.tsx` / `VictoryModal` | النهاية + MVP + إعادة اللعب |
| `MicButton.tsx` | زرار الدخول/الخروج من الصوت |
| `Toasts.tsx` | رسائل الخطأ العائمة (كود + رسالة عربية) |

---

## 4) بروتوكول الشبكة (p2p.ts)

### Envelope — كل رسالة على الـ DataChannel JSON نصي:
```ts
{ kind: 'emit',    event, payload }                        // إشعار باتجاه واحد
{ kind: 'request', event, payload, ackId }                  // طلب محتاج رد
{ kind: 'ack',     ackId, ok, data?, error?: {code,message} } // الرد
```

### RoomHost (في متصفح صاحب الأوضة)
- بيكتب حضوره في `rooms/{code}/peers/host` مع **نبضة حياة كل 50 ثانية** (`updatedAt`)
- بيراقب `rooms/{code}/peers` — أي ضيف يكتب offer بيرد عليه answer
- **تنظيف:** `pagehide` بيمسح مستند الحضور؛ الضيف بيرفض الأوضة لو آخر نبضة أقدم من 3 دقائق
- `host.conns: Map<peerId, ChannelConn>` — قناة لكل ضيف مع طابور رسائل قبل الفتح
- `HOST_SOCKET = '__host__'` — معرّف الهوست في الرسائل

### RoomClient (كل ضيف)
- بيفحص حضور الهوست الأول (موجود + طازي؟) → يكتب offer → يستنى answer → قناة تفتح
- مهلة داخلية 15 ثانية، وخارجية في net.ts 18 ثانية
- **sendRequest بيطبّر** الرسالة لو القناة لسه بتفتح (مفيش رفض فوري NOT_CONNECTED)

### ⚠️ فخاخ معروفة (لا تكررها):
1. **مسارات Firestore لازم عدد شرايحها زوجي**: `rooms/X/peers/host` ✓ — `rooms/X/host` ✗
2. **التاب الخلفي بيتجمّد** في بعض المتصفحات — الهوست لازم يفضل ظاهر، ومش نعتمد على مؤقتات دقيقة في تاب مخفي
3. **إعادة الربط بالتوكن مرة واحدة بس** (`rejoinTriedRef` في useMafiaGame) — من غيرها اتصال شبح بيدمّر مقعد الهوست
4. **المحرك بيرفض reattach لتوكن الهوست** ومش بيمسح لاعب هوست حي في اللوبي أبدًا
5. **الجوجل ساين-إن على الموبايل = signInWithRedirect** (البوباب محجوب)

---

## 5) محرك اللعبة (engine/GameRoom.ts)

### المراحل (Phases):
```
LOBBY → NIGHT → DAY_DISCUSSION → DAY_VOTING → (DEFENSE_STAGE → LAST_WORDS) → ليل جديد...
                                                                    ↓
                                                                GAME_OVER
```

### الأدوار (11):
| الدور | الفريق | القدرة |
|---|---|---|
| مواطن Citizen | أهالي | مفيش — صوته سلاحه |
| محقق Detective | أهالي | كل ليلة بيفحص حد: مافيا ولا نضيف |
| دكتور Medic | أهالي | بيحمي حد من القتل كل ليلة (حتى نفسه) |
| قناص Sniper | أهالي | رصاصات محدودة — لو أصاب بريء بيموت معاه |
| عمدة Mayor | أهالي | يكشف نفسه مرة: صوته ×3 في التصويت |
| تلميع Polisher | مافيا | بيلمّع بريء يظهر كمشبوه للصويت/المحقق |
| سكّاتير Silencer | مافيا | بيسكّت حد نهار يوم كامل (لا مايك لا شات) |
| زعيم المافيا Boss | مافيا | بيرشّش القتل الليلي |
| جوكر Joker | مستقل | فوزه الخاص |
| ولد طيب Good Boy | مستقل | لما يتقتل ينتقم (Revenge) |
| منتقم Avenger | مستقل | يقتل قاتله |

### أحداث الشبكة (net.ts handlers):
- **rooms:** `room:join` (باسم أو توكن rejoin)، `room:rematch_vote`، `room:leave`
- **game:** `game:start`، `game:sync` (الحالة الكاملة)، `game:add_bot`، `game:request_play_again`
- **أفعال:** `action:night_ability`، `action:vote`، `action:mayor_reveal`، `action:good_boy_revenge`، `chat:send`، `reaction:send`
- **صوت (relay عبر الهوست):** `voice:join`، `voice:leave`، `voice:signal`، `voice:ice`
- **إشعارات من المحرك للاعبين:** `room:update` (الحالة)، `phase:change`، `action:request` (طلب فعل ليلي)، `game:started`، `night:result`، `vote:progress/result`، `voice:policy`، `voice:peer-joined/left`، `reaction:show`، `room:closed`

### سياسة الصوت (voice:policy) حسب المرحلة:
- LOBBY/GAME_OVER: الكل يسمع ويتكلم
- NIGHT: **قناة المافيا بس** (الأحياء من العيلة)
- DAY: المتهم/المدافع في DEFENSE/LAST_WORDS بس، والباقي سماع
- الموتى: قناة DEAD منفصلة

---

## 6) البيانات في Firestore

```
rooms/{CODE}/peers/host      → { alive: true, updatedAt: <نبضة كل 50ث> }
rooms/{CODE}/peers/{peerId}  → { offer, answer, candG[], candH[] }  (signaling مؤقت)
config/turn                  → { url, username, password }          (TURN وقت التشغيل)
```
- الأوضة تموت تلقائيًا لو الهوست قفل تابه (pagehide يمسح الحضور)
- الضيف اللي بييجي بعد كده يشوف "الأوضة مش موجودة أو اتقفلت" خلال ثواني

---

## 7) أوامر التشغيل والنشر

```bash
# تشغيل محلي (سيرفر التطوير — http://localhost:3000)
cd E:/mafia/client && npm run dev

# فحص الأنواع
cd E:/mafia/client && npx tsc --noEmit

# بناء الإنتاج (النتيجة في client/out/)
cd E:/mafia/client && npm run build

# نشر الواجهة على Firebase Hosting
cd E:/mafia/client && npx firebase-tools deploy --only hosting --config ../firebase.json --project mafia-b1d7e

# نشر قواعد Firestore
cd E:/mafia/client && npx firebase-tools deploy --only firestore:rules --config ../firebase.json --project mafia-b1d7e

# رفع الكود
git add -A && git commit -m "..." && git push origin main
```

### متغيرات البيئة (client/.env.local):
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=mafia-b1d7e.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=mafia-b1d7e
NEXT_PUBLIC_FIREBASE_APP_ID=...
# اختياري — لو موجود بيتجاهل مستند config/turn في Firestore:
NEXT_PUBLIC_TURN_URL=turn:host:port?transport=udp,turn:host:port?transport=tcp
NEXT_PUBLIC_TURN_USERNAME=...
NEXT_PUBLIC_TURN_PASSWORD=...
```

### تحديث بيانات TURN (بدون إعادة نشر):
Firebase Console → Firestore → `config/turn` → عدّل الحقول. أو من سكريبت Node بـ client SDK (القواعد بتصطف الكتابة).

---

## 8) المعايير والملاحظات المهمة للتعديل

1. **موبايل أولًا:** كل تعديل UI لازم يتست على viewport 390×844. الكروت على الطاولة بتتصغّر تلقائيًا فوق 8 لاعبين (`dense`)
2. **RTL:** كل النصوص عربية — استخدم `start/end` مش `left/right` في Tailwind
3. **framer-motion:** الأزرار المتحركة بتفشل مع clicks الآلي أحيانًا — في الاختبار اليدوي عادي
4. **الأصوات:** ملفات mp3/wav في public/assets/sounds — AudioContext لازم user gesture
5. **البوتات:** أسماء عربية (بوت حسن، بوت نجوان...) — بيتصرفوا تلقائيًا في الليل والتصويت
6. **الإشعارات:** Web Push عبر sw.js (احتاج سيرفر push حقيقي — حاليًا محلية بس)
7. **server/ وDockerfile legacy:** متتحطهمش — النشر كله Firebase

---

## 9) المشاكل المفتوحة المعروفة (وقت كتابة هذا الملف)

| المشكلة | الحالة |
|---|---|
| دخول جوجل محتاج تفعيل Google Provider من Firebase Console | ⏳ على المستخدم |
| اختبار الصوت على أجهزة حقيقية بعد آخر إصلاحات (peerList + autoplay unlock) | ⏳ محتاج تجربة المستخدم |
| تسخين الموبايل (الأصوات/الأنيميشن) | مؤجل |
| لو الهوست عمل reload للأوضة بتموت (المحرك في ذاكرته) | محدودية معمارية مقبولة حاليًا |

---

## 10) خلاصة سريعة لأي Agent

> افتح `client/src` — كل حاجة هناك. المحرك في `lib/engine/GameRoom.ts`، الشبكة في `lib/p2p.ts` + `lib/net.ts`، الحالة في `hooks/useMafiaGame.ts`. بناء بـ `npm run build`، نشر بـ `npx firebase-tools deploy --only hosting`، القواعد في `../firestore.rules`. اختبر على 390×844. اللينك الحي: **https://mafia-b1d7e.web.app**
