export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0a0806] px-4 py-12 text-slate-300" dir="rtl">
      <article className="mx-auto max-w-2xl leading-relaxed">
        <h1 className="mb-6 text-center font-serif text-3xl font-black text-gold-300">
          سياسة الخصوصية
        </h1>
        <p className="mb-4 text-sm text-slate-400">آخر تحديث: أغسطس 2026</p>

        <section className="mb-8">
          <h2 className="mb-2 font-serif text-lg font-bold text-gold-200">١. مقدمة</h2>
          <p className="text-sm">
            مرحبًا بك في لعبة &quot;حارة المافيا&quot;. نحن نحترم خصوصيتك ونلتزم بحمايتها بالكامل.
            هذه السياسة تشرح كيف نجمع البيانات ونستخدمها ونحافظ على سريتها.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 font-serif text-lg font-bold text-gold-200">٢. البيانات اللي بجمعها</h2>
          <ul className="list-disc space-y-1 pr-5 text-sm">
            <li>
              <strong className="text-slate-200">بيانات الحساب:</strong> اسم المستخدم والصورة اللي بتسجل بيها عبر Google أو Facebook أو كضيف.
            </li>
            <li>
              <strong className="text-slate-200">بيانات اللعب:</strong> سجل المباريات، النقاط، والمشتريات أو العناصر اللي حصلت عليها داخل اللعبة.
            </li>
            <li>
              <strong className="text-slate-200">بيانات الأجهزة:</strong> معلومات تقنية زي نوع الجهاز والمتصفح عشان نحسّن الأداء ونعالج أي مشاكل تقنية.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 font-serif text-lg font-bold text-gold-200">٣. استخدام البيانات</h2>
          <p className="text-sm">
            بنستخدم بياناتك عشان نشغّل اللعبة، نحسّن تجربتك، ونحفظ تقدمك.
            نحن لا نبيع بياناتك ولا نشاركها مع أي طرف ثالث لأغراض إعلانية أو تجارية.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 font-serif text-lg font-bold text-gold-200">٤. الأمان</h2>
          <p className="text-sm">
            بنستخدم تقنيات تشفير متقدمة لحماية بياناتك. جميع الاتصالات بين التطبيق وقواعد البيانات (Firebase) محمية بالكامل ببروتوكول HTTPS.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 font-serif text-lg font-bold text-gold-200">٥. حذف الحساب والبيانات</h2>
          <p className="text-sm">
            تقدر تحذف حسابك بالكامل من داخل اللعبة عن طريق زر &quot;حذف الحساب&quot; الموجود في قائمة الإعدادات.
            بمجرد تأكيد الحذف، يتم مسح كل بياناتك وتقدمك في اللعبة نهائيًا من خوادمنا ولا يمكن استرجاعها.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 font-serif text-lg font-bold text-gold-200">٦. التواصل معنا</h2>
          <p className="text-sm">
            لأي استفسار بخصوص سياسة الخصوصية، أو لتقديم طلب يدوي لحذف بياناتك، يمكنك التواصل مع مطور اللعبة (يوسف محمد) عبر البريد الإلكتروني:{' '}
            <a href="mailto:yoousafpoping@gmail.com" className="text-gold-400 underline decoration-gold-400/30 hover:text-gold-300">
              yoousafpoping@gmail.com
            </a>
          </p>
        </section>
      </article>
    </main>
  );
}
