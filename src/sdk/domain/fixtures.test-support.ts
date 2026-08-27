import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import type { CatalogScreenInput } from './catalog';
import type { BehaviorModel } from './behaviorModel';
import type { DomainEntity, DomainField, DomainModel } from './domainModel';

/**
 * As fixtures dos testes desta camada.
 *
 * Elas nomeiam negócio — Customer, Product, Sale — e é o ÚNICO lugar deste repositório onde isso é
 * permitido, pela mesma razão por que um teste de regra de Firestore semeia documentos: o defeito
 * que se persegue aqui é de MODELAGEM, e uma modelagem só se demonstra sobre um domínio concreto.
 * Nada disto entra no kernel, no catálogo de entidades ou num artefato — é entrada de teste, e o
 * arquivo leva `test-support` no nome para que continue óbvio.
 */

export const scalar = (key: string, type: FieldDefinition['type'] = 'text'): DomainField =>
  ({ key, label: key, semanticType: 'scalar', type });

export const reference = (key: string, target: string, multi = false): DomainField =>
  ({ key, label: key, semanticType: 'reference', target, ...(multi ? { multi: true } : {}) });

export const platformField = (key: string, type: FieldDefinition['type'] = 'text', extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  key,
  label: key,
  type,
  required: false,
  order: 0,
  origin: 'plugin',
  ...extra,
});

/** Uma tela já instalada, para o catálogo dos testes de reconciliação e de acoplamento. */
export const installedScreen = (
  key: string,
  fields: FieldDefinition[],
  extra: Partial<CatalogScreenInput> = {},
): CatalogScreenInput => ({
  key,
  titleSingular: key,
  titleFieldKey: fields[0]?.key ?? '',
  fields,
  ...extra,
});

/**
 * O CENÁRIO OBRIGATÓRIO, modelado corretamente: cinco entidades, quatro relacionamentos, um total
 * agregado sobre os itens e um preço unitário congelado com a razão declarada.
 */
export const salesModel = (): DomainModel => ({
  version: 1,
  intent: 'a sales system with customers, salespeople, products and sales; a sale has several products '
    + 'and each line has quantity, price and discount',
  target: 'extension',
  extensionId: 'com.example.sales',
  entities: [
    {
      name: 'Customer',
      kind: 'entity',
      collection: 'customers',
      titleField: 'name',
      fields: [scalar('name'), scalar('email'), scalar('phone')],
    },
    {
      name: 'Employee',
      kind: 'entity',
      collection: 'employees',
      titleField: 'name',
      fields: [scalar('name'), scalar('email')],
    },
    {
      name: 'Product',
      kind: 'entity',
      collection: 'products',
      titleField: 'name',
      fields: [scalar('name'), scalar('price', 'currency'), scalar('sku')],
    },
    {
      name: 'Sale',
      kind: 'entity',
      collection: 'sales',
      titleField: 'code',
      fields: [
        scalar('code'),
        reference('customerId', 'Customer'),
        reference('employeeId', 'Employee'),
        scalar('soldAt', 'date'),
        {
          key: 'total',
          label: 'total',
          semanticType: 'derived',
          derivedFrom: 'children',
          type: 'currency',
          aggregation: { from: 'SaleItem', via: 'saleId', op: 'sum', field: 'lineTotal' },
        },
      ],
    },
    {
      name: 'SaleItem',
      kind: 'child',
      collection: 'saleItems',
      titleField: 'description',
      fields: [
        scalar('description'),
        reference('saleId', 'Sale'),
        reference('productId', 'Product'),
        scalar('quantity', 'number'),
        {
          key: 'unitPrice',
          label: 'unitPrice',
          semanticType: 'snapshot',
          type: 'currency',
          source: 'Product.price',
          reason: 'the price charged on the day of the sale; a later change to the catalogue must not rewrite past sales',
        },
        scalar('discount', 'currency'),
        {
          key: 'lineTotal',
          label: 'lineTotal',
          semanticType: 'derived',
          derivedFrom: 'self',
          type: 'currency',
          expression: 'quantity * unitPrice - discount',
        },
      ],
    },
  ],
  relationships: [
    {
      sourceEntity: 'Sale',
      targetEntity: 'Customer',
      sourceField: 'customerId',
      type: 'many-to-one',
      storage: 'reference',
      ownership: 'association',
      required: true,
      displayFields: ['name'],
    },
    {
      sourceEntity: 'Sale',
      targetEntity: 'Employee',
      sourceField: 'employeeId',
      type: 'many-to-one',
      storage: 'reference',
      ownership: 'association',
      required: true,
    },
    {
      sourceEntity: 'SaleItem',
      targetEntity: 'Sale',
      sourceField: 'saleId',
      type: 'many-to-one',
      storage: 'child',
      ownership: 'composition',
      required: true,
    },
    {
      sourceEntity: 'SaleItem',
      targetEntity: 'Product',
      sourceField: 'productId',
      type: 'many-to-one',
      storage: 'reference',
      ownership: 'association',
      required: true,
    },
  ],
});

/** O modelo ERRADO — a leitura pela tela: uma venda só, com o cliente dentro dela. */
export const flatSaleModel = (fields: DomainField[]): DomainModel => ({
  version: 1,
  target: 'screenDefinitions',
  entities: [
    { name: 'Customer', kind: 'entity', collection: 'customers', titleField: 'name', fields: [scalar('name'), scalar('email')] },
    { name: 'Sale', kind: 'entity', collection: 'sales', titleField: 'code', fields: [scalar('code'), ...fields] },
  ],
  relationships: [],
});

/**
 * O CENÁRIO OBRIGATÓRIO DO COMPORTAMENTO, sobre o de estrutura: "uma venda nasce em rascunho; ao
 * confirmar, reserva estoque e não pode mais mudar de itens; ao faturar, gera o financeiro; só o
 * gerente cancela venda faturada."
 *
 * Quatro transições, um guard com permissão, e nenhum passo de script — que é o que a frase de
 * negócio pede e o que a plataforma consegue declarar. As duas entidades novas existem porque
 * "reserva estoque" e "gera o financeiro" GRAVAM em algum lugar, e um efeito que não diz onde é um
 * efeito que ninguém pode escrever.
 */
export const salesBehaviorModel = (): DomainModel => {
  const base = salesModel();
  const sale = base.entities.find((one) => one.name === 'Sale') as DomainEntity;
  const item = base.entities.find((one) => one.name === 'SaleItem') as DomainEntity;

  return {
    ...base,
    intent: 'a sale is born as a draft; confirming it reserves stock and freezes its items; invoicing it creates the '
      + 'financial entry; only the manager cancels an invoiced sale',
    entities: [
      ...base.entities.filter((one) => one.name !== 'Sale' && one.name !== 'SaleItem'),
      {
        ...sale,
        fields: [
          ...sale.fields,
          { key: 'status', label: 'status', semanticType: 'scalar', type: 'select', lookup: 'saleStatuses' },
        ],
      },
      item,
      {
        name: 'StockReservation',
        kind: 'entity',
        collection: 'stockReservations',
        titleField: 'code',
        fields: [scalar('code'), reference('saleId', 'Sale'), reference('productId', 'Product'), scalar('quantity', 'number')],
      },
      {
        name: 'FinancialEntry',
        kind: 'entity',
        collection: 'financialEntries',
        titleField: 'code',
        fields: [scalar('code'), reference('saleId', 'Sale'), scalar('amount', 'currency'), scalar('dueOn', 'date')],
      },
    ],
    relationships: [
      ...base.relationships.map((one) => (one.sourceEntity === 'SaleItem' && one.targetEntity === 'Sale'
        ? {
          ...one,
          denormalize: {
            denormKey: 'sale',
            fields: ['status'],
            reason: 'the item rule reads the state of its own sale, and a condition never queries',
          },
        }
        : one)),
      {
        sourceEntity: 'StockReservation',
        targetEntity: 'Sale',
        sourceField: 'saleId',
        type: 'many-to-one',
        storage: 'reference',
        ownership: 'association',
        required: true,
      },
      {
        sourceEntity: 'StockReservation',
        targetEntity: 'Product',
        sourceField: 'productId',
        type: 'many-to-one',
        storage: 'reference',
        ownership: 'association',
        required: true,
      },
      {
        sourceEntity: 'FinancialEntry',
        targetEntity: 'Sale',
        sourceField: 'saleId',
        type: 'many-to-one',
        storage: 'reference',
        ownership: 'association',
        required: true,
      },
    ],
    behavior: {
      states: [
        {
          entity: 'Sale',
          field: 'status',
          lookup: 'saleStatuses',
          initial: 'draft',
          terminal: ['cancelled'],
          options: [
            { key: 'draft', label: 'Draft' },
            { key: 'confirmed', label: 'Confirmed' },
            { key: 'invoiced', label: 'Invoiced' },
            { key: 'cancelled', label: 'Cancelled' },
          ],
        },
      ],
      transitions: [
        {
          name: 'confirm',
          entity: 'Sale',
          from: 'draft',
          to: 'confirmed',
          trigger: { kind: 'user-action', action: 'confirm-sale' },
          effects: [{ kind: 'create-record', entity: 'StockReservation', field: 'quantity' }],
        },
        {
          name: 'invoice',
          entity: 'Sale',
          from: 'confirmed',
          to: 'invoiced',
          trigger: { kind: 'user-action', action: 'invoice-sale' },
          effects: [{ kind: 'create-record', entity: 'FinancialEntry', field: 'amount', value: 'total' }],
        },
        {
          name: 'cancel-draft',
          entity: 'Sale',
          from: 'draft',
          to: 'cancelled',
          trigger: { kind: 'user-action', action: 'cancel-sale' },
          effects: [],
        },
        {
          name: 'cancel-invoiced',
          entity: 'Sale',
          from: 'invoiced',
          to: 'cancelled',
          trigger: { kind: 'user-action', action: 'cancel-invoiced-sale' },
          guard: { expression: 'hasPermission("sales.cancel")' },
          actor: 'the manager',
          permission: 'sales.cancel',
          effects: [{ kind: 'notify' }],
        },
      ],
      invariants: [
        {
          scope: 'field',
          entity: 'SaleItem',
          field: 'quantity',
          expression: 'quantity > 0',
          message: 'A line must sell at least one.',
        },
        {
          scope: 'record',
          entity: 'SaleItem',
          expression: 'sale.status == "draft"',
          message: 'Items can only change while the sale is a draft.',
        },
      ],
    },
  };
};

/** O comportamento do cenário obrigatório, para um teste que só quer mexer numa peça dele. */
export const salesBehavior = (): BehaviorModel => salesBehaviorModel().behavior as BehaviorModel;
