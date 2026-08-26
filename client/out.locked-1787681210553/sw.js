/* حارة المافيا: service worker للإشعارات (Web Push) */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* رسالة دفع وصلت — اعرضها بس لو مفيش تاب مرئي على نفس الأوضة */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'حارة المافيا';
  const body = data.body || '';
  const url = data.url || '/';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const alreadyVisible = windows.some(
        (win) => win.visibilityState === 'visible' && (url === '/' || (win.url || '').includes(url)),
      );
      if (alreadyVisible) return;
      await self.registration.showNotification(title, {
        body,
        dir: 'rtl',
        lang: 'ar',
        tag: 'mafia-game',
        renotify: true,
        icon: '/assets/roles/mayor.png',
        badge: '/assets/roles/mayor.png',
        data: { url },
      });
    })(),
  );
});

/* ضغطة على الإشعار — ركّز تاب الأوضة أو افتح واحدة جديدة */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const win of windows) {
        if (url !== '/' && (win.url || '').includes(url)) {
          await win.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

/* رسالة من الصفحة — إشعار محلي (التاب مخفي وماينفعش يعرض بنفسه) */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'MAFIA_LOCAL_NOTIFY') return;
  event.waitUntil(
    self.registration.showNotification(data.title || 'حارة المافيا', {
      body: data.body || '',
      dir: 'rtl',
      lang: 'ar',
      tag: 'mafia-game',
      icon: '/assets/roles/mayor.png',
      data: { url: data.url || '/' },
    }),
  );
});
