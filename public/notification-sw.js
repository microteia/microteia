/*
 * Service worker do push do Microteia. Só desenha o que o servidor mandou — título e texto já vêm no
 * idioma de quem recebe — e, no clique, foca a aba aberta ou abre a aplicação na aba indicada.
 */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === 'string' ? payload.title : '';
  if (!title) return;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof payload.body === 'string' ? payload.body : '',
      tag: typeof payload.tag === 'string' ? payload.tag : undefined,
      icon: '/web-app-manifest-192x192.png',
      badge: '/favicon-96x96.png',
      data: { link: typeof payload.link === 'string' ? payload.link : '' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '';
  const target = new URL(link ? `/${String(link).replace(/^\/+/, '')}` : '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        if (link && 'navigate' in open) return open.navigate(target).then((client) => client && client.focus());
        return open.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
