# 🚀 دليل النشر الكامل — حارة المافيا

الخطة: **السيرفر على Render** + **الواجهة على Netlify أو Vercel**، والكود على GitHub.

> الكلاينت Next.js (مش Vite) — فالمتغير الصح للسيرفر هو `NEXT_PUBLIC_SERVER_URL`
> وهو متوصّل أصلًا في `client/src/lib/socket.ts` — مفيش أي كود هيتغير.

---

## 1) ارفع الكود على GitHub

```bash
cd E:\mafia

# لو أول مرة (المشروع لسه مش git repo)
git init
git add .
git commit -m "حارة المافيا — جاهز للنشر"
git branch -M main

# اعمل repository فاضي على github.com بالاسم mafia ثم:
git remote add origin https://github.com/USERNAME/mafia.git
git push -u origin main
```

> `.gitignore` بيمنع `node_modules` و`.env*` و`.next` ومجلد `data/` (بيانات التشغيل مش للـ git).

---

## 2) الباك إند على Render (Node.js Web Service)

1. من [render.com](https://render.com) → **New +** → **Web Service**.
2. اربط حساب GitHub واختار الـ repository بتاعك.
3. الإعدادات بالظبط:

| الإعداد | القيمة |
|---|---|
| **Name** | `mafia-server` |
| **Region** | الأقرب لك (Frankfurt للشرق الأوسط) |
| **Branch** | `main` |
| **Runtime** | Node |
| **Root Directory** | `(فاضي — جذر الريبو)` |
| **Build Command** | `npm install` |
| **Start Command** | `node server/index.js` |
| **Health Check Path** | `/health` |
| **Instance Type** | Free (أو أعلى للإنتاج الجدي) |

4. **Environment Variables** (Environment → Add):

```
CLIENT_URL = https://<موقعك>.netlify.app   # رابط الفرونت بعد خطوة 3 (شوف الملاحظة تحت)
NODE_ENV = production
```

5. اضغط **Create Web Service** وانتظر أول Build.
6. احفظ رابط الخدمة: `https://mafia-server-xxxx.onrender.com` — هنستخدمه في Vercel.

> 🔁 **ترتيب الدجاجة والبيضة**: نزّل السيرفر الأول ولو `CLIENT_URL` لسه مش عندك
> سيبه فاضي أو حط `*` مؤقتًا، وبعد ما Vercel يديك الرابط ارجع اظبطه واعمل
> **Manual Deploy → Deploy latest commit**.

### 🎩 سيرفر الـ PeerJS (فتح الأوضات) — جوه نفس الخدمة
الأوضات P2P (هوست المتصفح هو السيرفر) بس PeerJS محتاج **broker** للتعارف الأولي.
السيرفر ده مركّب جوه خدمة Render نفسها على مسار `/peerjs` — **مفيش خدمة إضافية**،
ومفيش اعتماد على السحابة العامة `0.peerjs.com`. الكلاينت بيتوصل بيه عبر
`NEXT_PUBLIC_PEER_SERVER` (شوف خطوة 3).

اختبار سريع بعد النشر: `curl https://mafia-server-xxxx.onrender.com/peerjs/peerjs/id?ts=1`
لازم يرجّع أي ID عشوائي.

<details>
<summary>بديل: نشر <code>server/peerjs</code> كخدمة منفصلة</summary>

لو حابب broker مستقل (مثلًا لو سيرفر اللعبة مزدحم): Render → Web Service →
Root Directory `server/peerjs`، Build `npm install`، Start `node index.js`.
وبعدين استخدم رابطه في `NEXT_PUBLIC_PEER_SERVER` من غير `/peerjs` في الآخر
(السيرفر المستقل بيضيف المسار بنفسه).
</details>

### ✅ اختبر السيرفر بعد النشر

```bash
curl https://mafia-server-xxxx.onrender.com/health
# المفروض يرجّع: {"status":"ok",...}
```

### 💾 مهم: بيانات ملفية على Render
الباك إند بيخزن البروفايلات ومفاتيح VAPID واشتراكات الإشعارات في مجلد `data/`.
**الـ Free tier ملفاته مؤقتة** (بتتمسح مع كل restart) — للإنتاج:
- Render → خدمتك → **Disks** → Add Disk → Mount Path `/var/data`
- ضيف Environment Variable: `DATA_DIR=/var/data`

من غير الديسك الدائم: الصدارة والبروفايلات بتتصفّر مع كل إعادة تشغيل (اللعب نفسه مش بيتأثر).

---

## 3) الفرونت إند — اختار واحد: Netlify أو Vercel

### الخيار (أ) — Netlify

1. من [netlify.com](https://netlify.com) → **Add new site → Import an existing project** → اربط GitHub → اختار الـ repository.
2. الإعدادات:

| الإعداد | القيمة |
|---|---|
| **Base directory** | `client` |
| **Build command** | `npm run build` (افتراضي — ومثبّت في `client/netlify.toml`) |
| **Publish directory** | `out` (static export) |

   (ملف `client/netlify.toml` موجود أصلًا وبيثبت الإعدادات + كاش الأصول والإشعارات.)

3. **Environment Variables** (Site configuration → Environment variables → Production):

```
NEXT_PUBLIC_SERVER_URL = https://mafia-server-xxxx.onrender.com
NEXT_PUBLIC_PEER_SERVER = https://mafia-server-xxxx.onrender.com/peerjs
```

4. **Deploy** — وانتظر البناء.
5. خد رابطك `https://<اسم-موقعك>.netlify.app` → **ارجع لـ Render** وحطه في `CLIENT_URL` → redeploy السيرفر.

> ⚠️ **مهم**: Netlify بيستضيف الواجهة **فقط**. سيرفر اللعبة (الأوضات
> والسوكت والصوت) عملية دايمة لازم تشتغل على Render — Netlify Functions
> مش مكان للسيرفر ده. يعني الاتنين مع بعض: Netlify (واجهة) + Render (سيرفر).

### الخيار (ب) — Vercel

1. من [vercel.com](https://vercel.com) → **Add New → Project** → اربط GitHub → اختار الـ repository.
2. الإعدادات:

| الإعداد | القيمة |
|---|---|
| **Framework Preset** | Next.js (بيتعرف لوحده) |
| **Root Directory** | `client` |
| **Build Command** | `next build` (افتراضي) |
| **Output Directory** | (افتراضي) |

3. **Environment Variables** (لكل البيئات Production + Preview):

```
NEXT_PUBLIC_SERVER_URL = https://mafia-server-xxxx.onrender.com
NEXT_PUBLIC_PEER_SERVER = https://mafia-server-xxxx.onrender.com/peerjs
```

4. اضغط **Deploy** وانتظر البناء.
5. خد رابطك `https://your-mafia-app.vercel.app` → **ارجع لـ Render** وحطه في `CLIENT_URL` → redeploy السيرفر.

> المتغير ده بيتبني جوه الـ bundle وقت الـ build — لو غيّرت رابط السيرفر لازم
> تعمل **Redeploy** للفرونت عشان يتفعّل.
> `client/.env.production` فيه placeholder مرجعي — قيم الـ Dashboard بتتغلب عليه.

### ✅ اختبر الفرونت
افتح رابط Vercel في المتصفح: لازم تلاقي "بنوصل بالسيرفر..." تختفي وتيجي الرئيسية.
افتح DevTools → Console: مفيش أخطاء CORS أو socket.

---

## 4) إعدادات اختيارية للإنتاج

### تسجيل دخول جوجل حقيقي (Firebase)
من غير المفاتيح دي اللعبة شغالة بالوضع المحلي. لتفعيل جوجل الحقيقي — Firebase Console
→ Project → Authentication → Google → Enable، وبعدين ضيف في **Vercel**:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### ملاحظات تشغيلية
- **Free tier على Render بينام بعد 15 دقيقة خمول** — أول زاير بيستنى ~30-50 ثانية
  لصحيان الخدمة. للإنتاج الجدي خطة Starter على الأقل.
- WebSockets شغالة على Render من غير إعداد.
- عناوين الإشعارات وVAPID بتتولد تلقائيًا أول تشغيل — لو الـ `data/` اتمسحت
  الاشتراكات القديمة بتنزل لوحدها (server بينضفها) والمفاتيح بتتجدد.
- تحديث النشر: `git push` — البلاتفورمين بيبنوا أوتوماتيك.

---

## 5) مرجع متغيرات البيئة الكامل

### Render (الباك إند)
| المتغير | إجباري؟ | القيمة |
|---|---|---|
| `PORT` | بيتحقن تلقائي | Render بيحدده |
| `CLIENT_URL` | ✅ نعم | رابط Netlify/Vercel |
| `DATA_DIR` | للإنتاج | `/var/data` (مع Disk) |
| `CORS_ORIGIN` | بديل | قائمة بفواصل بتغلب `CLIENT_URL` |

### الواجهة (Netlify/Vercel)
| المتغير | إجباري؟ | القيمة |
|---|---|---|
| `NEXT_PUBLIC_SERVER_URL` | ✅ نعم | رابط Render |
| `NEXT_PUBLIC_PEER_SERVER` | ✅ نعم | رابط Render + `/peerjs` |
| `NEXT_PUBLIC_FIREBASE_*` | اختياري | مفاتيح Firebase |

> ⚠️ المتغيرات دي بتتخبز جوه الـ bundle وقت البناء — أي تغيير بيحتاج rebuild
> للفرونت (Deploy → Trigger deploy على Netlify أو Redeploy على Vercel).

---

## 6) التشغيل المحلي (3 تيرمينالات)

```bash
# 1) سيرفر اللعبة (Socket.io + بروفايلات) — بورت 4000
npm run dev

# 2) سيرفر PeerJS المستقل (signaling للأوضات) — بورت 9000
cd server/peerjs && npm install && npm run dev

# 3) الواجهة — بورت 3000 (بيتوصل تلقائيًا بالاتنين)
cd client && npm run dev
```

> الكلاينت على localhost بيتوصل بـ `localhost:9000/peerjs` تلقائيًا حتى لو
> `NEXT_PUBLIC_PEER_SERVER` مش متظبط.

---

## 7) سيرفر TURN (عبور الشبكات — موبايل داتا ↔ وايفاي)

الاتصال P2P بين شبكتين مختلفتين محتاج TURN relay غير الـ STUN.
الإعدادات بتتقرأ **وقت التشغيل** من مستند Firestore `config/turn`
(مش محتاجة إعادة نشر):

```
config/turn {
  url:      "turn:free.expressturn.com:3478?transport=udp,turn:free.expressturn.com:3478?transport=tcp",
  username: "...",
  password: "..."
}
```

- المصدر: حساب مجاني في [expressturn.com](https://www.expressturn.com/) (1000GB/شهر)
- لو البيانات اتغيرت (Refresh Credentials من الـ dashboard): حدّث المستند من
  Firebase Console → Firestore → `config/turn` — أو أعد تشغيل سكريبت كتابة.
- من غير المستند ده اللعبة شغالة عادي على نفس الشبكة (STUN فقط).
- أولوية أعلى للمتغيرات: `NEXT_PUBLIC_TURN_URL/USERNAME/PASSWORD` في `.env.local`
  بتتجاهل المستند (بتيجي مدموجة في البناء).

## 8) قواعد Firestore

`firestore.rules` — نشرها بأمر:
```bash
cd client && npx firebase-tools deploy --only firestore:rules --config ../firebase.json --project mafia-b1d7e
```
