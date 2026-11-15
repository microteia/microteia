/**
 * A pergunta "este script usa sintaxe de módulo?" sem transpilador nenhum.
 *
 * Mora separada de `scriptSource.ts` porque as DUAS pontas precisam dela e só uma pode arrastar o
 * `sucrase`: a gravação do Script (que transpila) e a fusão de scripts do SDK (`mergeScriptSources`),
 * que está no barril isomórfico — e o barril não carrega transpilador.
 */

/** Palavras depois das quais uma `/` abre expressão regular, e não divisão. */
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await']);

const REGEX_AFTER_CHAR = '(,=:[!&|?{};~^%*+-<>';

/**
 * O texto com comentários e literais (string, template, regex) trocados por espaço, preservando as
 * quebras de linha. É o que separa a PALAVRA `import` num comentário ou num `log('export done')` da
 * instrução `import` — a trava antiga olhava o texto cru e recusava as duas.
 *
 * É heurística de propósito, e o erro dela só pode ir para um lado aceitável: a trava existe para dar
 * uma mensagem explicável na gravação, não para conter nada — quem contém é o QuickJS. Uma regex que
 * o scanner não reconheça como regex, no pior caso, deixa passar um `import` que o sandbox recusa
 * depois com uma mensagem pior.
 */
export const stripCommentsAndLiterals = (source: string): string => {
  const out: string[] = [];
  const templateDepth: number[] = [];
  let braces = 0;
  let index = 0;
  let previous = '';

  const blank = (from: number, to: number): void => {
    out.push(source.slice(from, to).replace(/[^\n]/g, ' '));
  };

  const regexAllowed = (): boolean => {
    if (previous === '') return true;
    if (REGEX_AFTER_CHAR.includes(previous)) return true;
    if (!/[\w$]/.test(previous)) return false;
    const word = /([A-Za-z_$][\w$]*)\s*$/.exec(out.join(''));
    return word !== null && REGEX_AFTER_WORD.has(word[1]);
  };

  const skipQuoted = (start: number, quote: string): number => {
    let cursor = start + 1;
    while (cursor < source.length && source[cursor] !== quote && source[cursor] !== '\n') {
      cursor += source[cursor] === '\\' ? 2 : 1;
    }
    return Math.min(cursor + 1, source.length);
  };

  /** Consome o trecho LITERAL de um template até o fecho ou até um `${`, que volta a ser código. */
  const skipTemplateText = (start: number): number => {
    let cursor = start;
    while (cursor < source.length) {
      if (source[cursor] === '\\') { cursor += 2; continue; }
      if (source[cursor] === '`') return cursor + 1;
      if (source[cursor] === '$' && source[cursor + 1] === '{') {
        templateDepth.push(braces);
        braces += 1;
        return cursor + 2;
      }
      cursor += 1;
    }
    return source.length;
  };

  const skipRegex = (start: number): number => {
    let cursor = start + 1;
    let inClass = false;
    while (cursor < source.length && source[cursor] !== '\n') {
      const char = source[cursor];
      if (char === '\\') { cursor += 2; continue; }
      if (char === '[') inClass = true;
      else if (char === ']') inClass = false;
      else if (char === '/' && !inClass) break;
      cursor += 1;
    }
    cursor += 1;
    while (cursor < source.length && /[a-z]/i.test(source[cursor])) cursor += 1;
    return Math.min(cursor, source.length);
  };

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', index);
      const stop = end < 0 ? source.length : end;
      blank(index, stop);
      index = stop;
      continue;
    }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const stop = end < 0 ? source.length : end + 2;
      blank(index, stop);
      index = stop;
      continue;
    }

    let stop = -1;
    if (char === '"' || char === "'") stop = skipQuoted(index, char);
    else if (char === '`') stop = skipTemplateText(index + 1);
    else if (char === '}' && templateDepth.length > 0 && templateDepth[templateDepth.length - 1] === braces - 1) {
      templateDepth.pop();
      braces -= 1;
      stop = skipTemplateText(index + 1);
    } else if (char === '/' && regexAllowed()) stop = skipRegex(index);

    if (stop >= 0) {
      blank(index, stop);
      index = stop;
      previous = 'x';
      continue;
    }

    if (char === '{') braces += 1;
    else if (char === '}') braces -= 1;
    out.push(char);
    if (!/\s/.test(char)) previous = char;
    index += 1;
  }

  return out.join('');
};

/**
 * `import`/`export` como PALAVRA-CHAVE e `require(...)`. Como as duas primeiras são reservadas, fora
 * de comentário e literal só aparecem como instrução — ou como nome de propriedade (`obj.import`,
 * `{ export: 1 }`), que as duas exclusões deixam passar.
 */
const MODULE_SYNTAX = /(?<![.\w$])(?:import|export)\b(?!\s*:)|(?<![.\w$])require\s*\(/;

/** Diz se o script usa sintaxe de módulo — o que o sandbox não sabe resolver. */
export const usesModuleSyntax = (sourceTs: string): boolean =>
  MODULE_SYNTAX.test(stripCommentsAndLiterals(sourceTs));
