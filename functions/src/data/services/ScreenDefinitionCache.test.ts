import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { ScreenDefinitionCache } from './ScreenDefinitionCache';
import { resolveEntityKeys } from '../../domain/schema/screenEntity';
import { resolveEditWindow } from '../../domain/schema/editWindow';
import { resolveMemberVisibility } from '../../domain/schema/memberVisibility';

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
  doc: () => ({ get: async () => ({ exists: false, get: () => undefined }) }),
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

  it('a visibilidade por registro chega como a regra a lê — e a malformada, fechada', async () => {
    const ctx = await contextOf({
      respostas: {
        titleSingular: 'Resposta',
        titleFieldKey: 'texto',
        fields: [field('texto')],
        memberVisibility: { userFields: ['emissor', 3, 'equipe'], bypassPermission: 'respostas.supervise' },
      },
      quebrada: { titleSingular: 'Quebrada', titleFieldKey: 'texto', fields: [field('texto')], memberVisibility: 'emissor' },
      aberta: { titleSingular: 'Aberta', titleFieldKey: 'texto', fields: [field('texto')] },
    });
    expect(resolveMemberVisibility(ctx, 'respostas'))
      .toEqual({ userFields: ['emissor', 'equipe'], bypassPermission: 'respostas.supervise' });
    expect(resolveMemberVisibility(ctx, 'quebrada')).toEqual({ userFields: [] });
    expect(resolveMemberVisibility(ctx, 'aberta')).toBeNull();
  });
});

/**
 * Um banco que ANOTA a ordem das leituras e deixa o teste mudar a tela e o carimbo entre uma chamada e
 * outra — o que, em produção, outra instância faria.
 */
const liveDb = () => {
  const state = {
    screens: { a: { titleSingular: 'A', titleFieldKey: 'name', fields: [field('name')] } } as Record<string, Record<string, unknown>>,
    revision: 1 as number | undefined,
    reads: [] as string[],
  };
  const db = {
    collection: (path: string) => ({
      get: async () => {
        state.reads.push(path.split('/').pop() ?? path);
        const docs = path.endsWith('/screenDefinitions') ? state.screens : {};
        return { docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data })) };
      },
    }),
    doc: (path: string) => ({
      get: async () => {
        state.reads.push(path.split('/').pop() ?? path);
        return { exists: state.revision !== undefined, get: () => state.revision };
      },
    }),
  } as unknown as Firestore;
  return { db, state };
};

const screenIds = async (cache: ScreenDefinitionCache) => (await cache.getScreens('t1')).map((screen) => screen.id);

describe('ScreenDefinitionCache — a tela gravada em outra instância (#58)', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('dentro do intervalo de conferência, não lê nada: nem o carimbo', async () => {
    vi.useFakeTimers();
    const { db, state } = liveDb();
    const cache = new ScreenDefinitionCache(db, 300_000, 5_000);
    await cache.getScreens('t1');
    state.reads.length = 0;
    vi.advanceTimersByTime(4_000);
    await cache.getScreens('t1');
    expect(state.reads).toEqual([]);
  });

  it('carimbo igual: confere com UMA leitura e mantém a cópia', async () => {
    vi.useFakeTimers();
    const { db, state } = liveDb();
    const cache = new ScreenDefinitionCache(db, 300_000, 5_000);
    await cache.getScreens('t1');
    state.reads.length = 0;
    state.screens = { ...state.screens, b: { titleSingular: 'B', titleFieldKey: 'name', fields: [field('name')] } };
    vi.advanceTimersByTime(6_000);
    expect(await screenIds(cache)).toEqual(['a']);
    expect(state.reads).toEqual(['schema_revision']);
  });

  it('carimbo novo: relê a declaração muito antes do TTL — a tela nova chega ao backend', async () => {
    vi.useFakeTimers();
    const { db, state } = liveDb();
    const cache = new ScreenDefinitionCache(db, 300_000, 5_000);
    expect(await screenIds(cache)).toEqual(['a']);
    state.screens = { ...state.screens, b: { titleSingular: 'B', titleFieldKey: 'name', fields: [field('name')] } };
    state.revision = 2;
    vi.advanceTimersByTime(6_000);
    expect(await screenIds(cache)).toEqual(['a', 'b']);
  });

  it('o carimbo é lido ANTES das telas, nunca junto', async () => {
    const { db, state } = liveDb();
    await new ScreenDefinitionCache(db).getScreens('t1');
    expect(state.reads[0]).toBe('schema_revision');
    expect(state.reads.slice(1).sort()).toEqual(['installed_extensions', 'lookupDefinitions', 'screenDefinitions']);
  });

  it('sem carimbo (escritório sem gravação de tela desde a atualização), o TTL continua sendo o teto', async () => {
    vi.useFakeTimers();
    const { db, state } = liveDb();
    state.revision = undefined;
    const cache = new ScreenDefinitionCache(db, 300_000, 5_000);
    await cache.getScreens('t1');
    state.screens = { ...state.screens, b: { titleSingular: 'B', titleFieldKey: 'name', fields: [field('name')] } };
    vi.advanceTimersByTime(60_000);
    expect(await screenIds(cache)).toEqual(['a']);
    vi.advanceTimersByTime(300_000);
    expect(await screenIds(cache)).toEqual(['a', 'b']);
  });
});
