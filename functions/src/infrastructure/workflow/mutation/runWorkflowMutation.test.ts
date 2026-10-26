import { describe, it, expect } from 'vitest';
import { runWorkflowRemove, runWorkflowUpsert } from './runWorkflowMutation';
import type { WorkflowMutationDeps } from './runWorkflowMutation';
import type {
  IWorkflowMutationRepository,
  RecordKeyMutation,
} from '../../../domain/repositories/IWorkflowMutationRepository';
import { RecordKeyTakenError } from '../../../domain/repositories/IWorkflowMutationRepository';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import type { UpsertSpec, RemoveSpec } from '../../../domain/schema/mutationSpec';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { WorkflowEvent } from '../../../domain/entities/Workflow';
import { fakeScreenProvider } from '../../../domain/repositories/fakeScreenProvider';

/**
 * Pessoa vem de extensão: a tela declara a coleção inteira (`name`), e o escritório acrescenta o
 * que quiser (`apelido`). Para a gravação por automação as duas origens são a mesma coisa.
 */
const personsScreen: SchemaScreen = {
  id: 'pessoas',
  collection: 'persons',
  eventPrefix: 'person',
  titleSingular: 'Pessoa',
  titleFieldKey: 'name',
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, order: 0, origin: 'plugin' },
    { key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 1, origin: 'design' },
  ],
};

const processosScreen: SchemaScreen = {
  id: 'processos',
  titleSingular: 'Processo',
  titleFieldKey: 'title',
  fields: [
    { key: 'title', label: 'Título', type: 'text', required: true, order: 0, origin: 'design' },
    { key: 'valor', label: 'Valor', type: 'number', required: false, order: 1, origin: 'design' },
  ],
};

// Contrato também vem de extensão, com a lista de opções que ela declara.
const contratosScreen: SchemaScreen = {
  id: 'contratos',
  collection: 'contracts',
  eventPrefix: 'contract',
  titleSingular: 'Contrato',
  titleFieldKey: 'title',
  fields: [
    { key: 'number', label: 'Número', type: 'text', required: true, order: 0, origin: 'plugin' },
    { key: 'title', label: 'Título', type: 'text', required: true, order: 1, origin: 'plugin' },
  ],
};

const screenProvider: IScreenDefinitionProvider = fakeScreenProvider(
  [personsScreen, processosScreen, contratosScreen],
  [{ collection: 'contractTypes', label: 'Contrato: Tipo' }],
);

interface WriteCall {
  tenantId: string;
  collection: string;
  id?: string;
  data?: Record<string, unknown>;
}

class FakeMutationRepository implements IWorkflowMutationRepository {
  store = new Map<string, Record<string, unknown>>();
  /** As reservas, pelo id — o mesmo papel de `tenants/{id}/recordKeys` no Firestore. */
  keys = new Map<string, { keyName: string; recordId: string; values: string[] }>();
  createCalls: WriteCall[] = [];
  updateCalls: WriteCall[] = [];
  deleteCalls: WriteCall[] = [];
  private seq = 0;

  private key(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  seed(collection: string, id: string, data: Record<string, unknown>): void {
    this.store.set(this.key(collection, id), data);
  }

  /** Semeia uma reserva já ocupada — é assim que a duplicata é montada no teste. */
  seedKey(keyId: string, recordId: string, keyName = 'k', values: string[] = []): void {
    this.keys.set(keyId, { keyName, recordId, values });
  }

  async getById(_tenantId: string, collection: string, id: string) {
    return this.store.get(this.key(collection, id)) ?? null;
  }

  newId(): string {
    return `gen-${(this.seq += 1)}`;
  }

  /**
   * A trava do backend é `create`, que FALHA se o documento já existe. O fake reproduz isso e mais
   * nada: é a única propriedade do Firestore de que a corretude depende aqui.
   */
  private applyKeys(recordId: string, keys?: RecordKeyMutation): void {
    for (const keyId of keys?.release ?? []) this.keys.delete(keyId);
    for (const reservation of keys?.create ?? []) {
      if (this.keys.has(reservation.keyId)) {
        throw new RecordKeyTakenError(reservation.keyName, reservation.values);
      }
      this.keys.set(reservation.keyId, {
        keyName: reservation.keyName,
        recordId,
        values: reservation.values,
      });
    }
  }

  async create(
    tenantId: string,
    collection: string,
    data: Record<string, unknown>,
    id?: string,
    keys?: RecordKeyMutation,
  ) {
    const finalId = id ?? this.newId();
    this.applyKeys(finalId, keys);
    this.createCalls.push({ tenantId, collection, id, data });
    this.store.set(this.key(collection, finalId), { ...data });
    return finalId;
  }

  async update(
    tenantId: string,
    collection: string,
    id: string,
    data: Record<string, unknown>,
    keys?: RecordKeyMutation,
  ) {
    this.applyKeys(id, keys);
    this.updateCalls.push({ tenantId, collection, id, data });
    const current = this.store.get(this.key(collection, id)) ?? {};
    this.store.set(this.key(collection, id), { ...current, ...data });
  }

  async delete(tenantId: string, collection: string, id: string, releaseKeyIds?: string[]) {
    this.deleteCalls.push({ tenantId, collection, id });
    this.store.delete(this.key(collection, id));
    for (const keyId of releaseKeyIds ?? []) this.keys.delete(keyId);
  }
}

const logger = { info: () => {}, warn: () => {}, error: () => {} };

const context = (): WorkflowContext => ({
  event: { id: 'e1', tenantId: 't1', name: 'contract.saved', payload: {}, timestamp: new Date() } as WorkflowEvent,
  outputs: {},
  variables: {},
  services: { logger, now: () => new Date() },
  logger,
  execution: { id: 'x1', workflowDefinitionId: 'w1', tenantId: 't1' },
});

const deps = (repo: FakeMutationRepository): WorkflowMutationDeps => ({
  mutationRepository: repo,
  screenProvider,
});

const upsert = (repo: FakeMutationRepository, spec: UpsertSpec) => runWorkflowUpsert(spec, context(), deps(repo));
const remove = (repo: FakeMutationRepository, spec: RemoveSpec) => runWorkflowRemove(spec, context(), deps(repo));

describe('runWorkflowUpsert', () => {
  it('inclui um registro em entidade fixa com campos do kernel e do tenant, todos na raiz', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await upsert(repo, {
      table: 'persons',
      data: { name: 'Ana', apelido: 'Aninha' },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.created).toBe(true);
    const call = repo.createCalls[0];
    expect(call.tenantId).toBe('t1');
    expect(call.collection).toBe('persons');
    expect(call.data).toMatchObject({ name: 'Ana', apelido: 'Aninha', createdBy: 'workflow-engine' });
  });

  it('atualiza (merge) quando o id existe', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Antigo' });
    const outcome = await upsert(repo, { table: 'persons', id: 'p1', data: { name: 'Novo' } });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.created).toBe(false);
    expect(repo.updateCalls[0]).toMatchObject({ collection: 'persons', id: 'p1' });
    expect(repo.store.get('persons/p1')).toMatchObject({ name: 'Novo' });
  });

  it('grava numa tela do Form Design como em qualquer entidade: coleção própria, campos na raiz', () => {
    const repo = new FakeMutationRepository();
    return upsert(repo, { table: 'processos', data: { title: 'Caso X', valor: 10 } }).then((outcome) => {
      expect(outcome.ok).toBe(true);
      const call = repo.createCalls[0];
      expect(call.collection).toBe('processos');
      expect(call.data).toMatchObject({ title: 'Caso X', valor: 10 });
      // Nada de envelope nem de campo derivado: o documento tem só o que a tela declara.
      expect(call.data).not.toHaveProperty('values');
      expect(call.data).not.toHaveProperty('screenKey');
      expect(call.data).not.toHaveProperty('title2');
    });
  });

  it('grava valores de lista (lookup)', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await upsert(repo, { table: 'contractTypes', data: { key: 'servico', label: 'Serviço' } });

    expect(outcome.ok).toBe(true);
    expect(repo.createCalls[0].collection).toBe('contractTypes');
  });

  it('bloqueia gravação em entidades sensíveis (members, pushes, news)', async () => {
    const repo = new FakeMutationRepository();
    for (const table of ['members', 'pushes', 'news']) {
      const outcome = await upsert(repo, { table, data: { name: 'x' } });
      expect(outcome.ok).toBe(false);
    }
    expect(repo.createCalls).toHaveLength(0);
  });

  it('rejeita campos desconhecidos e campos gerenciados pelo sistema', async () => {
    const repo = new FakeMutationRepository();
    expect((await upsert(repo, { table: 'persons', data: { naoExiste: 'x' } })).ok).toBe(false);
    expect((await upsert(repo, { table: 'persons', data: { id: 'forjado' } })).ok).toBe(false);
    expect((await upsert(repo, { table: 'processos', data: { naoDeclarado: 'x' } })).ok).toBe(false);
    expect((await upsert(repo, { table: 'processos', data: { createdAt: 'forjado' } })).ok).toBe(false);
    expect(repo.createCalls).toHaveLength(0);
  });

  it('registra updatedBy do workflow ao atualizar', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Antigo' });
    await upsert(repo, { table: 'persons', id: 'p1', data: { name: 'Novo' } });
    expect(repo.updateCalls[0].data).toMatchObject({ name: 'Novo', updatedBy: 'workflow-engine' });
  });

  describe('autoria', () => {
    const withActor = (via: 'ui' | 'agent'): WorkflowContext => ({
      ...context(),
      actor: { userId: 'u-ana', name: 'Ana Souza', photoURL: 'https://foto/ana', via, permissions: [] },
    });

    it('com uma pessoa por trás, grava o uid, o nome efetivo, a foto e por onde veio — como o formulário', async () => {
      const repo = new FakeMutationRepository();
      await runWorkflowUpsert({ table: 'persons', data: { name: 'Bia' } }, withActor('ui'), deps(repo));
      expect(repo.createCalls[0].data).toMatchObject({
        createdBy: 'u-ana',
        createdByName: 'Ana Souza',
        createdByPhotoURL: 'https://foto/ana',
        createdVia: 'ui',
        updatedBy: 'u-ana',
        updatedByName: 'Ana Souza',
        updatedVia: 'ui',
      });
    });

    it('pelo agente, o autor continua sendo a pessoa e o `via` diz que foi o agente', async () => {
      const repo = new FakeMutationRepository();
      repo.seed('persons', 'p1', { name: 'Antigo', createdBy: 'u-x', createdVia: 'ui' });
      await runWorkflowUpsert({ table: 'persons', id: 'p1', data: { name: 'Novo' } }, withActor('agent'), deps(repo));
      const written = repo.updateCalls[0].data ?? {};
      expect(written).toMatchObject({ updatedBy: 'u-ana', updatedByName: 'Ana Souza', updatedVia: 'agent' });
      expect(written).not.toHaveProperty('createdBy');
      expect(written).not.toHaveProperty('createdVia');
    });

    it('sem pessoa, o autor é o motor e o `via` é automation — sem nome nenhum inventado', async () => {
      const repo = new FakeMutationRepository();
      await upsert(repo, { table: 'persons', data: { name: 'Bia' } });
      const created = repo.createCalls[0].data ?? {};
      expect(created).toMatchObject({ createdBy: 'workflow-engine', createdVia: 'automation', updatedVia: 'automation' });
      expect(created).not.toHaveProperty('createdByName');
      expect(created).not.toHaveProperty('updatedByName');
    });

    it('sem pessoa, a atualização APAGA o nome de quem editou antes, em vez de deixá-lo ao lado do motor', async () => {
      const repo = new FakeMutationRepository();
      repo.seed('persons', 'p1', { name: 'Antigo', updatedBy: 'u-ana', updatedByName: 'Ana Souza' });
      await upsert(repo, { table: 'persons', id: 'p1', data: { name: 'Novo' } });
      expect(repo.store.get('persons/p1')).toMatchObject({
        updatedBy: 'workflow-engine',
        updatedByName: null,
        updatedVia: 'automation',
      });
    });

    it('o dado do fluxo não forja o autor: createdBy, createdByName e createdVia são recusados', async () => {
      const repo = new FakeMutationRepository();
      for (const field of ['createdBy', 'createdByName', 'createdVia', 'updatedVia']) {
        const outcome = await runWorkflowUpsert(
          { table: 'persons', data: { name: 'Bia', [field]: 'forjado' } },
          withActor('ui'),
          deps(repo),
        );
        expect(outcome.ok).toBe(false);
      }
      expect(repo.createCalls).toHaveLength(0);
    });

    it('com ignoreUnwritableFields, o campo forjado é descartado e o carimbo verdadeiro prevalece', async () => {
      const repo = new FakeMutationRepository();
      await runWorkflowUpsert(
        { table: 'persons', data: { name: 'Bia', createdBy: 'forjado', createdVia: 'agent', createdByName: 'X' } },
        withActor('ui'),
        deps(repo),
        { ignoreUnwritableFields: true },
      );
      expect(repo.createCalls[0].data).toMatchObject({ createdBy: 'u-ana', createdByName: 'Ana Souza', createdVia: 'ui' });
    });

    describe('a identidade que o convidado do portal provou — `portalVerified`', () => {
      const verified = { provider: 'citizen', claim: { name: 'nationalId', value: '12345678900' }, level: 'gold' };
      const guest = (identity?: typeof verified): WorkflowContext => ({
        ...context(),
        actor: {
          userId: 'portal-id-x', name: 'Bia', photoURL: '', via: 'portal', permissions: [],
          ...(identity ? { verified: identity } : {}),
        },
      });

      it('a gravação pelo portal carimba o provedor, a claim e o nível', async () => {
        const repo = new FakeMutationRepository();
        await runWorkflowUpsert({ table: 'persons', data: { name: 'Bia' } }, guest(verified), deps(repo));
        expect(repo.createCalls[0].data).toMatchObject({ createdVia: 'portal', portalVerified: verified });
      });

      it('o convidado do link de e-mail APAGA a prova da gravação anterior — ela não é dele', async () => {
        const repo = new FakeMutationRepository();
        repo.seed('persons', 'p1', { name: 'Antigo', portalVerified: verified });
        await runWorkflowUpsert({ table: 'persons', id: 'p1', data: { name: 'Novo' } }, guest(), deps(repo));
        expect(repo.store.get('persons/p1')).toMatchObject({ updatedVia: 'portal', portalVerified: null });
      });

      it('as outras portas não tocam o campo: ele fala da última gravação feita pelo portal', async () => {
        const repo = new FakeMutationRepository();
        repo.seed('persons', 'p1', { name: 'Antigo', portalVerified: verified });
        await runWorkflowUpsert({ table: 'persons', id: 'p1', data: { name: 'Novo' } }, withActor('ui'), deps(repo));
        expect(repo.updateCalls[0].data).not.toHaveProperty('portalVerified');
        await upsert(repo, { table: 'persons', id: 'p1', data: { name: 'Outro' } });
        expect(repo.store.get('persons/p1')).toMatchObject({ portalVerified: verified });
      });

      it('nenhum fluxo forja a prova', async () => {
        const repo = new FakeMutationRepository();
        const outcome = await runWorkflowUpsert(
          { table: 'persons', data: { name: 'Bia', portalVerified: verified } },
          withActor('ui'),
          deps(repo),
        );
        expect(outcome.ok).toBe(false);
      });
    });
  });

  it('com ignoreUnwritableFields, descarta campos reservados/desconhecidos em vez de falhar', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Antigo' });
    const outcome = await runWorkflowUpsert(
      {
        table: 'persons',
        id: 'p1',
        data: {
          name: 'Novo',
          createdAt: 'x',
          updatedAt: 'y',
          createdBy: 'alguém',
          title: 'z',
          naoExiste: 'w',
        },
      },
      context(),
      deps(repo),
      { ignoreUnwritableFields: true },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.created).toBe(false);
    const written = repo.updateCalls[0].data ?? {};
    expect(written).toMatchObject({ name: 'Novo', updatedBy: 'workflow-engine' });
    expect(written).not.toHaveProperty('createdAt');
    expect(written).not.toHaveProperty('createdBy');
    expect(written).not.toHaveProperty('title');
    expect(written).not.toHaveProperty('naoExiste');
  });

  it('avisa no log quais campos foram descartados por ignoreUnwritableFields', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Antigo' });
    const warnings: { message: string; params?: Record<string, string> }[] = [];
    const capturing = context();
    capturing.logger = {
      info: () => {},
      warn: (message: string, params?: Record<string, string>) => warnings.push({ message, params }),
      error: () => {},
    };

    await runWorkflowUpsert(
      { table: 'persons', id: 'p1', data: { name: 'Novo', createdBy: 'alguém', naoExiste: 'w' } },
      capturing,
      deps(repo),
      { ignoreUnwritableFields: true },
    );

    // A mensagem é REFERÊNCIA; o que muda por execução viaja nos params. O campo descartado vem em
    // `label` e o MOTIVO em `reason`, também como referência — colado numa frase ele apareceria
    // cru na tela, que foi o defeito que este formato desfaz.
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toBe('@core.automation/mutation.upsert.unwritable-ignored');
    expect(warnings[0].params?.table).toBe('persons');
    expect(warnings[0].params?.count).toBe('2');
    expect(warnings[0].params?.label).toBe('createdBy');
    expect(warnings[0].params?.reason).toBe('@core.automation/mutation.path.system-managed');
    expect(warnings[0].params?.detail).toBe('@core.records/field.issue-more');
    expect(warnings[0].params?.others).toBe('1');
  });

  it('não avisa quando todos os campos são graváveis', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Antigo' });
    const warnings: string[] = [];
    const capturing = context();
    capturing.logger = { info: () => {}, warn: (m: string) => warnings.push(m), error: () => {} };

    await runWorkflowUpsert(
      { table: 'persons', id: 'p1', data: { name: 'Novo' } },
      capturing,
      deps(repo),
      { ignoreUnwritableFields: true },
    );

    expect(warnings).toHaveLength(0);
  });

  it('grava title em entidades nativas que o têm como campo próprio', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('contracts', 'c1', { title: 'Antigo' });
    const outcome = await runWorkflowUpsert(
      { table: 'contracts', id: 'c1', data: { title: 'Novo título' } },
      context(),
      deps(repo),
      { ignoreUnwritableFields: true },
    );

    expect(outcome.ok).toBe(true);
    expect(repo.updateCalls[0].data).toMatchObject({ title: 'Novo título' });
  });

  it('um id de outra tela simplesmente não existe na coleção — a gravação cria o registro', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('outra', 'r1', { title: 'De outra tela' });
    const outcome = await upsert(repo, { table: 'processos', id: 'r1', data: { title: 'X' } });
    expect(outcome.ok).toBe(true);
    expect(repo.createCalls[0].collection).toBe('processos');
    expect(repo.store.get('outra/r1')).toMatchObject({ title: 'De outra tela' });
  });

  it('com updateOnly, um id que não existe é recusado — não nasce registro nenhum', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await runWorkflowUpsert(
      { table: 'processos', id: 'apagado', data: { title: 'X' } },
      context(),
      deps(repo),
      { updateOnly: true },
    );
    expect(outcome).toEqual({ ok: false, error: '@core.automation/mutation.upsert.not-found' });
    expect(repo.createCalls).toHaveLength(0);

    repo.seed('processos', 'r1', { title: 'Antes' });
    const updated = await runWorkflowUpsert({ table: 'processos', id: 'r1', data: { title: 'Depois' } }, context(), deps(repo), { updateOnly: true });
    expect(updated.ok).toBe(true);
  });
});

describe('runWorkflowRemove', () => {
  it('exclui apenas o registro informado', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Ana' });
    const outcome = await remove(repo, { table: 'persons', id: 'p1' });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.removed).toBe(true);
    expect(repo.deleteCalls[0]).toMatchObject({ tenantId: 't1', collection: 'persons', id: 'p1' });
    expect(repo.store.has('persons/p1')).toBe(false);
  });

  it('retorna removed=false quando o registro não existe', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await remove(repo, { table: 'persons', id: 'zzz' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.removed).toBe(false);
    expect(repo.deleteCalls).toHaveLength(0);
  });

  it('não alcança registro de outra tela: a coleção isola por construção', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('outra', 'r1', { title: 'De outra tela' });
    const outcome = await remove(repo, { table: 'processos', id: 'r1' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.removed).toBe(false);
    expect(repo.deleteCalls).toHaveLength(0);
    expect(repo.store.has('outra/r1')).toBe(true);
  });

  it('bloqueia exclusão em entidades sensíveis', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await remove(repo, { table: 'members', id: 'm1' });
    expect(outcome.ok).toBe(false);
  });
});

/**
 * A automação passa pelo MESMO portão de chave que o formulário. É o ponto da implementação em que
 * mais valia errar: uma unicidade que o `UpsertStep` fura não é unicidade — só um aviso no front.
 */
describe('chaves de registro na gravação por automação', () => {
  const keyedScreen: SchemaScreen = {
    id: 'produtos',
    titleSingular: 'Produto',
    titleFieldKey: 'nome',
    fields: [
      { key: 'nome', label: 'Nome', type: 'text', required: true, order: 0, origin: 'design' },
      { key: 'sku', label: 'SKU', type: 'text', required: false, order: 1, origin: 'design' },
      { key: 'linha', label: 'Linha', type: 'text', required: false, order: 2, origin: 'design' },
    ],
    keys: [
      { name: 'sku', kind: 'unique', fields: ['sku'], normalize: { caseInsensitive: true } },
      { name: 'linha-nome', kind: 'unique', fields: ['linha', 'nome'] },
    ],
  };

  const keyedDeps = (repo: FakeMutationRepository): WorkflowMutationDeps => ({
    mutationRepository: repo,
    screenProvider: fakeScreenProvider([keyedScreen]),
  });

  const upsert = (data: Record<string, unknown>, id?: string): UpsertSpec =>
    ({ table: 'produtos', data, ...(id ? { id } : {}) }) as UpsertSpec;

  it('grava reservando as chaves e carimba no registro o que o sustenta', async () => {
    const repo = new FakeMutationRepository();
    const result = await runWorkflowUpsert(
      upsert({ nome: 'Cadeira', sku: 'AB-1', linha: 'casa' }),
      context(),
      keyedDeps(repo),
    );
    expect(result.ok).toBe(true);
    expect([...repo.keys.keys()].sort()).toEqual(['produtos|linha-nome|casa|Cadeira', 'produtos|sku|ab-1']);
    const stored = repo.store.get('produtos/gen-1') as Record<string, unknown>;
    expect(stored.keyRefs).toEqual({
      sku: 'produtos|sku|ab-1',
      'linha-nome': 'produtos|linha-nome|casa|Cadeira',
    });
  });

  it('recusa a segunda gravação com o mesmo valor, e diz qual chave e qual valor', async () => {
    const repo = new FakeMutationRepository();
    await runWorkflowUpsert(upsert({ nome: 'A', sku: 'AB-1' }), context(), keyedDeps(repo));
    const result = await runWorkflowUpsert(upsert({ nome: 'B', sku: 'AB-1' }), context(), keyedDeps(repo));
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({
      error: '@core.automation/mutation.upsert.key-conflict',
      errorParams: { key: 'sku', value: 'ab-1' },
    });
  });

  it('recusa a duplicata que só difere na CAIXA, porque a chave declarou a comparação', async () => {
    const repo = new FakeMutationRepository();
    await runWorkflowUpsert(upsert({ nome: 'A', sku: 'ab-1' }), context(), keyedDeps(repo));
    const result = await runWorkflowUpsert(upsert({ nome: 'B', sku: 'AB-1' }), context(), keyedDeps(repo));
    expect(result.ok).toBe(false);
  });

  it('o registro NÃO é gravado quando a reserva falha — a recusa é do lote inteiro', async () => {
    const repo = new FakeMutationRepository();
    await runWorkflowUpsert(upsert({ nome: 'A', sku: 'AB-1' }), context(), keyedDeps(repo));
    const before = repo.store.size;
    await runWorkflowUpsert(upsert({ nome: 'B', sku: 'AB-1' }), context(), keyedDeps(repo));
    expect(repo.store.size).toBe(before);
  });

  it('regravar o MESMO registro com o mesmo valor não conflita consigo mesmo', async () => {
    const repo = new FakeMutationRepository();
    await runWorkflowUpsert(upsert({ nome: 'A', sku: 'AB-1' }, 'p1'), context(), keyedDeps(repo));
    const again = await runWorkflowUpsert(
      upsert({ nome: 'A2', sku: 'AB-1' }, 'p1'),
      context(),
      keyedDeps(repo),
    );
    expect(again.ok).toBe(true);
  });

  it('trocar o valor solta a reserva antiga e o valor volta a ficar livre', async () => {
    const repo = new FakeMutationRepository();
    await runWorkflowUpsert(upsert({ nome: 'A', sku: 'AB-1' }, 'p1'), context(), keyedDeps(repo));
    await runWorkflowUpsert(upsert({ sku: 'AB-2' }, 'p1'), context(), keyedDeps(repo));
    expect([...repo.keys.keys()]).toContain('produtos|sku|ab-2');
    expect([...repo.keys.keys()]).not.toContain('produtos|sku|ab-1');

    const outro = await runWorkflowUpsert(upsert({ nome: 'B', sku: 'AB-1' }), context(), keyedDeps(repo));
    expect(outro.ok).toBe(true);
  });

  it('um upsert PARCIAL de chave composta a reconstitui do registro gravado', async () => {
    const repo = new FakeMutationRepository();
    await runWorkflowUpsert(
      upsert({ nome: 'Cadeira', linha: 'casa' }, 'p1'),
      context(),
      keyedDeps(repo),
    );
    // Só `linha` chega no segundo upsert: sem a mescla com o existente, `nome` iria vazio e a chave
    // composta não reservaria nada.
    await runWorkflowUpsert(upsert({ linha: 'escritorio' }, 'p1'), context(), keyedDeps(repo));
    expect([...repo.keys.keys()]).toContain('produtos|linha-nome|escritorio|Cadeira');
    expect([...repo.keys.keys()]).not.toContain('produtos|linha-nome|casa|Cadeira');
  });

  it('a chave esparsa sem valor não reserva nada, e dois registros vazios convivem', async () => {
    const repo = new FakeMutationRepository();
    const um = await runWorkflowUpsert(upsert({ nome: 'A' }), context(), keyedDeps(repo));
    const dois = await runWorkflowUpsert(upsert({ nome: 'B' }), context(), keyedDeps(repo));
    expect(um.ok && dois.ok).toBe(true);
    expect(repo.keys.size).toBe(0);
  });

  it('a chave OBRIGATÓRIA sem valor recusa a gravação em vez de deixar passar', async () => {
    const repo = new FakeMutationRepository();
    const strict: SchemaScreen = {
      ...keyedScreen,
      keys: [{ name: 'sku', kind: 'unique', fields: ['sku'], sparse: false }],
    };
    const result = await runWorkflowUpsert(
      upsert({ nome: 'A' }),
      context(),
      { mutationRepository: repo, screenProvider: fakeScreenProvider([strict]) },
    );
    expect(result).toMatchObject({
      error: '@core.automation/mutation.upsert.key-required',
      errorParams: { key: 'sku' },
    });
    expect(repo.store.size).toBe(0);
  });

  it('excluir solta as reservas, e o valor volta a poder ser usado', async () => {
    const repo = new FakeMutationRepository();
    await runWorkflowUpsert(upsert({ nome: 'A', sku: 'AB-1' }, 'p1'), context(), keyedDeps(repo));
    const removed = await runWorkflowRemove(
      { table: 'produtos', id: 'p1' } as RemoveSpec,
      context(),
      keyedDeps(repo),
    );
    expect(removed.ok).toBe(true);
    expect(repo.keys.size).toBe(0);
    const outro = await runWorkflowUpsert(upsert({ nome: 'B', sku: 'AB-1' }), context(), keyedDeps(repo));
    expect(outro.ok).toBe(true);
  });

  it('solta a reserva que o REGISTRO cita, mesmo que a declaração já não a produza', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('produtos', 'p1', { nome: 'A', sku: 'AB-1', keyRefs: { sku: 'produtos|sku|FORMATO-ANTIGO' } });
    repo.seedKey('produtos|sku|FORMATO-ANTIGO', 'p1', 'sku', ['FORMATO-ANTIGO']);
    await runWorkflowRemove({ table: 'produtos', id: 'p1' } as RemoveSpec, context(), keyedDeps(repo));
    expect(repo.keys.size).toBe(0);
  });

  it('a coleção SEM chave nenhuma segue gravando exatamente como antes', async () => {
    const repo = new FakeMutationRepository();
    const result = await runWorkflowUpsert(
      { table: 'processos', data: { title: 'X' } } as UpsertSpec,
      context(),
      deps(repo),
    );
    expect(result.ok).toBe(true);
    expect(repo.keys.size).toBe(0);
    expect(repo.store.get('processos/gen-1')).not.toHaveProperty('keyRefs');
  });
});

describe('janela de edição na gravação por automação, agente e portal', () => {
  const mensagensScreen: SchemaScreen = {
    id: 'mensagens',
    titleSingular: 'Mensagem',
    titleFieldKey: 'texto',
    fields: [
      { key: 'texto', label: 'Texto', type: 'text', required: true, order: 0, origin: 'plugin' },
      { key: 'lida', label: 'Lida', type: 'checkbox', required: false, order: 1, origin: 'plugin' },
    ],
    editWindow: { minutes: 15, delete: true },
    memberWritableFields: ['lida'],
  };
  const notasScreen: SchemaScreen = {
    id: 'notas',
    titleSingular: 'Nota',
    titleFieldKey: 'texto',
    fields: [{ key: 'texto', label: 'Texto', type: 'text', required: true, order: 0, origin: 'plugin' }],
    editWindow: { minutes: 15 },
  };
  const windowDeps = (repo: FakeMutationRepository): WorkflowMutationDeps => ({
    mutationRepository: repo,
    screenProvider: fakeScreenProvider([mensagensScreen, notasScreen]),
  });
  const hourAgo = (): Date => new Date(Date.now() - 60 * 60_000);
  const minuteAgo = (): Date => new Date(Date.now() - 60_000);

  it('recusa alterar o conteúdo depois do prazo, sem gravar nada', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('mensagens', 'm1', { texto: 'oi', createdAt: hourAgo() });
    const outcome = await runWorkflowUpsert(
      { table: 'mensagens', id: 'm1', data: { texto: 'olá' } } as UpsertSpec, context(), windowDeps(repo));
    expect(outcome).toEqual({
      ok: false,
      error: '@core.automation/mutation.upsert.edit-window-closed',
      errorParams: { minutes: '15' },
    });
    expect(repo.updateCalls).toHaveLength(0);
  });

  it('altera dentro do prazo — o carimbo do fluxo logo depois da criação cabe na janela', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('mensagens', 'm1', { texto: 'oi', createdAt: minuteAgo() });
    const outcome = await runWorkflowUpsert(
      { table: 'mensagens', id: 'm1', data: { texto: 'olá' } } as UpsertSpec, context(), windowDeps(repo));
    expect(outcome.ok).toBe(true);
  });

  it('depois do prazo, só passa o que qualquer membro grava — e o valor reenviado igual não é alteração', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('mensagens', 'm1', { texto: 'oi', lida: false, createdAt: hourAgo() });
    const lida = await runWorkflowUpsert(
      { table: 'mensagens', id: 'm1', data: { lida: true } } as UpsertSpec, context(), windowDeps(repo));
    expect(lida.ok).toBe(true);
    const mesmoTexto = await runWorkflowUpsert(
      { table: 'mensagens', id: 'm1', data: { texto: 'oi', lida: true } } as UpsertSpec, context(), windowDeps(repo));
    expect(mesmoTexto.ok).toBe(true);
  });

  it('registro sem `createdAt` está fechado, como na regra', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('mensagens', 'm1', { texto: 'oi' });
    const outcome = await runWorkflowUpsert(
      { table: 'mensagens', id: 'm1', data: { texto: 'olá' } } as UpsertSpec, context(), windowDeps(repo));
    expect(outcome.ok).toBe(false);
  });

  it('criar nunca é barrado', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await runWorkflowUpsert({ table: 'mensagens', data: { texto: 'oi' } } as UpsertSpec, context(), windowDeps(repo));
    expect(outcome.ok).toBe(true);
  });

  it('com `delete: true`, recusa excluir depois do prazo ANTES da cascata', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('mensagens', 'm1', { texto: 'oi', createdAt: hourAgo() });
    const outcome = await runWorkflowRemove({ table: 'mensagens', id: 'm1' } as RemoveSpec, context(), windowDeps(repo));
    expect(outcome).toEqual({
      ok: false,
      error: '@core.automation/mutation.remove.edit-window-closed',
      errorParams: { minutes: '15' },
    });
    expect(repo.deleteCalls).toHaveLength(0);
  });

  it('sem `delete`, excluir segue livre depois do prazo', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('notas', 'n1', { texto: 'oi', createdAt: hourAgo() });
    const outcome = await runWorkflowRemove({ table: 'notas', id: 'n1' } as RemoveSpec, context(), windowDeps(repo));
    expect(outcome.ok).toBe(true);
    expect(repo.deleteCalls).toHaveLength(1);
  });
});

describe('visibilidade por registro na gravação', () => {
  /**
   * O agente grava POR uma pessoa, e com o `reader` dela no contexto: o registro que a regra lhe
   * esconde não é alterado nem excluído — e a resposta é a de quem não existe. A automação não tem
   * leitor, e grava como sempre: numerar, encaminhar e contar precisam da coleção inteira.
   */
  const respostasScreen: SchemaScreen = {
    id: 'respostas',
    titleSingular: 'Resposta',
    titleFieldKey: 'texto',
    fields: [
      { key: 'texto', label: 'Texto', type: 'text', required: false, order: 0, origin: 'plugin' },
      { key: 'emissor', label: 'Emissor', type: 'reference', refEntity: 'members', required: false, order: 1, origin: 'plugin' },
    ],
    memberVisibility: { userFields: ['emissor'] },
  };
  const visibilityDeps = (repo: FakeMutationRepository): WorkflowMutationDeps => ({
    mutationRepository: repo,
    screenProvider: fakeScreenProvider([respostasScreen]),
  });
  const asAna = (): WorkflowContext => ({ ...context(), reader: { uid: 'ana', permissions: ['respostas.update'] } });

  it('não altera o registro que não a nomeia, e responde como se ele não existisse', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('respostas', 'r1', { texto: 'da bia', emissor: 'bia' });
    const outcome = await runWorkflowUpsert(
      { table: 'respostas', id: 'r1', data: { texto: 'mexi' } } as UpsertSpec, asAna(), visibilityDeps(repo));
    expect(outcome).toEqual({ ok: false, error: '@core.records/record.not-found' });
    expect(repo.updateCalls).toHaveLength(0);
  });

  it('altera o que a nomeia, e cria nomeando outra pessoa', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('respostas', 'r1', { texto: 'da ana', emissor: 'ana' });
    expect((await runWorkflowUpsert(
      { table: 'respostas', id: 'r1', data: { texto: 'mexi' } } as UpsertSpec, asAna(), visibilityDeps(repo))).ok).toBe(true);
    expect((await runWorkflowUpsert(
      { table: 'respostas', data: { texto: 'para a bia', emissor: 'bia' } } as UpsertSpec, asAna(), visibilityDeps(repo))).ok).toBe(true);
  });

  it('não exclui o que não a nomeia — a resposta é a de um id que não está lá', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('respostas', 'r1', { texto: 'da bia', emissor: 'bia' });
    const outcome = await runWorkflowRemove({ table: 'respostas', id: 'r1' } as RemoveSpec, asAna(), visibilityDeps(repo));
    expect(outcome).toEqual({ ok: true, value: { id: 'r1', removed: false } });
    expect(repo.deleteCalls).toHaveLength(0);
  });

  it('a automação, sem leitor, grava e exclui como sempre', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('respostas', 'r1', { texto: 'da bia', emissor: 'bia' });
    expect((await runWorkflowUpsert(
      { table: 'respostas', id: 'r1', data: { texto: 'numerada' } } as UpsertSpec, context(), visibilityDeps(repo))).ok).toBe(true);
    expect((await runWorkflowRemove({ table: 'respostas', id: 'r1' } as RemoveSpec, context(), visibilityDeps(repo))).ok).toBe(true);
    expect(repo.deleteCalls).toHaveLength(1);
  });
});
