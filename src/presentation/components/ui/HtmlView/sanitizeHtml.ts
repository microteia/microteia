/**
 * A limpeza do HTML de terceiro. É a SEGUNDA linha de defesa, nunca a única: quem de fato impede o
 * conteúdo de agir é o `<iframe sandbox>` do `HtmlView`, que não concede `allow-scripts` nem
 * `allow-same-origin` — script ali não roda, e se rodasse não alcançaria nossa origem, nosso DOM nem
 * o token guardado no `localStorage`.
 *
 * Essa ordem importa. Limpeza por texto de HTML de terceiro é uma corrida que o defensor não vence:
 * comentário condicional, atributo com entidade HTML (`onclick&#61;`), `<svg><script>`, `<style>` com
 * `url(javascript:)`. Aqui ela serve para o conteúdo chegar SÓBRIO — sem o que claramente não é
 * texto de e-mail —, e não para torná-lo seguro; a segurança está no isolamento.
 */
const STRIPPED_ELEMENTS = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form'];

const stripElement = (html: string, tag: string): string =>
  html
    .replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '')
    .replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');

export const sanitizeHtml = (html: string): string => {
  let out = html.replace(/<!--[\s\S]*?-->/g, '');
  for (const tag of STRIPPED_ELEMENTS) out = stripElement(out, tag);
  return out
    // Manipuladores de evento, com e sem aspas.
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    // Esquemas executáveis, inclusive quebrados por espaço ou entidade (`java\tscript:`).
    .replace(/(javascript|vbscript|data)\s*(&#58;|&colon;|:)/gi, 'bloqueado:');
};
