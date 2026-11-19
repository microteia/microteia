/*
 * Service worker do push do Microteia. Só desenha o que o servidor mandou — título e texto já vêm no
 * idioma de quem recebe — e, no clique, foca a aba aberta ou abre a aplicação na aba indicada.
 */

/*
 * O ícone é o da INSTALAÇÃO, carimbado em brand.js pelo `microteia deploy` — o mesmo arquivo que a
 * página lê. Importá-lo também faz o navegador reinstalar este worker quando a identidade muda.
 * O try existe por um carimbo anterior ao Console 2.47.0, que escrevia em `window` e aqui lançaria
 * — sem ele o worker nem se instala, e a pessoa fica sem notificação nenhuma.
 */
try {
  importScripts('/brand.js');
} catch {
  // Sem identidade legível: fica o ícone da plataforma.
}

const PLATFORM_ICON = '/web-app-manifest-192x192.png';
const PLATFORM_BADGE = '/favicon-96x96.png';

/** Só caminho da própria origem, pela mesma razão do leitor da página (domain/schema/brand.ts). */
const sameOriginPath = (value) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : null;

const stamped = typeof self.__MICROTEIA_BRAND__ === 'object' && self.__MICROTEIA_BRAND__ !== null
  ? self.__MICROTEIA_BRAND__
  : null;
const branded = stamped !== null && typeof stamped.name === 'string' && stamped.name.trim() !== '';
const icon = (branded && sameOriginPath(stamped.appIcon)) || PLATFORM_ICON;
// O badge do Android é uma silhueta tirada da transparência da imagem, e um logo colorido vira um
// quadrado branco. Com identidade própria, nenhum badge: o navegador põe o dele, neutro, em vez da
// silhueta da Microteia.
const badge = branded ? undefined : PLATFORM_BADGE;

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
      icon,
      badge,
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
