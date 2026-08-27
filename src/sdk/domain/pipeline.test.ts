import { describe, expect, it } from 'vitest';
import { applyPlanToCatalog, buildArtifactPlan } from './artifactPlan';
import { parseBusinessRule } from './businessRule';
import { buildDomainCatalog } from './catalog';
import type { DomainModel } from './domainModel';
import { emptyRuleLedger, withRuleEntry } from './traceability';
import { validateDomainModel } from './validateDomainModel';

/**
 * O PIPELINE INTEIRO, uma vez: uma frase de regra -> modelo -> validação -> plano.
 *
 * O teste de unidade de cada peça já existe, e ele não responde à pergunta que importa. Um detector
 * pode estar correto, o mapeamento pode estar correto, o plano pode estar correto, e o CAMINHO entre
 * eles estar errado — foi assim que o `from` de uma transição virou prosa: cada peça o carregava, e
 * nenhuma dizia onde ele era conferido em runtime.
 *
 * Então o cenário é o teste. A regra abaixo é de três linhas, como as regras chegam, e o que se cobra
 * do plano é cada uma das regras do plano de telas — as telas certas, NENHUMA tela para o filho no
 * menu, NENHUMA para a lista de opções, o campo de referência do lado certo, o derivado somente
 * leitura, o estado na listagem, e uma ação por transição de gesto com o `disabledWhen` que a
 * invariante `blocks` produziu.
 *
 * Negócio nomeado aqui é deliberado, e é o mesmo que `corpus.test-support.ts` já faz: modelagem só se
 * demonstra sobre um domínio concreto. Nada disto entra no kernel nem em artefato nenhum.
 */

const CATALOG = buildDomainCatalog([]);

const STATEMENT = [
  'A purchase order is raised as a draft and has to be approved before anyone buys anything.',
  'Only the buying manager approves an order, and no order can be approved while its total is zero.',
  'Each order carries its lines, and the total of the order is the sum of them.',
].join(' ');

const RULE = {
  id: 'purchase-order-approval',
  statement: STATEMENT,
  actors: ['the buying manager'],
  concepts: ['PurchaseOrder', 'OrderLine', 'Supplier'],
  invariants: [
    'no order is approved while its total is zero',
    'a line counts at least one unit',
  ],
  processes: ['an order is approved', 'an order is rejected'],
  acceptance: [
    'an order with no lines cannot be approved',
    'the total of the order equals the sum of its lines',
  ],
};

/** O modelo que um bom modelador escreve a partir daquela frase. */
const purchaseModel = (): DomainModel => ({
  version: 1,
  intent: STATEMENT,
  target: 'extension',
  extensionId: 'com.example.purchasing',
  entities: [
    {
      name: 'Supplier',
      kind: 'entity',
      collection: 'suppliers',
      titleField: 'name',
      fields: [
        { key: 'name', label: 'Name', semanticType: 'scalar', type: 'text' },
        { key: 'taxId', label: 'Tax id', semanticType: 'scalar', type: 'masked' },
      ],
    },
    { name: 'OrderStatus', kind: 'lookup', collection: 'orderStatuses', fields: [] },
    {
      name: 'PurchaseOrder',
      kind: 'entity',
      collection: 'purchaseOrders',
      titleField: 'number',
      fields: [
        { key: 'number', label: 'Number', semanticType: 'scalar', type: 'text' },
        { key: 'supplierId', label: 'Supplier', semanticType: 'reference', target: 'Supplier', required: true },
        { key: 'status', label: 'Status', semanticType: 'scalar', type: 'select', lookup: 'orderStatuses' },
        { key: 'raisedAt', label: 'Raised at', semanticType: 'scalar', type: 'date' },
        {
          key: 'total',
          label: 'Total',
          semanticType: 'derived',
          derivedFrom: 'children',
          type: 'currency',
          aggregation: { from: 'OrderLine', via: 'orderId', op: 'sum', field: 'lineTotal' },
        },
      ],
    },
    {
      name: 'OrderLine',
      kind: 'child',
      collection: 'purchaseOrderLines',
      titleField: 'description',
      fields: [
        { key: 'description', label: 'Description', semanticType: 'scalar', type: 'text' },
        { key: 'orderId', label: 'Order', semanticType: 'reference', target: 'PurchaseOrder', required: true },
        { key: 'quantity', label: 'Quantity', semanticType: 'scalar', type: 'number' },
        { key: 'unitPrice', label: 'Unit price', semanticType: 'scalar', type: 'currency' },
        {
          key: 'lineTotal',
          label: 'Line total',
          semanticType: 'derived',
          derivedFrom: 'self',
          type: 'currency',
          expression: 'quantity * unitPrice',
        },
      ],
    },
  ],
  relationships: [
    { sourceEntity: 'PurchaseOrder', targetEntity: 'Supplier', sourceField: 'supplierId', type: 'many-to-one', storage: 'reference', ownership: 'association', required: true },
    { sourceEntity: 'PurchaseOrder', targetEntity: 'OrderStatus', sourceField: 'status', type: 'many-to-one', storage: 'lookup', ownership: 'association' },
    { sourceEntity: 'OrderLine', targetEntity: 'PurchaseOrder', sourceField: 'orderId', type: 'many-to-one', storage: 'child', ownership: 'composition', required: true },
  ],
  behavior: {
    states: [{
      entity: 'PurchaseOrder',
      field: 'status',
      lookup: 'orderStatuses',
      initial: 'draft',
      terminal: ['approved', 'rejected'],
      options: [
        { key: 'draft', label: 'Draft' },
        { key: 'approved', label: 'Approved' },
        { key: 'rejected', label: 'Rejected' },
      ],
    }],
    transitions: [
      {
        name: 'approve',
        description: 'approves a draft purchase order that has lines on it, which is what releases the buying',
        entity: 'PurchaseOrder',
        from: 'draft',
        to: 'approved',
        trigger: { kind: 'user-action', action: 'approve-order' },
        actor: 'the buying manager',
        permission: 'purchaseOrders.update',
        effects: [],
      },
      {
        name: 'reject',
        description: 'rejects a draft purchase order, which ends it without any buying',
        entity: 'PurchaseOrder',
        from: 'draft',
        to: 'rejected',
        trigger: { kind: 'user-action', action: 'reject-order' },
        effects: [],
      },
    ],
    invariants: [
      {
        scope: 'field',
        entity: 'OrderLine',
        field: 'quantity',
        expression: 'quantity > 0',
        message: 'A line counts at least one unit.',
      },
      {
        scope: 'transition',
        entity: 'PurchaseOrder',
        transition: 'approve',
        enforcement: 'blocks',
        expression: 'total > 0',
        message: 'An order with nothing on it cannot be approved.',
      },
    ],
  },
});

const plan = (model: DomainModel, catalog = CATALOG, ledger = emptyRuleLedger()) =>
  buildArtifactPlan(model, catalog, { rule: parseBusinessRule(RULE).rule ?? undefined, ledger });

describe('de uma frase de regra a um plano de telas', () => {
  it('a regra é lida como artefato, com o enunciado intacto', () => {
    const read = parseBusinessRule(RULE);
    expect(read.rule?.statement).toBe(STATEMENT);
    expect(read.rule?.id).toBe('purchase-order-approval');
    expect(read.issues).toEqual([]);
  });

  /** Uma frase colada, sem forma nenhuma, é o caso mais comum — e ela é o enunciado. */
  it('uma frase colada crua vira o enunciado, em vez de ser recusada por forma', () => {
    const read = parseBusinessRule('Only the manager approves an order.', 'pasted');
    expect(read.rule?.statement).toBe('Only the manager approves an order.');
    expect(read.rule?.id).toBe('pasted');
  });

  it('o modelo passa o portão sem erro nem aviso', () => {
    const result = validateDomainModel(purchaseModel(), CATALOG);
    const noise = result.issues.filter((one) => one.severity !== 'info');
    expect(noise.map((one) => `${one.code}: ${one.message}`)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('e a regra não fica mais distante do modelo do que devia', () => {
    const issues = plan(purchaseModel()).issues.filter((one) => one.code.startsWith('rule.'));
    expect(issues.map((one) => one.code)).toEqual([]);
  });

  // ─── As regras do item 1, uma a uma ─────────────────────────────────────────

  it('a entidade raiz rende listagem e detalhe; o filho é ABA do pai e não entra no menu', () => {
    const screens = plan(purchaseModel()).screenPlan.screens;
    const order = screens.find((one) => one.entity === 'PurchaseOrder');
    const line = screens.find((one) => one.entity === 'OrderLine');

    expect(order?.presence).toBe('menu-and-detail');
    expect(line?.presence).toBe('tab-of-parent');
    expect(line?.parent).toEqual({ collection: 'purchaseOrders', fieldKey: 'orderId', relation: 'owned' });
  });

  it('a lista de opções NUNCA rende tela — e o plano diz que não rende', () => {
    const result = plan(purchaseModel());
    expect(result.screenPlan.screens.map((one) => one.collection)).not.toContain('orderStatuses');
    expect(result.lookups.map((one) => one.collection)).toContain('orderStatuses');
    const said = result.screenPlan.notScreens.find((one) => one.entity === 'OrderStatus');
    expect(said?.becomes).toContain('orderStatuses');
    expect(said?.because).toContain('vocabulary');
  });

  it('o many-to-one põe o campo de referência no lado N, e o rótulo NÃO é copiado', () => {
    const order = plan(purchaseModel()).screenPlan.screens.find((one) => one.entity === 'PurchaseOrder');
    const supplier = order?.referenceFields.find((one) => one.key === 'supplierId');
    expect(supplier?.points).toBe('suppliers');
    expect(supplier?.labelResolvedBy).toContain('when the record is drawn');
    // E não há campo nenhum guardando o nome do fornecedor.
    expect(order?.listColumns.map((one) => one.key)).not.toContain('supplierName');
  });

  it('o one-to-many que não é filho não rende nada, e o plano DIZ que não rende', () => {
    const said = plan(purchaseModel()).screenPlan.notScreens
      .find((one) => one.entity.startsWith('Supplier <- PurchaseOrder.supplierId'));
    expect(said?.becomes).toBe('nothing');
    expect(said?.because).toContain('storage "child"');
  });

  it('o campo derivado é somente leitura — e não por declaração, por mecanismo', () => {
    const screens = plan(purchaseModel()).screenPlan.screens;
    const order = screens.find((one) => one.entity === 'PurchaseOrder');
    const line = screens.find((one) => one.entity === 'OrderLine');
    expect(order?.readOnlyFields.map((one) => one.key)).toEqual(['total']);
    expect(order?.readOnlyFields[0].because).toContain('aggregated from children');
    expect(line?.readOnlyFields.map((one) => one.key)).toEqual(['lineTotal']);
    expect(line?.readOnlyFields[0].because).toContain('logic.compute');
  });

  it('o campo de ESTADO vai para a listagem e é filtrável, por padrão', () => {
    const order = plan(purchaseModel()).screenPlan.screens.find((one) => one.entity === 'PurchaseOrder');
    expect(order?.listColumns.map((one) => one.key)).toContain('status');
    expect(order?.filterableFields.map((one) => one.key)).toContain('status');
    expect(order?.filterableFields.find((one) => one.key === 'status')?.because).toContain('the state');
  });

  it('o campo-título é obrigatório e é a primeira coluna', () => {
    const order = plan(purchaseModel()).screenPlan.screens.find((one) => one.entity === 'PurchaseOrder');
    expect(order?.titleFieldKey).toBe('number');
    expect(order?.listColumns[0].key).toBe('number');
  });

  /**
   * O derivado NÃO entra na listagem por reflexo, e a ausência é a regra: um total é lido no detalhe, e
   * pôr todo total na lista é uma decisão sobre a LISTA. Sem isso a regra de colocação da ação também
   * não morderia — o `total` ficaria visível no cartão e toda ação viraria escolha humana.
   */
  it('o total não entra na listagem sozinho', () => {
    const order = plan(purchaseModel()).screenPlan.screens.find((one) => one.entity === 'PurchaseOrder');
    expect(order?.listColumns.map((one) => one.key)).not.toContain('total');
  });

  it('as abas de anotação, documento e etiqueta nascem DESLIGADAS', () => {
    expect(plan(purchaseModel()).screenPlan.screens.every((one) => one.tabs.length === 0)).toBe(true);
  });

  it('e ligadas, elas carregam o motivo — sem motivo, não entram', () => {
    const model = purchaseModel();
    const order = model.entities.find((one) => one.name === 'PurchaseOrder');
    if (order) order.tabs = [{ kind: 'documents', because: 'the supplier sends the quote as a file' }];
    const screen = plan(model).screenPlan.screens.find((one) => one.entity === 'PurchaseOrder');
    expect(screen?.tabs).toEqual([{ kind: 'documents', because: 'the supplier sends the quote as a file' }]);
  });

  it('ícone e ordem de menu ficam FORA, e o plano diz que a escolha é humana', () => {
    const decisions = plan(purchaseModel()).screenPlan.humanDecisions.join('\n');
    expect(decisions).toContain('`icon`');
    expect(decisions).toContain('`sidebarOrder`');
  });

  // ─── As transições ──────────────────────────────────────────────────────────

  it('toda transição de gesto rende UMA ação de registro, e nenhuma de gravação rende', () => {
    const order = plan(purchaseModel()).screenPlan.screens.find((one) => one.entity === 'PurchaseOrder');
    expect(order?.actions.map((one) => one.key).sort()).toEqual(['approve-order', 'reject-order']);
    expect(order?.actions.map((one) => one.transition).sort()).toEqual(['approve', 'reject']);
  });

  it('o `disabledWhen` da ação carrega o `from` MAIS a invariante que BLOQUEIA', () => {
    const order = plan(purchaseModel()).screenPlan.screens.find((one) => one.entity === 'PurchaseOrder');
    const approve = order?.actions.find((one) => one.key === 'approve-order');
    expect(approve?.disabledWhen).toBe('!(record.status == "draft") || !(total > 0)');
    // E a de rejeitar não ganha a invariante da outra: `blocks` é DAQUELA passagem.
    expect(order?.actions.find((one) => one.key === 'reject-order')?.disabledWhen)
      .toBe('!(record.status == "draft")');
  });

  it('a permissão vira `hiddenWhen`, e o fluxo pede o parâmetro de referência que o resolve', () => {
    const order = plan(purchaseModel()).screenPlan.screens.find((one) => one.entity === 'PurchaseOrder');
    const approve = order?.actions.find((one) => one.key === 'approve-order');
    expect(approve?.hiddenWhen).toBe('!hasPermission("purchaseOrders.update")');
    expect(approve?.requiresParameter).toBe('purchaseOrder');
    expect(approve?.workflowCondition).toBe('purchaseOrder.status == "draft"');
    expect(approve?.eventName).toBe('workflow.called');
  });

  /**
   * ONDE a ação aparece muda o que ela significa, e o plano só decide a parte derivável: um gesto
   * recusado por um campo que o cartão não mostra é um botão apagado sem motivo visível.
   */
  it('a colocação é decidida quando é legibilidade, e DEVOLVIDA quando é fluxo de trabalho', () => {
    const order = plan(purchaseModel()).screenPlan.screens.find((one) => one.entity === 'PurchaseOrder');
    const approve = order?.actions.find((one) => one.key === 'approve-order');
    const reject = order?.actions.find((one) => one.key === 'reject-order');

    expect(approve?.placement).toBe('detail-header');
    expect(approve?.placementBecause).toContain('total');
    expect(reject?.placement).toBe('human-choice');
    expect(order?.humanDecisions.some((one) => one.includes('reject-order'))).toBe(true);
  });

  it('a descrição da transição chega à ação — é ela que o detector de automação lê', () => {
    const order = plan(purchaseModel()).screenPlan.screens.find((one) => one.entity === 'PurchaseOrder');
    expect(order?.actions.find((one) => one.key === 'approve-order')?.description)
      .toContain('approves a draft purchase order');
  });

  it('uma transição de gesto SEM descrição é acusada, e o defeito nomeia o mecanismo', () => {
    const model = purchaseModel();
    const approve = model.behavior?.transitions.find((one) => one.name === 'approve');
    if (approve) delete approve.description;
    const issue = validateDomainModel(model, CATALOG).issues
      .find((one) => one.code === 'behavior.transition.without-description');
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('ai-detect-workflow');
    expect(issue?.message).toContain('workflow.called');
  });

  // ─── Reaplicação ────────────────────────────────────────────────────────────

  it('a MESMA regra duas vezes não propõe nada', () => {
    const first = plan(purchaseModel());
    const ledger = withRuleEntry(emptyRuleLedger(), first.trace?.entry as never);
    const second = plan(purchaseModel(), applyPlanToCatalog(CATALOG, first), ledger);

    expect(second.screens.map((one) => one.operation)).toStrictEqual(second.screens.map(() => 'unchanged'));
    expect(second.lookups.map((one) => one.operation)).toStrictEqual(second.lookups.map(() => 'unchanged'));
    expect(second.deactivations).toEqual([]);
    expect(second.trace?.delta.unchanged).toBe(true);
    expect(second.versionBump).toBeNull();
  });

  it('a regra ALTERADA propõe só o delta — um campo a mais, um estado a mais', () => {
    const first = plan(purchaseModel());
    const ledger = withRuleEntry(emptyRuleLedger(), first.trace?.entry as never);
    const catalog = applyPlanToCatalog(CATALOG, first);

    const changed = purchaseModel();
    const order = changed.entities.find((one) => one.name === 'PurchaseOrder');
    order?.fields.push({ key: 'approvedAt', label: 'Approved at', semanticType: 'scalar', type: 'date' });
    const state = changed.behavior?.states[0];
    state?.options.push({ key: 'cancelled', label: 'Cancelled' });
    state?.terminal?.push('cancelled');
    changed.behavior?.transitions.push({
      name: 'cancel',
      description: 'cancels an approved order, which stops the buying that it had released',
      entity: 'PurchaseOrder',
      from: 'approved',
      to: 'cancelled',
      trigger: { kind: 'user-action', action: 'cancel-order' },
      effects: [],
    });

    const second = buildArtifactPlan(changed, catalog, { rule: parseBusinessRule(RULE).rule ?? undefined, ledger });

    // Só a tela do pedido muda, e nela só o campo novo.
    expect(second.screens.filter((one) => one.operation !== 'unchanged').map((one) => one.collection))
      .toEqual(['purchaseOrders']);
    const changedFields = second.screens
      .find((one) => one.collection === 'purchaseOrders')?.fields
      .filter((one) => one.operation !== 'unchanged');
    expect(changedFields?.map((one) => one.key)).toEqual(['approvedAt']);

    expect(second.trace?.delta.unchanged).toBe(false);
    expect(second.trace?.delta.added.actions).toEqual(['cancel-order']);
    expect(second.trace?.delta.added.transitions).toEqual(['cancel']);
    expect(second.trace?.delta.added.screens).toEqual([]);
    expect(second.deactivations).toEqual([]);
  });

  it('a regra que PERDEU uma entidade propõe desativar — nunca excluir', () => {
    const first = plan(purchaseModel());
    const ledger = withRuleEntry(emptyRuleLedger(), first.trace?.entry as never);
    const catalog = applyPlanToCatalog(CATALOG, first);

    // A regra mudou: o fornecedor deixou de ser cadastro deste sistema.
    const shrunk = purchaseModel();
    shrunk.entities = shrunk.entities.filter((one) => one.name !== 'Supplier');
    shrunk.relationships = shrunk.relationships.filter((one) => one.targetEntity !== 'Supplier');
    const order = shrunk.entities.find((one) => one.name === 'PurchaseOrder');
    if (order) order.fields = order.fields.filter((one) => one.key !== 'supplierId');

    const second = buildArtifactPlan(shrunk, catalog, { rule: parseBusinessRule(RULE).rule ?? undefined, ledger });

    expect(second.trace?.delta.dropped.screens).toEqual(['suppliers']);
    expect(second.deactivations).toEqual([{
      kind: 'screen',
      target: 'suppliers',
      because: '"purchase-order-approval" created "suppliers" and the rule as it reads now does not need it.',
      howTo: expect.stringContaining('enabled: false'),
    }]);

    const said = second.issues.find((one) => one.code === 'domain.plan.deactivate-proposed');
    expect(said?.severity).toBe('warning');
    expect(said?.message).toContain('DISABLING');
    expect(said?.suggestion).toContain('Disable, never delete');

    // E o campo que sobrou na coleção NÃO é removido: o plano nunca remove.
    const retained = second.screens.find((one) => one.collection === 'purchaseOrders')?.retainedFields;
    expect(retained).toContain('supplierId');
  });

  /** O vínculo é do WORKSPACE. Se ele fosse do artefato, esta comparação exigiria ler a instalação. */
  it('o vínculo grava o que a regra produziu, e nada mais', () => {
    const entry = plan(purchaseModel()).trace?.entry;
    expect(entry?.ruleId).toBe('purchase-order-approval');
    expect(entry?.statement).toBe(STATEMENT);
    expect(entry?.screens).toEqual(['purchaseOrderLines', 'purchaseOrders', 'suppliers']);
    expect(entry?.lists).toEqual(['orderStatuses']);
    expect(entry?.actions).toEqual(['approve-order', 'reject-order']);
    expect(entry?.transitions).toEqual(['approve', 'reject']);
    expect(entry?.permissions).toEqual(['purchaseOrders.update']);
    expect(entry?.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  /**
   * A IDENTIDADE das telas entra no livro junto com o que a regra produziu — e é o único campo dele
   * que não é uma lista do que foi feito, mas uma chave que a próxima versão tem de OBEDECER.
   */
  it('o vínculo grava também a identidade universal de cada tela, e a leva seguinte a LÊ', () => {
    const first = plan(purchaseModel());
    expect(first.trace?.entry.screenSourceIds).toEqual({
      purchaseOrderLines: 'com.example.purchasing:purchaseOrderLines',
      purchaseOrders: 'com.example.purchasing:purchaseOrders',
      suppliers: 'com.example.purchasing:suppliers',
    });

    const ledger = withRuleEntry(emptyRuleLedger(), first.trace?.entry as never);
    const second = plan(purchaseModel(), applyPlanToCatalog(CATALOG, first), ledger);
    expect(second.screenPlan.screens.map((one) => one.sourceIdFrom)).toStrictEqual(
      second.screenPlan.screens.map(() => 'ledger'),
    );
    expect(second.trace?.entry.screenSourceIds).toEqual(first.trace?.entry.screenSourceIds);
    expect(second.ledgerIntegrity?.findings).toEqual([]);
    expect(second.issues.filter((one) => one.severity === 'error')).toEqual([]);
  });

  it('a impressão digital distingue a mesma regra de uma parecida', () => {
    const same = plan(purchaseModel()).trace?.entry.fingerprint;
    const other = buildArtifactPlan(purchaseModel(), CATALOG, {
      rule: { ...RULE, statement: `${STATEMENT} And the manager may not approve their own order.` },
    }).trace?.entry.fingerprint;
    expect(same).not.toBe(other);
  });
});

/**
 * O AFROUXAMENTO DO `unreachable`, e o custo dele DITO. Efeito com valor literal conta como entrada
 * daquela chave; com expressão conta como entrada de todas — o que é a direção segura e é silenciosa.
 */
describe('a alcançabilidade que não é verificável', () => {
  const withComputedState = (): DomainModel => {
    const model = purchaseModel();
    model.behavior?.transitions.push({
      name: 'settle',
      description: 'settles an order into whatever state the supplier answer implies',
      entity: 'PurchaseOrder',
      from: 'approved',
      to: 'approved',
      trigger: { kind: 'user-action', action: 'settle-order' },
      effects: [{ kind: 'set-field', field: 'status', value: 'total > 0 ? "approved" : "rejected"' }],
    });
    return model;
  };

  it('emite um INFO nomeando a entidade, a transição e o que deixou de ser conferido', () => {
    const issue = validateDomainModel(withComputedState(), CATALOG).issues
      .find((one) => one.code === 'behavior.state.reachability-not-verifiable');
    expect(issue?.severity).toBe('info');
    expect(issue?.entity).toBe('PurchaseOrder');
    expect(issue?.message).toContain('"settle" via set-field');
    expect(issue?.message).toContain('neither check can fire');
  });

  it('e o INFO não bloqueia: o modelo continua chegando a plano', () => {
    const result = buildArtifactPlan(withComputedState(), CATALOG);
    expect(result.ok).toBe(true);
  });

  it('sem efeito calculado, o INFO não aparece — ele é o custo de um caso, não um aviso de rotina', () => {
    const codes = validateDomainModel(purchaseModel(), CATALOG).issues.map((one) => one.code);
    expect(codes).not.toContain('behavior.state.reachability-not-verifiable');
  });
});
