// Extensões da INSTALAÇÃO, carregadas ANTES do login. Este arquivo é carimbado pelo Console da
// Microteia, na máquina de quem instala, com os pacotes listados em `login.extensions` do
// `microteia.yaml`:
//
//   window.__MICROTEIA_EXTENSIONS__ = [ { manifest: {...}, views: [...] }, ... ];
//
// Aqui no repositório ele fica VAZIO de propósito: sem `__MICROTEIA_EXTENSIONS__` definido, o host
// base carrega só os plugins do núcleo, e `npm run dev` e os builds com TARGET seguem exatamente
// como antes.
//
// Nada carimbado aqui roda JavaScript: os pacotes entram no Kernel como `trusted: false`, e só
// declaração passa. Ver "A origem pré-login" no ARCHITECTURE.md.
