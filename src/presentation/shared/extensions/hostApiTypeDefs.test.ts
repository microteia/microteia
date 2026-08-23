import { describe, expect, it } from 'vitest';
import { HOST_MODULES } from './hostApi';
import { buildExtensionTypeDefs } from './extensionTypeDefs';
// O contexto real chega como TEXTO, e não como tipo: o que precisa ser comparado é a lista de campos,
// e um tipo não existe em tempo de execução. `?raw` é o mesmo caminho pelo qual as fontes de view das
// extensões entram no bundle — e evita `node:fs`, que o projeto do app não tipa.
import CONTEXT_SOURCE from '../../components/ui/CommandPalette/providers/ICommandPaletteProvider.ts?raw';

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

/**
 * Os CAMPOS de uma interface, pelo recuo: eles são os únicos a começar em duas colunas seguidas de
 * `nome:` ou `nome?:`. Comentário de bloco começa com `*`, o que o exclui sozinho.
 */
const fieldsOf = (source: string, name: string): string[] => {
  const start = source.indexOf(`interface ${name} {`);
  if (start < 0) return [];
  const end = source.indexOf('\n}', start);
  const body = source.slice(start, end < 0 ? undefined : end);
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((match) => match[1]).sort();
};

/**
 * O contexto que um provedor de comando de EXTENSÃO recebe é o mesmo objeto que a paleta monta para os
 * provedores internos, e nada comparava os dois. O que isso deixou passar durou meses: a declaração
 * prometia `tenantRole`, que o RBAC tirou do runtime, e não oferecia `can`, que é o que ficou no lugar
 * — quem escrevia extensão contra o autocomplete comparava um papel que chegava `undefined`, e a
 * comparação simplesmente dava falso, sem erro em lugar nenhum.
 *
 * A direção da checagem é deliberada: tudo que a declaração PROMETE tem de existir no runtime, e não o
 * contrário. A paleta carrega campos que a extensão não deve alcançar — os que ainda nomeiam coleções
 * de negócio, à espera da última tela nativa a migrar —, e declará-los seria levar aquele vocabulário
 * para dentro do contrato de autoria.
 */
describe('o contexto de comando declarado e o que a paleta entrega', () => {
  it('todo campo prometido ao autor existe no contexto real', () => {
    const promised = fieldsOf(DEFS, 'MicroteiaCommandContext');
    const real = new Set(fieldsOf(CONTEXT_SOURCE, 'CommandPaletteAppContext'));
    expect(promised.length).toBeGreaterThan(0);
    expect(real.size).toBeGreaterThan(0);
    expect(
      promised.filter((field) => !real.has(field)),
      'campos que o editor promete e o runtime não entrega',
    ).toEqual([]);
  });

  it('a pergunta de autorização é por PERMISSÃO, e nenhum papel volta pela declaração', () => {
    const promised = fieldsOf(DEFS, 'MicroteiaCommandContext');
    expect(promised).toContain('can');
    expect(promised.filter((field) => /role/i.test(field))).toEqual([]);
  });

  /** Guarda que não dispara é pior que guarda nenhuma. */
  it('o extrator de campos reconhece o que não está lá', () => {
    expect(fieldsOf(DEFS, 'MicroteiaCommandContext')).not.toContain('tenantRole');
    expect(fieldsOf(CONTEXT_SOURCE, 'InterfaceQueNaoExiste')).toEqual([]);
  });
});
