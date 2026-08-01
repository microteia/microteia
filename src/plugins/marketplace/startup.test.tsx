// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { compileExtensionStartup } from '../../presentation/shared/extensions/evaluateExtensionView';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { contratoPlugin } from './contrato';
import { financeiroPlugin } from './financeiro';
import { pessoaPlugin } from './pessoa';
import { processoPlugin } from './processo';

interface Registro {
  commands: { getItems: (query: string, ctx: unknown) => { id: string; title: string; subtitle?: string }[] }[];
  mentions: { key: string; search: (query: string, ctx: unknown) => { id: string; title: string }[] }[];
}

const rodarStartup = (plugin: MarketplacePlugin): Registro => {
  const registro: Registro = { commands: [], mentions: [] };
  const host = {
    commands: { register: (provider: Registro['commands'][number]) => registro.commands.push(provider) },
    mentions: { register: (provider: Registro['mentions'][number]) => registro.mentions.push(provider) },
  };
  const compilado = compileExtensionStartup(plugin.startup ?? '');
  expect(compilado.ok ? '' : compilado.error, plugin.manifest.id).toBe('');
  if (compilado.ok) compilado.startup(host as never);
  return registro;
};

const contexto = (plugin: MarketplacePlugin, records: Record<string, unknown>[]) => {
  const screen = plugin.screens?.[0];
  return {
    screenDefinitions: [{
      id: screen?.key,
      sourceId: screen?.sourceId,
      dataCollection: screen?.dataCollection,
      titleFieldKey: screen?.titleFieldKey,
      subtitleFieldKey: screen?.subtitleFieldKey,
    }],
    records: records.map((record) => ({ ...record, collection: screen?.dataCollection })),
    openTab: () => {},
    close: () => {},
  };
};

/**
 * O ⌘K e a menção são a única porta de entrada por TECLADO para um registro. Uma extensão que traz
 * uma entidade e esquece de registrá-los deixa a entidade fora da busca do escritório — foi o que
 * aconteceu com Pessoas, que só registrava a menção.
 */
describe('startup das extensões de entidade', () => {
  it.each([
    ['Pessoas', pessoaPlugin],
    ['Processos', processoPlugin],
    ['Contratos', contratoPlugin],
    ['Financeiro', financeiroPlugin],
  ])('%s registra comandos de ⌘K e menção', (_nome, plugin) => {
    const { commands, mentions } = rodarStartup(plugin);
    expect(commands).toHaveLength(1);
    expect(mentions).toHaveLength(1);
  });

  it('o comando abre a listagem e o cadastro da tela instalada', () => {
    const { commands } = rodarStartup(pessoaPlugin);
    const items = commands[0].getItems('pessoa', contexto(pessoaPlugin, []));
    expect(items.map((item) => item.id)).toEqual(['pessoa:new', 'pessoa:list']);
  });

  /**
   * Quem casa o subtítulo é quem o usa como IDENTIFICADOR: o número do processo, o do contrato.
   * Onde ele é classificação (o tipo da pessoa, o do lançamento), a busca fica só no título — casá-lo
   * devolveria o cadastro inteiro a quem digitasse "fis".
   */
  it('busca pelo subtítulo só onde ele identifica o registro', () => {
    const processo = rodarStartup(processoPlugin).commands[0];
    const registros = [{ id: 'c1', title: 'Ação de Cobrança', caseNumber: '938333' }];
    expect(processo.getItems('938', contexto(processoPlugin, registros)).map((i) => i.id)).toEqual(['processo:c1']);
    expect(processo.getItems('cobran', contexto(processoPlugin, registros)).map((i) => i.id)).toEqual(['processo:c1']);

    const pessoa = rodarStartup(pessoaPlugin).commands[0];
    const pessoas = [{ id: 'p1', name: 'Maria', type: 'Pessoa Física' }];
    expect(pessoa.getItems('maria', contexto(pessoaPlugin, pessoas)).map((i) => i.id)).toEqual(['pessoa:p1']);
    expect(pessoa.getItems('fis', contexto(pessoaPlugin, pessoas))).toEqual([]);

    const contrato = rodarStartup(contratoPlugin).commands[0];
    const contratos = [{ id: 'k1', title: 'Aluguel', number: 'AB1234' }];
    expect(contrato.getItems('alug', contexto(contratoPlugin, contratos)).map((i) => i.id)).toEqual(['contrato:k1']);
    expect(contrato.getItems('ab12', contexto(contratoPlugin, contratos)).map((i) => i.id)).toEqual(['contrato:k1']);

    const financeiro = rodarStartup(financeiroPlugin).commands[0];
    const lancamentos = [{ id: 'f1', category: 'Honorários', type: 'Receita' }];
    expect(financeiro.getItems('honor', contexto(financeiroPlugin, lancamentos)).map((i) => i.id)).toEqual(['financeiro:f1']);
    expect(financeiro.getItems('receita', contexto(financeiroPlugin, lancamentos))).toEqual([]);
  });

  it('o resultado mostra o subtítulo do registro, mesmo onde a busca não o casa', () => {
    const pessoa = rodarStartup(pessoaPlugin).commands[0];
    const items = pessoa.getItems('maria', contexto(pessoaPlugin, [{ id: 'p1', name: 'Maria', type: 'Pessoa Física' }]));
    expect(items[0].subtitle).toBe('Pessoa Física');
  });

  it('sem a tela instalada, nada é oferecido', () => {
    const { commands } = rodarStartup(processoPlugin);
    const items = commands[0].getItems('processo', { screenDefinitions: [], records: [], openTab: () => {}, close: () => {} });
    expect(items).toEqual([]);
  });
});
