# أصول المتجر — دليل المقاسات (لصور الـ AI)

النظام بيقرأ مسارات الصور من الكتالوج على السيرفر: `src/profiles/catalog.js` (حقل `image`).
أي ملف PNG/WebP/SVG تحطه في المسار الصح بيشتغل على طول — متحطش صور في الكود.

## إطارات الكروت — `frames/`
- **المقاس:** 512×768 بكسل (نسبة 2:3) — نفس نسبة كارت اللعب
- **الشفافية:** PNG أو WebP بخلفية شفافة، **الوسط لازم يفضل شفاف** عشان وش الكارت يبان من تحته
- **الحدود:** سمك الزخرفة 30–40 بكسل من كل ضلع (الأركان أهم — هي اللي بتبان في المعاينة الصغيرة)
- **التسمية:** `frame-<الاسم>.svg` أو `.png` — وبعدين ضيف سطر في الكتالوج:
  ```js
  { id: 'frame-myai', type: 'cardFrame', name: 'إطار جديد', price: 800, rarity: 'epic', image: '/assets/frames/frame-myai.png' },
  ```
- **ستايل مقترح للبرومبت:** ornate card border, mafia noir art-deco, gold filigree corners, transparent center, dark background elements only

## خلفيات الترابيزة — `backgrounds/`
- **المقاس:** 1920×1080 (نسبة 16:9) — بتتعرض بـ `background-size: cover`
- **مهم:** متعملش حاجة فاتحة — الواجهة فوقها نصوص فاتحة. أغمق من `#333` في المتوسط
- **التسمية:** `bg-<الاسم>.jpeg|.png|.svg` + سطر في الكتالوج بـ `type: 'background'`

## إيموجي التفاعلات — `emojis/`
- **المقاس:** مربع 128×128 أو أكبر، خلفية شفافة، الموضوع في نص الكانفاس
- **التسمية:** `<reaction>_3d.svg` — وريأكشن id بدون `_3d`
- **خطوة إضافية:** ضيف الـ id في `REACTION_IDS` في `client/src/lib/reactions.ts` وفي `src/game/GameRoom.js` و`client/src/lib/engine/GameRoom.ts`

## صناديق الحظ — `boxes/`
- **المقاس:** مربع 256×256، خلفية شفافة
- **لازم كمان:** `odds: { common, rare, epic, legendary }` في سطر الكتالوج (نسب مئوية مجموعها 100)

## ملاحظات
- الأسعار بالكوينز افتراضيًا؛ لعملة الجواهر ضيف `currency: 'gems'`
- الـ rarity المتاح: `common | rare | epic | legendary` — بتحكم في أوزان الصناديق وألوان الشارات
- الصور دي بتتخزن في `client/public/assets/` وتتبني مع السايت (cached بـ immutable على Firebase Hosting — غيّر اسم الملف لو بدّلت صورة بنفس الـ id)
