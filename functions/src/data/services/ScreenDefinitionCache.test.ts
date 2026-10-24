import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { ScreenDefinitionCache } from './ScreenDefinitionCache';
import { resolveEntityKeys } from '../../domain/schema/screenEntity';
import { resolveEditWindow } from '../../domain/schema/editWindow';

/**
 * O cache lê o DOCUMENTO da tela como está gravado no Firestore. É este mapeamento — e não a conta da
 * chave, que tem os próprios testes sobre um `SchemaScreen` montado à mão — que decide o que a
 * automação, o agente, o portal e a adoção enxergam. Uma propriedade esquecida aqui some no backend
 * inteiro sem erro nenhum: foi o que aconteceu com `keys`.
 */
const fakeDb = (collections: Record<string, Record<string, Record<string, unknown>>>): Firestore => ({
  collection: (path: string) => ({
    get: async () => ({
      docs: Object.entries(collections[path] ?? {}).map(([id, data]) => ({ id, data: () => data })),
    }),
  }),
}) as unknown as Firestore;

const contextOf = (screens: Record<string, Record<string, unknown>>) =>
  new ScreenDefinitionCache(fakeDb({ 'tenants/t1/screenDefinitions': screens })).getSchemaContext('t1');

const field = (key: string) => ({ key, label: key, type: 'text', required: false, order: 0, origin: 'plugin' });

describe('ScreenDefinitionCache — o documento da tela como o backend o enxerga', () => {
  it('a chave declarada na TELA chega ao backend, inclusive composta e com escopo de pai', async () => {
    const ctx = await contextOf({
      movimentacoes: {
        titleSingular: 'Movimentação',
        titleFieldKey: 'movementType',
        fields: [field('caseId'), field('date'), field('time'), field('movementType')],
        keys: [{ name: 'fato', kind: 'unique', fields: ['date', 'time', 'movementType'], scope: 'parent', sparse: false }],
      },
    });
    expect(resolveEntityKeys(ctx, 'movimentacoes')).toEqual([
      { name: 'fato', kind: 'unique', fields: ['date', 'time', 'movementType'], scope: 'parent', sparse: false },
    ]);
  });

  it('a chave vale para a COLEÇÃO que a tela descreve (`dataCollection`)', async () => {
    const ctx = await contextOf({
      pessoas: {
        dataCollection: 'persons',
        titleSingular: 'Pessoa',
        titleFieldKey: 'name',
        fields: [field('name'), field('cpf')],
        keys: [{ name: 'cpf', kind: 'unique', fields: ['cpf'], normalize: { formatPreset: 'digits' } }],
      },
    });
    expect(resolveEntityKeys(ctx, 'persons').map((key) => key.name)).toEqual(['cpf']);
  });

  it('entrada estragada é descartada sem derrubar as outras; sem `keys`, sem chave', async () => {
    const ctx = await contextOf({
      processos: {
        titleSingular: 'Processo',
        titleFieldKey: 'caseNumber',
        fields: [field('caseNumber')],
        keys: [{ name: 'numero', kind: 'unique', fields: ['caseNumber'] }, { name: 'sem-campos' }, 'lixo'],
      },
      notas: { titleSingular: 'Nota', titleFieldKey: 'texto', fields: [field('texto')] },
    });
    expect(resolveEntityKeys(ctx, 'processos').map((key) => key.name)).toEqual(['numero']);
    expect(resolveEntityKeys(ctx, 'notas')).toEqual([]);
  });

  it('a janela de edição e os campos de membro chegam como a regra do Firestore os lê', async () => {
    const ctx = await contextOf({
      mensagens: {
        titleSingular: 'Mensagem',
        titleFieldKey: 'texto',
        fields: [field('texto')],
        editWindow: { minutes: 15, delete: true },
        memberWritableFields: ['lida'],
      },
    });
    expect(resolveEditWindow(ctx, 'mensagens')).toEqual({
      spec: { minutes: 15, delete: true },
      memberWritableFields: ['lida'],
    });
  });
});
