// Identidade da INSTALAÇÃO — o produto que ela é para quem a usa. Este arquivo é carimbado pelo
// Console da Microteia, na máquina de quem instala, a partir do bloco `brand:` do `microteia.yaml`:
//
//   globalThis.__MICROTEIA_BRAND__ = {
//     name: 'Acme Legal', tagline: '...', description: '...',
//     logo: '/brand/logo-1a2b3c4d.png', accent: '#1f6feb', appIcon: '/brand/logo-1a2b3c4d.png',
//   };
//
// Também o importa o service worker das notificações (notification-sw.js), e por isso é `globalThis`.
//
// Aqui no repositório ele fica VAZIO de propósito: sem `__MICROTEIA_BRAND__` definido, a instalação
// é a própria Microteia, e `npm run dev` e os builds com TARGET seguem exatamente como antes — a não
// ser que exista a pasta `brand/` na raiz (ver vite.config.ts). Ver "Identidade da instalação" no
// ARCHITECTURE.md.
