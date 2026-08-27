import { describe, expect, it } from 'vitest';
import { applyPlanToCatalog, buildArtifactPlan } from './artifactPlan';
import type { CatalogScreenInput } from './catalog';
import { buildDomainCatalog } from './catalog';
import type { DomainIssue, DomainModel } from './domainModel';
import { buildScreenPlan, deriveScreenSourceId } from './screenPlan';
import type { RuleLedger } from './traceability';
import { emptyRuleLedger, ruleLedgerEntry } from './traceability';

/**
 * A IDENTIDADE UNIVERSAL DA TELA — o defeito que falha em SILÊNCIO, e as três provas dele.
 *
 * O `sourceId` é por onde a atualização reconhece a tela: a instalação procura no escritório uma tela
 * com o mesmo id universal e reusa a chave dela. Trocá-lo entre duas versões do mesmo pacote não
 * reprova em nada — instala uma SEGUNDA tela ao lado da primeira, deixa os registros na coleção antiga
 * sem tela nenhuma por cima, e faz isso em todo escritório de uma vez. Não há sintoma local: o pacote
 * valida, instala e roda.
 *
 * Por isso as três provas aqui não são sobre a derivação estar bonita. Elas são sobre o que a
 * derivação NÃO pode fazer: mudar quando alguém reescreve um rótulo, e ser aplicada a uma tela que já
 * tem identidade registrada.
 */
const RULE = {
  id: 'an-invoice-belongs-to-a-customer',
  statement: 'Every invoice belongs to one customer and carries a number.',
  actors: [],
  concepts: ['Invoice'],
  invariants: [],
  processes: [],
  acceptance: ['an invoice cannot be saved without a number'],
};

/** Um modelo mínimo, parametrizado justamente no que uma pessoa reescreve: o id e o nome da entidade. */
const invoiceModel = (extensionId = 'com.example.billing', entityName = 'Invoice'): DomainModel => ({
  version: 1,
  target: 'extension',
  extensionId,
  entities: [
    {
      name: entityName,
      kind: 'entity',
      collection: 'invoices',
      titleField: 'number',
      fields: [
        { key: 'number', label: 'Number', semanticType: 'scalar', type: 'text', required: true },
        { key: 'amount', label: 'Amount', semanticType: 'scalar', type: 'number' },
      ],
    },
  ],
  relationships: [],
});

const CATALOG = buildDomainCatalog([]);

const errors = (issues: readonly DomainIssue[]): string[] => issues
  .filter((one) => one.severity === 'error')
  .map((one) => `${one.code}: ${one.message}`);

const idOf = (plan: ReturnType<typeof buildArtifactPlan>, collection: string): string | undefined =>
  plan.screenPlan.screens.find((one) => one.collection === collection)?.sourceId;

const ledgerWith = (screens: string[], screenSourceIds: Record<string, string>): RuleLedger => ({
  version: 1,
  rules: [ruleLedgerEntry(RULE, {
    screens, lists: [], actions: [], transitions: [], permissions: [],
  }, screenSourceIds)],
});

describe('o plano EMITE a identidade universal de cada tela', () => {
  it('deriva do id da extensão mais a coleção, e diz de onde o valor saiu', () => {
    const plan = buildArtifactPlan(invoiceModel(), CATALOG, { rule: RULE });
    expect(idOf(plan, 'invoices')).toBe('com.example.billing:invoices');
    expect(plan.screenPlan.screens[0].sourceIdFrom).toBe('derived');
    expect(errors(plan.issues)).toEqual([]);
  });

  /**
   * (a) A PROVA CENTRAL: o rótulo da entidade é o que a pessoa reescreve — `titleSingular` da tela SAI
   * do nome da entidade —, e o enunciado da regra é reescrito a cada conversa. Nenhum dos dois pode
   * mover a identidade, porque mover a identidade é instalar uma segunda tela.
   */
  it('o rótulo da entidade renomeado NÃO muda o sourceId — nem o enunciado da regra, nem a ordem', () => {
    const original = buildArtifactPlan(invoiceModel(), CATALOG, { rule: RULE });
    const renamed = buildArtifactPlan(invoiceModel('com.example.billing', 'Fiscal note'), CATALOG, {
      rule: { ...RULE, statement: 'Every fiscal note belongs to one customer.', concepts: ['Fiscal note'] },
    });

    expect(idOf(renamed, 'invoices')).toBe(idOf(original, 'invoices'));
    // E o rótulo REALMENTE mudou — sem isto o teste passaria por não ter mexido em nada.
    expect(renamed.screenInputs[0].titleSingular).toBe('Fiscal note');
    expect(original.screenInputs[0].titleSingular).toBe('Invoice');
  });

  it('a ordem das telas no plano não entra na identidade de nenhuma delas', () => {
    const two = (first: string, second: string): DomainModel => ({
      ...invoiceModel(),
      entities: [first, second].map((collection) => ({
        name: collection,
        kind: 'entity' as const,
        collection,
        titleField: 'name',
        fields: [{ key: 'name', label: 'Name', semanticType: 'scalar' as const, type: 'text' as const }],
      })),
    });
    const ascending = buildArtifactPlan(two('alphas', 'betas'), CATALOG);
    const descending = buildArtifactPlan(two('betas', 'alphas'), CATALOG);
    expect(idOf(ascending, 'alphas')).toBe(idOf(descending, 'alphas'));
    expect(idOf(ascending, 'betas')).toBe(idOf(descending, 'betas'));
  });

  /** (c) Duas extensões, entidades de mesmo nome e mesma coleção: o espaço de nomes é o id do pacote. */
  it('duas extensões com entidades de mesmo nome NÃO colidem', () => {
    const mine = buildArtifactPlan(invoiceModel('com.example.billing'), CATALOG);
    const theirs = buildArtifactPlan(invoiceModel('com.other.suite'), CATALOG);
    expect(idOf(mine, 'invoices')).toBe('com.example.billing:invoices');
    expect(idOf(theirs, 'invoices')).toBe('com.other.suite:invoices');
    expect(idOf(mine, 'invoices')).not.toBe(idOf(theirs, 'invoices'));
  });

  /** Sem pacote não há extensão para dar o espaço de nomes, e a tela do escritório não viaja. */
  it('a tela do próprio escritório também sai com identidade, no espaço de nomes do alvo', () => {
    const own: DomainModel = { ...invoiceModel(), target: 'screenDefinitions', extensionId: undefined };
    expect(idOf(buildArtifactPlan(own, CATALOG), 'invoices')).toBe('screenDefinitions:invoices');
  });
});

describe('o que JÁ EXISTE nunca é recalculado', () => {
  /**
   * (b) A regra de segurança, simulada como ela aconteceria de verdade: o livro registra o valor que
   * uma base de derivação ANTERIOR produziu (o nome de domínio, não a coleção), e a base de hoje
   * produz outro. O plano fica com o registrado — para sempre, e sem reclamar de nada.
   */
  it('a tela registrada no livro mantém o sourceId registrado, mesmo com a derivação de hoje produzindo outro', () => {
    const antiga = 'com.example.billing:Invoice';
    expect(deriveScreenSourceId('com.example.billing', 'invoices')).not.toBe(antiga);

    const plan = buildArtifactPlan(invoiceModel(), CATALOG, {
      rule: RULE,
      ledger: ledgerWith(['invoices'], { invoices: antiga }),
    });

    expect(idOf(plan, 'invoices')).toBe(antiga);
    expect(plan.screenPlan.screens[0].sourceIdFrom).toBe('ledger');
    expect(errors(plan.issues)).toEqual([]);
    // E a leva nova grava o valor REGISTRADO, não o derivado: é o que faz a decisão sobreviver.
    expect(plan.trace?.entry.screenSourceIds).toEqual({ invoices: antiga });
  });

  it('o que o pacote já declara também não é recalculado', () => {
    const declared: CatalogScreenInput = {
      key: 'invoices',
      sourceId: 'billing-invoice-screen',
      titleSingular: 'Invoice',
      titleFieldKey: 'number',
      fields: [{ key: 'number', label: 'Number', type: 'text', required: true, order: 0, origin: 'plugin' }],
      ownerPluginId: 'com.example.billing',
    };
    const plan = buildArtifactPlan(invoiceModel(), buildDomainCatalog([declared]));
    expect(idOf(plan, 'invoices')).toBe('billing-invoice-screen');
    expect(plan.screenPlan.screens[0].sourceIdFrom).toBe('declared');
  });

  /**
   * E a divergência entre o pacote e o livro é ERRO, com o valor registrado dito na mensagem: a
   * correção é escrever o registrado no pacote, nunca levar o novo para o escritório.
   */
  it('o pacote declarando um sourceId e o livro registrando outro é ERRO, e o livro ganha', () => {
    const declared: CatalogScreenInput = {
      key: 'invoices',
      sourceId: 'a-new-idea',
      titleSingular: 'Invoice',
      titleFieldKey: 'number',
      fields: [{ key: 'number', label: 'Number', type: 'text', required: true, order: 0, origin: 'plugin' }],
      ownerPluginId: 'com.example.billing',
    };
    const plan = buildArtifactPlan(invoiceModel(), buildDomainCatalog([declared]), {
      rule: RULE,
      ledger: ledgerWith(['invoices'], { invoices: 'com.example.billing:invoices' }),
    });

    const issue = plan.issues.find((one) => one.code === 'domain.plan.screen-source-id-divergent');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('com.example.billing:invoices');
    expect(issue?.suggestion).toContain('Write "com.example.billing:invoices"');
    expect(idOf(plan, 'invoices')).toBe('com.example.billing:invoices');
    expect(plan.ok).toBe(false);
  });

  /** Aplicar o plano e planejar de novo: a segunda passada LÊ a identidade, não a deriva outra vez. */
  it('a identidade viaja com a tela proposta, e a passada seguinte a reusa', () => {
    const first = buildArtifactPlan(invoiceModel(), CATALOG);
    const second = buildArtifactPlan(invoiceModel(), applyPlanToCatalog(CATALOG, first));
    expect(second.screenPlan.screens[0].sourceIdFrom).toBe('declared');
    expect(idOf(second, 'invoices')).toBe(idOf(first, 'invoices'));
  });
});

describe('o portão cobra a identidade', () => {
  /** Sem espaço de nomes não há o que derivar, e uma tela sem identidade é a próxima versão duplicando-a. */
  it('tela planejada SEM sourceId é ERRO, e o defeito diz o que faltou', () => {
    const model = invoiceModel();
    const plan = buildScreenPlan({
      model,
      screenInputs: [{
        key: 'invoices',
        titleSingular: 'Invoice',
        titleFieldKey: 'number',
        fields: [{ key: 'number', label: 'Number', type: 'text', required: true, order: 0, origin: 'plugin' }],
      }],
      transitions: [],
      embeds: [],
      sourceIdNamespace: '   ',
    });
    const issue = plan.issues.find((one) => one.code === 'domain.plan.screen-source-id-missing');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('no universal identity');
    expect(plan.screens[0].sourceId).toBe('');
  });

  it('duas telas do MESMO plano com o mesmo sourceId é ERRO', () => {
    const model: DomainModel = {
      ...invoiceModel(),
      entities: ['invoices', 'receipts'].map((collection) => ({
        name: collection,
        kind: 'entity' as const,
        collection,
        titleField: 'name',
        fields: [{ key: 'name', label: 'Name', semanticType: 'scalar' as const, type: 'text' as const }],
      })),
    };
    const plan = buildArtifactPlan(model, CATALOG, {
      rule: RULE,
      ledger: ledgerWith(['invoices', 'receipts'], {
        invoices: 'com.example.billing:one',
        receipts: 'com.example.billing:one',
      }),
    });
    const issue = plan.issues.find((one) => one.code === 'domain.plan.screen-source-id-duplicate');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('invoices, receipts');
    expect(plan.ok).toBe(false);
  });
});

/**
 * A INTEGRIDADE DO LIVRO. Ele é escrito pelo agente, e isso era aceitável enquanto ele só respondia
 * "que telas esta regra gerou". Agora ele é a fonte de uma chave de identidade: uma linha que
 * escorregou não custa nada hoje e instala uma segunda tela na passada seguinte.
 */
describe('o livro, que agora é dependência', () => {
  const installed: CatalogScreenInput = {
    key: 'invoices',
    titleSingular: 'Invoice',
    titleFieldKey: 'number',
    fields: [
      { key: 'number', label: 'Number', type: 'text', required: true, order: 0, origin: 'plugin' },
      { key: 'amount', label: 'Amount', type: 'number', required: false, order: 1, origin: 'plugin' },
    ],
    ownerPluginId: 'com.example.billing',
  };

  it('na PRIMEIRA leva não há o que conferir, e nada é dito', () => {
    const plan = buildArtifactPlan(invoiceModel(), CATALOG, { rule: RULE });
    expect(plan.ledgerIntegrity).toBeNull();
    expect(plan.issues.filter((one) => one.code === 'domain.plan.ledger-out-of-step')).toEqual([]);
  });

  it('a tela que JÁ EXISTE e o livro não menciona é acusada — é ali que a identidade se perde', () => {
    const plan = buildArtifactPlan(invoiceModel(), buildDomainCatalog([installed]), {
      rule: RULE,
      ledger: ledgerWith([], {}),
    });
    expect(plan.ledgerIntegrity?.findings.join('\n')).toContain('the screen "invoices" already exists here');
    const issue = plan.issues.find((one) => one.code === 'domain.plan.ledger-out-of-step');
    expect(issue?.severity).toBe('warning');
    expect(issue?.suggestion).toContain('trace.contents');
  });

  it('o livro mencionando artefato que não existe em lugar nenhum é acusado também', () => {
    const plan = buildArtifactPlan(invoiceModel(), CATALOG, {
      rule: RULE,
      ledger: ledgerWith(['invoices', 'ghosts'], { invoices: 'com.example.billing:invoices' }),
    });
    expect(plan.ledgerIntegrity?.findings.join('\n')).toContain('the ledger records the screen "ghosts"');
  });

  it('a entrada que registra identidade para uma tela que ela não lista discorda de si mesma', () => {
    const plan = buildArtifactPlan(invoiceModel(), CATALOG, {
      rule: RULE,
      ledger: ledgerWith(['invoices'], {
        invoices: 'com.example.billing:invoices',
        receipts: 'com.example.billing:receipts',
      }),
    });
    expect(plan.ledgerIntegrity?.findings.join('\n')).toContain('does not list it among the screens');
  });

  it('o livro que fecha com a realidade não diz nada, e é o caso normal', () => {
    const first = buildArtifactPlan(invoiceModel(), CATALOG, { rule: RULE, ledger: emptyRuleLedger() });
    const ledger: RuleLedger = { version: 1, rules: [first.trace?.entry as never] };
    const second = buildArtifactPlan(invoiceModel(), applyPlanToCatalog(CATALOG, first), {
      rule: RULE,
      ledger,
    });
    expect(second.ledgerIntegrity?.findings).toEqual([]);
    expect(second.issues.filter((one) => one.code === 'domain.plan.ledger-out-of-step')).toEqual([]);
    expect(errors(second.issues)).toEqual([]);
  });

  /** Um livro escrito ANTES disto não registrava identidade: a ausência é "derive", nunca um defeito. */
  it('um livro sem identidade registrada não é acusado de nada — a ausência vale "derive"', () => {
    const plan = buildArtifactPlan(invoiceModel(), buildDomainCatalog([installed]), {
      rule: RULE,
      ledger: ledgerWith(['invoices'], {}),
    });
    expect(plan.ledgerIntegrity?.findings).toEqual([]);
    expect(idOf(plan, 'invoices')).toBe('com.example.billing:invoices');
    expect(errors(plan.issues)).toEqual([]);
  });
});
