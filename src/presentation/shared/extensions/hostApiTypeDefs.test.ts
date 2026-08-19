import { describe, expect, it } from 'vitest';
import { HOST_MODULES } from './hostApi';
import { buildExtensionTypeDefs } from './extensionTypeDefs';

/**
 * `hostApi.ts` é o que o código de extensão ALCANÇA; `extensionTypeDefs.ts` é o que o editor DIZ que
 * ele alcança. Os dois arquivos carregam, um para o outro, um aviso de "manter sincronizado" — e até
 * aqui não havia nada cobrando.
 *
 * O defeito que isso deixa passar não tem sintoma no build: um componente acrescentado ao
 * `@microteia/ui` sem a declaração correspondente existe e funciona, mas o autocomplete não o oferece,
 * então ninguém o usa; e uma declaração de algo REMOVIDO é pior — o editor promete um símbolo que o
 * `require` do runtime não resolve, e a extensão só quebra quando alguém abre a tela.
 *
 * Os módulos do próprio ecossistema React (`react`, `react/jsx-*`, `styled-components`) são
 * deliberadamente PARCIAIS nas declarações: reproduzir os tipos completos do React seria copiar o
 * `@types/react` para dentro de um template literal. Para eles o teste confere só que o módulo é
 * declarado; para os `@microteia/*`, que são nossos, confere símbolo por símbolo.
 */
const DEFS = buildExtensionTypeDefs();

const declaredModules = new Set(
  [...DEFS.matchAll(/declare module '([^']+)'/g)].map((match) => match[1]),
);

/** O corpo de um `declare module`, do `{` até a chave que o fecha na coluna zero. */
const bodyOf = (name: string): string => {
  const start = DEFS.indexOf(`declare module '${name}' {`);
  if (start < 0) return '';
  const end = DEFS.indexOf('\n}', start);
  return DEFS.slice(start, end < 0 ? undefined : end);
};

const PARTIAL_BY_DESIGN = new Set([
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'styled-components',
]);

describe('a API curada do host e os tipos que o editor oferece', () => {
  it('todo módulo alcançável é declarado', () => {
    const missing = Object.keys(HOST_MODULES).filter((name) => !declaredModules.has(name));
    expect(missing, 'módulos em HOST_MODULES sem `declare module` em extensionTypeDefs').toEqual([]);
  });

  it('todo módulo declarado é alcançável', () => {
    const extra = [...declaredModules].filter((name) => !(name in HOST_MODULES));
    expect(extra, 'módulos declarados que o `require` da extensão não resolve').toEqual([]);
  });

  const ours = Object.keys(HOST_MODULES).filter((name) => !PARTIAL_BY_DESIGN.has(name));

  it.each(ours)('%s — todo símbolo exportado aparece na declaração', (name) => {
    const module = HOST_MODULES[name] as Record<string, unknown>;
    const body = bodyOf(name);
    const undeclared = Object.keys(module).filter(
      (symbol) => !new RegExp(`\\b${symbol}\\b`).test(body),
    );
    expect(undeclared, `símbolos de ${name} que o autocomplete não oferece`).toEqual([]);
  });

  /**
   * O `host` do `startup` não é módulo — chega por parâmetro —, então nenhuma das duas checagens
   * acima o cobre. Ele é o único caso em que a declaração existe sozinha, e por isso é o único que
   * precisa de uma verificação própria.
   */
  it('o `host` do startup é declarado como tipo global', () => {
    expect(DEFS).toContain('interface ExtensionHost {');
    for (const registry of ['commands', 'mentions', 'widgets', 'settings']) {
      expect(DEFS).toMatch(new RegExp(`${registry}: \\{ register:`));
    }
  });

  /** Guarda que não dispara é pior que guarda nenhuma. */
  it('o detector reconhece um símbolo que não foi declarado', () => {
    const body = bodyOf('@microteia/ui');
    expect(body).not.toBe('');
    expect(new RegExp('\\bComponenteQueNaoExiste\\b').test(body)).toBe(false);
    expect(bodyOf('@microteia/inexistente')).toBe('');
  });
});
