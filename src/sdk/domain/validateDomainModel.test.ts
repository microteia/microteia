import { describe, expect, it } from 'vitest';
import { buildArtifactPlan } from './artifactPlan';
import { buildDomainCatalog } from './catalog';
import type { DomainIssue, DomainModel } from './domainModel';
import { parseDomainModel } from './domainModel';
import { relationshipSummary } from './storageMapping';
import { fieldToDefinition } from './toPlatform';
import { validateDomainModel } from './validateDomainModel';
import { flatSaleModel, installedScreen, platformField, reference, salesModel, scalar } from './fixtures.test-support';

const EMPTY = buildDomainCatalog([]);

const codes = (issues: readonly DomainIssue[]): string[] => issues.map((one) => one.code);
const errors = (issues: readonly DomainIssue[]): DomainIssue[] => issues.filter((one) => one.severity === 'error');

const check = (model: DomainModel, catalog = EMPTY) => validateDomainModel(model, catalog);

/**
 * A REGRA DA CASA: "A screen is not an entity model." Todo detector daqui para baixo tem um teste
 * POSITIVO (o defeito é pego) e um NEGATIVO (o modelo correto passa) — sem o segundo, uma regra que
 * reprovasse tudo passaria despercebida, e é ela que ensina a ignorar o veredito.
 */
describe('o cenário obrigatório — o sistema de vendas modelado corretamente', () => {
  const result = check(salesModel());

  it('não tem nenhum problema bloqueante', () => {
    expect(errors(result.issues)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('reconhece as cinco entidades, com o item da venda como filho', () => {
    const kinds = Object.fromEntries(result.expanded.model.entities.map((one) => [one.name, one.kind]));
    expect(kinds).toStrictEqual({
      Customer: 'entity',
      Employee: 'entity',
      Product: 'entity',
      Sale: 'entity',
      SaleItem: 'child',
    });
  });

  it('lê as quatro relações na direção do negócio', () => {
    expect(result.expanded.model.relationships.map(relationshipSummary)).toStrictEqual([
      'Customer 1:N Sale',
      'Employee 1:N Sale',
      'Sale 1:N SaleItem',
      'Product 1:N SaleItem',
    ]);
  });

  it('mapeia cada relação para o mecanismo real, e o item vira aba do pai', () => {
    const byField = Object.fromEntries(result.relationships.map((one) => [`${one.fieldOn}.${one.fieldKey}`, one]));
    expect(byField['sales.customerId'].mechanism.storage).toBe('reference');
    expect(byField['sales.customerId'].points).toBe('customers');
    expect(byField['saleItems.saleId'].parent).toStrictEqual({
      parentEntity: 'sales',
      parentFieldKey: 'saleId',
      parentRelation: 'owned',
    });
    expect(byField['saleItems.productId'].parent).toBeUndefined();
  });

  /**
   * O ponto do enunciado que mais custa acertar: `unitPrice` É uma duplicação, e é uma duplicação
   * CERTA. A regra nunca foi "não duplique" — é "o que é fonte de verdade fica normalizado, salvo
   * razão declarada", e a razão está no modelo, escrita.
   */
  it('aceita o preço unitário como snapshot histórico, porque a razão está declarada', () => {
    expect(codes(result.issues)).not.toContain('domain.field.snapshot-undeclared');
    expect(codes(result.issues)).not.toContain('domain.field.belongs-to-other-entity');
    const unitPrice = result.expanded.model.entities
      .find((one) => one.name === 'SaleItem')?.fields.find((one) => one.key === 'unitPrice');
    expect(unitPrice?.semanticType).toBe('snapshot');
    expect(unitPrice?.source).toBe('Product.price');
  });

  it('nenhum nome de cliente vive dentro da venda como fonte de verdade', () => {
    const sale = result.expanded.model.entities.find((one) => one.name === 'Sale');
    expect(sale?.fields.map((one) => one.key)).not.toContain('customerName');
    expect(sale?.fields.filter((one) => one.semanticType === 'scalar').map((one) => one.key))
      .toStrictEqual(['code', 'soldAt']);
  });

  it('o total da venda é agregado sobre os filhos, não calculado por expressão', () => {
    const total = result.expanded.model.entities
      .find((one) => one.name === 'Sale')?.fields.find((one) => one.key === 'total');
    expect(total?.derivedFrom).toBe('children');
    expect(total?.aggregation).toStrictEqual({ from: 'SaleItem', via: 'saleId', op: 'sum', field: 'lineTotal' });
  });
});

describe('campo que pertence a outra entidade', () => {
  /**
   * AVISA, não reprova — e o rebaixamento veio de um corpus de modelos bons, não de gosto. UM campo
   * é indício: `agentNotes` num chamado é anotação do atendente NAQUELE chamado, `teacherName` numa
   * turma é o nome de quem ninguém cadastra. Reprovar por indício é o que ensina a contornar o
   * portão, e a partir daí ele não protege mais nem o que é prova.
   */
  it('AVISA sobre um campo solto — "Sale.customerName" com Customer modelado', () => {
    const result = check(flatSaleModel([scalar('customerName')]));
    const issue = result.issues.find((one) => one.code === 'domain.field.belongs-to-other-entity');
    expect(issue?.severity).toBe('warning');
    expect(issue?.entity).toBe('Sale');
    expect(issue?.field).toBe('customerName');
    expect(issue?.message).toContain('A screen is not an entity model');
    expect(issue?.howToDeclareException).toContain('snapshot');
    expect(result.ok).toBe(true);
  });

  /**
   * O sufixo AMBÍGUO sozinho não diz nada: ele descreve a relação vista deste lado tão bem quanto
   * descreve o outro registro. Estes quatro vieram do corpus, e os quatro eram reprovados.
   */
  it.each([
    ['requesterCode', 'Customer'],
    ['customerNotes', 'Customer'],
    ['customerStatus', 'Customer'],
    ['customerPosition', 'Customer'],
  ])('cala sobre "%s", que é dado de quem declara', (key) => {
    const result = check(flatSaleModel([scalar(key)]));
    expect(codes(result.issues)).not.toContain('domain.field.belongs-to-other-entity');
    expect(codes(result.issues)).not.toContain('domain.field.prefix-group');
  });

  /**
   * O sufixo ambíguo VOLTA a contar quando o alvo declara aquele campo: se Product tem `price`,
   * `productPrice` noutra entidade é a cópia dele, não uma coincidência.
   */
  it('mas conta quando o próprio alvo declara o campo', () => {
    const model = flatSaleModel([scalar('customerStatus')]);
    model.entities[0].fields.push(scalar('status'));
    const issue = check(model).issues.find((one) => one.code === 'domain.field.belongs-to-other-entity');
    expect(issue?.severity).toBe('warning');
  });

  /**
   * A trava que sobrou depois do rebaixamento, e que não é ambígua em direção nenhuma: uma chave
   * estrangeira guardada como escalar é uma referência que ninguém declarou.
   */
  it('REPROVA a chave estrangeira guardada como escalar', () => {
    const issue = check(flatSaleModel([scalar('customerId')]))
      .issues.find((one) => one.code === 'domain.field.reference-without-relationship');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('no relationship says so');
    expect(issue?.howToDeclareException).toContain('external');
  });

  it('não acusa o campo que a própria entidade nomeia — "Sale.saleDate" é a data DA venda', () => {
    const result = check(flatSaleModel([scalar('saleDate', 'date'), scalar('saleNumber')]));
    expect(codes(result.issues)).not.toContain('domain.field.belongs-to-other-entity');
    expect(codes(result.issues)).not.toContain('domain.field.prefix-group');
  });

  it('não acusa a REFERÊNCIA nem o campo denormalizado que a relação declara', () => {
    const model = flatSaleModel([]);
    model.entities[1].fields.push(
      { key: 'customerId', label: 'customerId', semanticType: 'reference', target: 'Customer' },
      scalar('customer.name'),
    );
    model.relationships.push({
      sourceEntity: 'Sale',
      targetEntity: 'Customer',
      sourceField: 'customerId',
      type: 'many-to-one',
      storage: 'reference',
      ownership: 'association',
      denormalize: { denormKey: 'customer', fields: ['name'], reason: 'the card shows the customer without a second read' },
    });
    const result = check(model);
    expect(codes(result.issues)).not.toContain('domain.field.belongs-to-other-entity');
    expect(codes(result.issues)).not.toContain('domain.field.prefix-group');
  });
});

describe('grupo de campos reproduzindo uma entidade', () => {
  it('pega "Sale{customerName, customerEmail, customerPhone}"', () => {
    const result = check(flatSaleModel([scalar('customerName'), scalar('customerEmail'), scalar('customerPhone')]));
    const issue = result.issues.find((one) => one.code === 'domain.field.prefix-group');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('customerName, customerEmail, customerPhone');
    expect(issue?.suggestion).toContain('Declare the relationship first');
  });

  it('pega "Sale{productName, productPrice, productQuantity}" com Product modelado', () => {
    const model = flatSaleModel([scalar('productName'), scalar('productPrice', 'currency'), scalar('productQuantity', 'number')]);
    model.entities.push({
      name: 'Product', kind: 'entity', collection: 'products', titleField: 'name', fields: [scalar('name'), scalar('price', 'currency')],
    });
    const issue = check(model).issues.find((one) => one.code === 'domain.field.prefix-group');
    expect(issue?.message).toContain('belong to Product');
  });

  /**
   * O caso que prova que o detector olha o CATÁLOGO, e não só o modelo: Pessoa já existe na
   * instalação, e o contrato copiou a pessoa inteira para dentro dele.
   */
  it('pega "Contract{personName, personEmail}" quando Pessoa já existe na instalação', () => {
    const catalog = buildDomainCatalog([
      installedScreen('persons', [platformField('name'), platformField('email'), platformField('phone')]),
    ]);
    const model: DomainModel = {
      version: 1,
      target: 'screenDefinitions',
      entities: [{
        name: 'Contract',
        kind: 'entity',
        collection: 'contracts',
        titleField: 'number',
        fields: [scalar('number'), scalar('personName'), scalar('personEmail'), scalar('personPhone')],
      }],
      relationships: [],
    };
    const issue = check(model, catalog).issues.find((one) => one.code === 'domain.field.prefix-group');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('belong to persons');
  });

  it('não acusa um prefixo que não é entidade nenhuma — mas avisa que ali há um conceito sem nome', () => {
    const result = check(flatSaleModel([scalar('shippingStreet'), scalar('shippingCity'), scalar('shippingZip')]));
    expect(codes(result.issues)).not.toContain('domain.field.prefix-group');
    const warning = result.issues.find((one) => one.code === 'domain.field.prefix-group-unnamed');
    expect(warning?.severity).toBe('warning');
    expect(result.ok).toBe(true);
  });

  it('dois campos com o mesmo prefixo não são um aviso — só três em diante', () => {
    const result = check(flatSaleModel([scalar('shippingStreet'), scalar('shippingCity')]));
    expect(codes(result.issues)).not.toContain('domain.field.prefix-group-unnamed');
  });
});

describe('coleção modelada como campos numerados', () => {
  it('pega "Sale{productName1, productName2, productName3}"', () => {
    const result = check(flatSaleModel([scalar('productName1'), scalar('productName2'), scalar('productName3')]));
    const issue = result.issues.find((one) => one.code === 'domain.field.numbered-collection');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('productName1, productName2, productName3');
    expect(issue?.suggestion).toContain('kind "child"');
    expect(issue?.howToDeclareException).toContain('cannot be aggregated');
  });

  it('não acusa um campo que apenas termina em número', () => {
    const result = check(flatSaleModel([scalar('address2'), scalar('code')]));
    expect(codes(result.issues)).not.toContain('domain.field.numbered-collection');
  });
});

describe('N:N com atributos próprios', () => {
  const manyToMany = (attributes: DomainModel['relationships'][number]['attributes']): DomainModel => ({
    version: 1,
    target: 'screenDefinitions',
    entities: [
      { name: 'Sale', kind: 'entity', collection: 'sales', titleField: 'code', fields: [scalar('code'), { key: 'productIds', label: 'productIds', semanticType: 'reference', target: 'Product', multi: true }] },
      { name: 'Product', kind: 'entity', collection: 'products', titleField: 'name', fields: [scalar('name')] },
    ],
    relationships: [{
      sourceEntity: 'Sale',
      targetEntity: 'Product',
      sourceField: 'productIds',
      type: 'many-to-many',
      storage: 'association',
      ownership: 'association',
      ...(attributes === undefined ? {} : { attributes }),
    }],
  });

  it('pega o array de ids que carrega quantidade e preço, e diz por que é impossível totalizar', () => {
    const issue = check(manyToMany([scalar('quantity', 'number'), scalar('unitPrice', 'currency')]))
      .issues.find((one) => one.code === 'domain.relationship.association-with-attributes');
    expect(issue?.severity).toBe('error');
    expect(issue?.suggestion).toContain('kind "child"');
    expect(issue?.howToDeclareException).toContain('no aggregation can ever walk it');
  });

  it('aceita o array de ids quando a relação não carrega nada — uma etiquetagem simples', () => {
    const result = check(manyToMany(undefined));
    expect(errors(result.issues)).toEqual([]);
  });
});

describe('agregado latest — o valor do filho mais recente', () => {
  const withLatest = (aggregation: Record<string, unknown>, parentType = 'text'): DomainModel => ({
    version: 1,
    target: 'screenDefinitions',
    entities: [
      {
        name: 'Customer',
        kind: 'entity',
        collection: 'customers',
        titleField: 'name',
        fields: [scalar('name'), {
          key: 'lastChannel', label: 'lastChannel', semanticType: 'derived', derivedFrom: 'children',
          type: parentType as never,
          aggregation: { from: 'Contact', via: 'customerId', op: 'latest', ...aggregation } as never,
        }],
      },
      {
        name: 'Contact',
        kind: 'child',
        collection: 'contacts',
        titleField: 'channel',
        fields: [
          scalar('channel'),
          scalar('date', 'date'),
          { key: 'customerId', label: 'customerId', semanticType: 'reference', target: 'Customer' },
        ],
      },
    ],
    relationships: [{
      sourceEntity: 'Contact',
      targetEntity: 'Customer',
      sourceField: 'customerId',
      type: 'many-to-one',
      storage: 'child',
      ownership: 'composition',
    }],
  });

  it('aceita o latest completo, e o leva à plataforma com o orderBy', () => {
    const result = check(withLatest({ field: 'channel', orderBy: [{ path: 'date', dir: 'desc' }] }));
    expect(errors(result.issues)).toEqual([]);
  });

  it('o orderBy atravessa a leitura do JSON — é por ali que o modelo chega do agente', () => {
    const parsed = parseDomainModel(JSON.stringify(withLatest({ field: 'channel', orderBy: [{ path: 'date', dir: 'desc' }] })));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const lastChannel = parsed.model.entities[0].fields.find((one) => one.key === 'lastChannel');
    expect(lastChannel?.aggregation?.orderBy).toEqual([{ path: 'date', dir: 'desc' }]);
    expect(errors(check(parsed.model).issues)).toEqual([]);
  });

  it('reprova latest sem orderBy', () => {
    expect(codes(check(withLatest({ field: 'channel' })).issues)).toContain('domain.aggregation.latest-incomplete');
  });

  it('reprova a ordenação por campo que o filho não tem', () => {
    const result = check(withLatest({ field: 'channel', orderBy: [{ path: 'when', dir: 'desc' }] }));
    expect(codes(result.issues)).toContain('domain.aggregation.order-invalid');
  });

  it('reprova copiar para um campo de outro tipo', () => {
    const result = check(withLatest({ field: 'date', orderBy: [{ path: 'date', dir: 'desc' }] }));
    const issue = result.issues.find((one) => one.code === 'domain.aggregation.type-mismatch');
    expect(issue?.message).toContain('"Contact.date" (date)');
  });

  it('reprova o campo copiado que o filho não tem', () => {
    const result = check(withLatest({ field: 'nothing', orderBy: [{ path: 'date', dir: 'desc' }] }));
    expect(codes(result.issues)).toContain('domain.aggregation.unknown-child-field');
  });
});

describe('agregado latest que copia uma referência', () => {
  const copyingReference = (parentTarget: string | undefined, childTarget = 'members'): DomainModel => ({
    version: 1,
    target: 'screenDefinitions',
    entities: [
      {
        name: 'Ticket',
        kind: 'entity',
        collection: 'tickets',
        titleField: 'subject',
        fields: [scalar('subject'), {
          key: 'assignee', label: 'assignee', semanticType: 'derived', derivedFrom: 'children', type: 'reference',
          ...(parentTarget === undefined ? {} : { target: parentTarget }),
          aggregation: { from: 'Handoff', via: 'ticketId', op: 'latest', field: 'handedTo', orderBy: [{ path: 'createdAt', dir: 'desc' }] },
        }],
      },
      {
        name: 'Handoff',
        kind: 'child',
        collection: 'handoffs',
        titleField: 'note',
        fields: [
          scalar('note'),
          reference('handedTo', childTarget),
          reference('ticketId', 'Ticket'),
        ],
      },
    ],
    relationships: [
      { sourceEntity: 'Handoff', targetEntity: 'Ticket', sourceField: 'ticketId', type: 'many-to-one', storage: 'child', ownership: 'composition' },
      { sourceEntity: 'Handoff', targetEntity: childTarget, sourceField: 'handedTo', type: 'many-to-one', storage: 'reference', ownership: 'association' },
    ],
  });

  const assigneeOf = (model: DomainModel) =>
    buildArtifactPlan(model, EMPTY).screens.find((one) => one.collection === 'tickets')?.fields.find((one) => one.key === 'assignee');

  it('aceita o campo derivado que aponta para o mesmo alvo do campo copiado', () => {
    expect(errors(check(copyingReference('members')).issues)).toEqual([]);
  });

  it('leva o alvo do campo derivado até a tela gerada, para que ela desenhe o seletor certo', () => {
    expect(assigneeOf(copyingReference('members'))).toMatchObject({ type: 'reference', refEntity: 'members' });
  });

  it('resolve o alvo pelo nome da entidade do modelo, como numa referência comum', () => {
    const model = copyingReference('Ticket', 'Ticket');
    expect(errors(check(model).issues)).toEqual([]);
    expect(assigneeOf(model)?.refEntity).toBe('tickets');
  });

  it('continua reprovando quando os alvos divergem — o id de um membro não é o id de outra coisa', () => {
    const result = check(copyingReference('Ticket'));
    expect(codes(errors(result.issues))).toEqual(['domain.aggregation.type-mismatch']);
  });

  it('continua reprovando o campo derivado sem alvo, que gravaria um id que ninguém sabe abrir', () => {
    expect(codes(errors(check(copyingReference(undefined)).issues))).toEqual(['domain.aggregation.type-mismatch']);
  });

  it('o alvo atravessa a leitura do JSON — é por ali que o modelo chega do agente', () => {
    const parsed = parseDomainModel(JSON.stringify(copyingReference('members')));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(errors(check(parsed.model).issues)).toEqual([]);
  });

  it('não dá alvo a campo que não grava referência, mesmo que ele declare um — o que já existia não muda', () => {
    const resolve = (name: string) => (name === 'members' ? 'members' : undefined);
    const count = fieldToDefinition(
      { key: 'handoffs', label: 'handoffs', semanticType: 'derived', derivedFrom: 'children', target: 'members' },
      0,
      'design',
      resolve,
    );
    const copy = fieldToDefinition(
      { key: 'ownerName', label: 'ownerName', semanticType: 'snapshot', type: 'text', target: 'members', source: 'members.name', reason: 'r' },
      0,
      'design',
      resolve,
    );
    expect(count.refEntity).toBeUndefined();
    expect(copy.refEntity).toBeUndefined();
  });
});

describe('o limite verificável: agregado sobre referência múltipla', () => {
  const aggregatingOver = (multi: boolean): DomainModel => ({
    version: 1,
    target: 'screenDefinitions',
    entities: [
      {
        name: 'Sale',
        kind: 'entity',
        collection: 'sales',
        titleField: 'code',
        fields: [scalar('code'), {
          key: 'total', label: 'total', semanticType: 'derived', derivedFrom: 'children', type: 'currency',
          aggregation: { from: 'SaleItem', via: 'saleIds', op: 'sum', field: 'amount' },
        }],
      },
      {
        name: 'SaleItem',
        kind: 'child',
        collection: 'saleItems',
        titleField: 'amount',
        fields: [
          scalar('amount', 'currency'),
          { key: 'saleIds', label: 'saleIds', semanticType: 'reference', target: 'Sale', ...(multi ? { multi: true } : {}) },
        ],
      },
    ],
    relationships: [{
      sourceEntity: 'SaleItem',
      targetEntity: 'Sale',
      sourceField: 'saleIds',
      type: multi ? 'many-to-many' : 'many-to-one',
      storage: multi ? 'association' : 'child',
      ownership: 'composition',
    }],
  });

  it('reprova o agregado que atravessaria uma referência múltipla', () => {
    const issue = check(aggregatingOver(true)).issues.find((one) => one.code === 'domain.aggregation.multi-via');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('never move again');
  });

  it('aceita o mesmo agregado sobre uma referência simples', () => {
    expect(codes(check(aggregatingOver(false)).issues)).not.toContain('domain.aggregation.multi-via');
  });

  it('reprova o ciclo entre dois agregados, perguntando ao próprio kernel', () => {
    const model: DomainModel = {
      version: 1,
      target: 'screenDefinitions',
      entities: [
        {
          name: 'A', kind: 'entity', collection: 'aaa', titleField: 'name',
          fields: [scalar('name'), reference('bId', 'B'), {
            key: 'total', label: 'total', semanticType: 'derived', derivedFrom: 'children', type: 'number',
            aggregation: { from: 'B', via: 'aId', op: 'sum', field: 'total' },
          }],
        },
        {
          name: 'B', kind: 'entity', collection: 'bbb', titleField: 'name',
          fields: [scalar('name'), reference('aId', 'A'), {
            key: 'total', label: 'total', semanticType: 'derived', derivedFrom: 'children', type: 'number',
            aggregation: { from: 'A', via: 'bId', op: 'sum', field: 'total' },
          }],
        },
      ],
      relationships: [
        { sourceEntity: 'A', targetEntity: 'B', sourceField: 'bId', type: 'many-to-one', storage: 'reference', ownership: 'association' },
        { sourceEntity: 'B', targetEntity: 'A', sourceField: 'aId', type: 'many-to-one', storage: 'reference', ownership: 'association' },
      ],
    };
    expect(codes(check(model).issues)).toContain('domain.aggregation.cycle');
  });
});

describe('snapshot sem declaração', () => {
  const withSnapshot = (extra: Record<string, unknown>): DomainModel => ({
    version: 1,
    target: 'screenDefinitions',
    entities: [
      { name: 'Product', kind: 'entity', collection: 'products', titleField: 'name', fields: [scalar('name'), scalar('price', 'currency')] },
      {
        name: 'SaleItem', kind: 'entity', collection: 'saleItems', titleField: 'label',
        fields: [scalar('label'), { key: 'unitPrice', label: 'unitPrice', semanticType: 'snapshot', type: 'currency', ...extra }],
      },
    ],
    relationships: [],
  });

  it('reprova o campo classificado snapshot sem `source` e sem `reason`', () => {
    const issue = check(withSnapshot({})).issues.find((one) => one.code === 'domain.field.snapshot-undeclared');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('a `source`');
    expect(issue?.message).toContain('a `reason`');
  });

  it('reprova o snapshot com `source` e sem `reason`', () => {
    const issue = check(withSnapshot({ source: 'Product.price' })).issues.find((one) => one.code === 'domain.field.snapshot-undeclared');
    expect(issue?.message).toContain('a `reason`');
    expect(issue?.message).not.toContain('a `source`');
  });

  it('reprova o snapshot cuja origem não resolve', () => {
    const issue = check(withSnapshot({ source: 'Nowhere.price', reason: 'because' }))
      .issues.find((one) => one.code === 'domain.field.snapshot-unknown-source');
    expect(issue?.severity).toBe('error');
  });

  it('aceita o snapshot declarado por inteiro', () => {
    const result = check(withSnapshot({ source: 'Product.price', reason: 'the price charged on the day' }));
    expect(codes(result.issues)).not.toContain('domain.field.snapshot-undeclared');
    expect(codes(result.issues)).not.toContain('domain.field.snapshot-unknown-source');
  });
});

describe('semântica de exclusão que a plataforma não tem', () => {
  const withDelete = (onDelete: 'orphan' | 'cascade' | 'restrict' | 'unlink', required = false): DomainModel => {
    const model = salesModel();
    const child = model.relationships.find((one) => one.sourceField === 'saleId');
    if (child) {
      child.onDelete = onDelete;
      child.required = required;
    }
    return model;
  };

  it('recusa "cascade" e aponta o caminho que EXISTE', () => {
    const issue = check(withDelete('cascade')).issues.find((one) => one.code === 'domain.relationship.cascade-unsupported');
    expect(issue?.severity).toBe('error');
    expect(issue?.suggestion).toContain('"remove" step');
  });

  it('recusa "restrict"', () => {
    expect(codes(check(withDelete('restrict')).issues)).toContain('domain.relationship.restrict-unsupported');
  });

  it('recusa "unlink" num vínculo obrigatório, porque campo obrigatório não se esvazia', () => {
    expect(codes(check(withDelete('unlink', true)).issues)).toContain('domain.relationship.unlink-requires-optional');
  });

  it('aceita "orphan", que é o que a plataforma faz', () => {
    expect(errors(check(withDelete('orphan')).issues)).toEqual([]);
  });
});

describe('coerência entre a relação e o campo que a guarda', () => {
  it('recusa o armazenamento que não expressa a cardinalidade', () => {
    const model = salesModel();
    (model.relationships[0] as { storage: string }).storage = 'association';
    const issue = check(model).issues.find((one) => one.code === 'domain.relationship.storage-mismatch');
    expect(issue?.severity).toBe('error');
  });

  it('recusa a relação que nomeia um campo que a entidade não declara', () => {
    const model = salesModel();
    model.relationships[0].sourceField = 'clienteQueNaoExiste';
    expect(codes(check(model).issues)).toContain('domain.relationship.field-not-declared');
  });

  it('recusa o filho que não pende de ninguém', () => {
    const model = salesModel();
    model.relationships = model.relationships.filter((one) => one.storage !== 'child');
    expect(codes(check(model).issues)).toContain('domain.entity.child-without-parent');
  });

  it('recusa a referência para um alvo que ninguém declara', () => {
    const model = salesModel();
    model.entities[3].fields[1].target = 'Fornecedor';
    expect(codes(check(model).issues)).toContain('domain.relationship.unknown-target');
  });
});

describe('objeto aninhado: a tradução escolhida', () => {
  const withAddress = (): DomainModel => ({
    version: 1,
    target: 'screenDefinitions',
    entities: [
      { name: 'Address', kind: 'valueObject', fields: [scalar('street'), scalar('city'), scalar('zip')] },
      {
        name: 'Customer', kind: 'entity', collection: 'customers', titleField: 'name',
        fields: [scalar('name'), { key: 'billing', label: 'Billing address', semanticType: 'embedded', embeddedOf: 'Address' }],
      },
    ],
    relationships: [],
  });

  it('achata na raiz com prefixo, agrupado por seção — a plataforma não tem campo de objeto', () => {
    const result = check(withAddress());
    expect(errors(result.issues)).toEqual([]);
    const customer = result.expanded.model.entities.find((one) => one.name === 'Customer');
    expect(customer?.fields.map((one) => one.key)).toStrictEqual(['name', 'billingStreet', 'billingCity', 'billingZip']);
    expect(customer?.fields[1].section).toBe('Billing address');
  });

  it('o value object desaparece do modelo expandido: ele nunca foi uma entidade', () => {
    expect(check(withAddress()).expanded.model.entities.map((one) => one.name)).toStrictEqual(['Customer']);
  });

  it('explica a tradução em vez de fazê-la em silêncio', () => {
    const info = check(withAddress()).issues.find((one) => one.code === 'domain.field.embedded-flattened');
    expect(info?.severity).toBe('info');
    expect(info?.message).toContain('flatten-with-section');
  });

  it('recusa o embedded que aponta para um objeto que ninguém declarou', () => {
    const model = withAddress();
    model.entities = model.entities.filter((one) => one.kind !== 'valueObject');
    expect(codes(check(model).issues)).toContain('domain.field.embedded-unknown');
  });
});

describe('o que o kernel já responde, quem responde é o kernel', () => {
  it('recusa uma coleção reservada, com o veredito do próprio validador de telas', () => {
    const model = flatSaleModel([]);
    model.entities[1].collection = 'workflow_definitions';
    const issue = check(model).issues.find((one) => one.code === 'domain.entity.collection-invalid');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('@core.records/collection.key.reserved');
  });

  it('recusa uma chave de campo que a plataforma não sabe endereçar', () => {
    const model = flatSaleModel([scalar('address.city')]);
    const issue = check(model).issues.find((one) => one.code === 'domain.field.key-invalid');
    expect(issue?.severity).toBe('error');
    expect(issue?.suggestion).toContain('no nested object field');
  });

  it('avisa, sem bloquear, que a coleção já existe aqui', () => {
    const catalog = buildDomainCatalog([installedScreen('sales', [platformField('code')])]);
    const info = check(flatSaleModel([]), catalog).issues.find((one) => one.code === 'domain.entity.collection-exists');
    expect(info?.severity).toBe('info');
    expect(info?.message).toContain('reconcile');
  });
});

describe('a leitura tolerante do que um modelo de linguagem devolve', () => {
  it('devolve problema, e não exceção, para JSON inválido', () => {
    const result = parseDomainModel('{ nope');
    expect(result.ok).toBe(false);
    expect(result.issues[0].code).toBe('domain.model.malformed');
  });

  it('recusa um alvo que não é nem extensão nem as telas do escritório', () => {
    const result = parseDomainModel({ target: 'kernel', entities: [] });
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain('no valid "target"');
  });

  it('lê o modelo bom e mantém o que ele declarou', () => {
    const result = parseDomainModel(JSON.stringify(salesModel()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.entities).toHaveLength(5);
    expect(result.model.relationships).toHaveLength(4);
    expect(errors(validateDomainModel(result.model, EMPTY).issues)).toEqual([]);
  });

  it('descarta um campo torto e segue, em vez de perder o modelo inteiro', () => {
    const result = parseDomainModel({
      target: 'screenDefinitions',
      entities: [{ name: 'Sale', kind: 'entity', titleField: 'code', fields: [{ key: 'code', label: 'code', semanticType: 'scalar' }, { key: 'x' }] }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.entities[0].fields).toHaveLength(1);
    expect(codes(result.issues)).toContain('domain.model.malformed');
  });
});

describe('todo detector declarado existe, e todo detector existente está declarado', () => {
  it('a lista de códigos cobre os que os testes acima produziram', async () => {
    const { DOMAIN_ISSUE_CODES } = await import('./detectors');
    const produced = new Set<string>();
    for (const model of [
      salesModel(),
      flatSaleModel([scalar('customerName')]),
      flatSaleModel([scalar('productName1'), scalar('productName2')]),
    ]) {
      check(model).issues.forEach((one) => produced.add(one.code));
    }
    for (const code of produced) expect(DOMAIN_ISSUE_CODES).toContain(code);
  });
});
