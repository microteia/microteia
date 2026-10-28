import { describe, expect, it } from 'vitest';
import { applyPlanToCatalog, buildArtifactPlan } from './artifactPlan';
import type { ArtifactPlan } from './artifactPlan';
import { buildDomainCatalog } from './catalog';
import type { DomainKey } from './domainModel';
import type { ScreenSourcePackage } from './packageScreens';
import { packageScreenInputs } from './packageScreens';
import { validateDomainModel } from './validateDomainModel';
import type { DomainModel } from './domainModel';
import { flatSaleModel, installedScreen, platformField, salesModel, scalar } from './fixtures.test-support';

const EMPTY = buildDomainCatalog([]);

const operations = (plan: ArtifactPlan): Record<string, string> =>
  Object.fromEntries(plan.screens.map((one) => [one.collection, one.operation]));

const fieldOps = (plan: ArtifactPlan, collection: string): Record<string, string> =>
  Object.fromEntries(
    (plan.screens.find((one) => one.collection === collection)?.fields ?? []).map((one) => [one.key, one.operation]),
  );

describe('o plano de artefatos', () => {
  const plan = buildArtifactPlan(salesModel(), EMPTY);

  it('diz o que deve existir e onde, sem nomear arquivo nenhum', () => {
    expect(plan.ok).toBe(true);
    expect(plan.target).toBe('extension');
    expect(plan.extensionId).toBe('com.example.sales');
    expect(operations(plan)).toStrictEqual({
      customers: 'create',
      employees: 'create',
      products: 'create',
      sales: 'create',
      saleItems: 'create',
    });
    expect(JSON.stringify(plan)).not.toMatch(/plugin\.ts|\.json/);
  });

  it('resolve o relacionamento UMA vez — o plano já traz a coleção apontada e o vínculo com o pai', () => {
    const sales = plan.screens.find((one) => one.collection === 'sales');
    expect(sales?.fields.find((one) => one.key === 'customerId')?.refEntity).toBe('customers');
    const items = plan.screens.find((one) => one.collection === 'saleItems');
    expect(items?.kind).toBe('child');
    expect(items?.parent).toStrictEqual({ collection: 'sales', fieldKey: 'saleId', relation: 'owned' });
  });

  it('publica a leitura de negócio das relações', () => {
    expect(plan.relationships).toStrictEqual([
      'Customer 1:N Sale',
      'Employee 1:N Sale',
      'Sale 1:N SaleItem',
      'Product 1:N SaleItem',
    ]);
  });

  it('propaga o obrigatório da relação para o campo que a guarda', () => {
    expect(plan.screens.find((one) => one.collection === 'sales')?.fields.find((one) => one.key === 'customerId')?.required).toBe(true);
  });

  it('leva o agregado e a expressão como declarações distintas', () => {
    const total = plan.screens.find((one) => one.collection === 'sales')?.fields.find((one) => one.key === 'total');
    expect(total?.aggregation).toStrictEqual({ from: 'saleItems', via: 'saleId', op: 'sum', field: 'lineTotal' });
    expect(total?.computeExpression).toBeUndefined();

    const line = plan.screens.find((one) => one.collection === 'saleItems')?.fields.find((one) => one.key === 'lineTotal');
    expect(line?.computeExpression).toBe('quantity * unitPrice - discount');
    expect(line?.aggregation).toBeUndefined();
  });

  it('avisa que mexer na extensão move a versão dela e o histórico junto', () => {
    expect(plan.versionBump?.extensionId).toBe('com.example.sales');
    expect(plan.versionBump?.because).toContain('create screen "sales"');
    const info = plan.issues.find((one) => one.code === 'domain.plan.version-bump-required');
    expect(info?.message).toContain('VERSIONS.md');
    expect(info?.suggestion).toContain('Semver');
  });
});

/**
 * O PORTÃO. Modelagem vem antes de geração, e um modelo com erro não vira plano — um plano montado
 * sobre um modelo quebrado geraria o defeito com fidelidade.
 */
describe('o portão do plano', () => {
  it('recusa o plano quando o modelo tem erro, e devolve o motivo', () => {
    const plan = buildArtifactPlan(flatSaleModel([scalar('customerName'), scalar('customerEmail')]), EMPTY);
    expect(plan.ok).toBe(false);
    expect(plan.screens).toEqual([]);
    expect(plan.issues[0].code).toBe('domain.plan.blocked-by-model');
    expect(plan.issues.map((one) => one.code)).toContain('domain.field.prefix-group');
  });

  it('deixa passar o que é aviso', () => {
    const plan = buildArtifactPlan(flatSaleModel([scalar('shippingStreet'), scalar('shippingCity'), scalar('shippingZip')]), EMPTY);
    expect(plan.ok).toBe(true);
    expect(plan.issues.map((one) => one.code)).toContain('domain.field.prefix-group-unnamed');
  });
});

/**
 * A RECONCILIAÇÃO. O plano é um diff, e a prova disso é rodá-lo duas vezes: a segunda passada não
 * propõe recriar nada. Sem esta prova, "é um diff" seria uma promessa que só um escritório de
 * verdade cobraria — depois de a extensão já ter reescrito o que ele tinha.
 */
describe('reconciliação — o plano é um diff, não uma criação', () => {
  const first = buildArtifactPlan(salesModel(), EMPTY);
  const after = applyPlanToCatalog(EMPTY, first);
  const second = buildArtifactPlan(salesModel(), after);

  it('a segunda passada não propõe criar nem alterar nada', () => {
    expect(operations(second)).toStrictEqual({
      customers: 'unchanged',
      employees: 'unchanged',
      products: 'unchanged',
      sales: 'unchanged',
      saleItems: 'unchanged',
    });
    expect(Object.values(fieldOps(second, 'saleItems'))).toEqual(
      Object.keys(fieldOps(second, 'saleItems')).map(() => 'unchanged'),
    );
  });

  it('e não pede versão nova, porque não há alteração para versionar', () => {
    expect(second.versionBump).toBeNull();
    expect(second.migrationsRequired).toEqual([]);
    expect(second.ok).toBe(true);
  });

  it('a terceira passada é igual à segunda — a operação é idempotente de verdade', () => {
    const third = buildArtifactPlan(salesModel(), applyPlanToCatalog(after, second));
    expect(operations(third)).toStrictEqual(operations(second));
  });

  it('um campo novo no modelo é a única coisa que a segunda passada propõe', () => {
    const grown = salesModel();
    grown.entities[0].fields.push(scalar('taxId'));
    const plan = buildArtifactPlan(grown, after);
    expect(operations(plan).customers).toBe('update');
    expect(fieldOps(plan, 'customers')).toStrictEqual({
      name: 'unchanged',
      email: 'unchanged',
      phone: 'unchanged',
      taxId: 'create',
    });
    expect(plan.versionBump?.because).toStrictEqual(['update screen "customers"']);
  });
});

/**
 * O CAMINHO DO DISCO. A reconciliação acima passa pelo `applyPlanToCatalog`, que já carregava as
 * chaves; a sessão seguinte, porém, lê o catálogo dos `plugin.ts` do workspace, por
 * `packageScreenInputs`. Era ali que as chaves se perdiam, e o plano propunha criar de novo, a cada
 * execução, toda chave que o pacote já declarava.
 */
describe('chaves declaradas no workspace — o plano as reconcilia', () => {
  const documentKey: DomainKey = { name: 'document', kind: 'unique', fields: ['phone'], normalize: { formatPreset: 'digits' } };

  const keyedModel = (keys: DomainKey[]): DomainModel => {
    const model = salesModel();
    const customer = model.entities[0];
    customer.keys = keys;
    customer.fields = customer.fields.map((field) => (field.key === 'email' ? { ...field, unique: true } : field));
    return model;
  };

  const asWorkspacePackage = (plan: ArtifactPlan): ScreenSourcePackage => ({
    manifest: { id: plan.extensionId as string },
    screens: plan.screenInputs.map((input) => ({
      key: input.key,
      titleSingular: input.titleSingular,
      titlePlural: input.titlePlural ?? input.titleSingular,
      icon: 'list',
      titleFieldKey: input.titleFieldKey,
      fields: input.fields,
      ...(input.keys ? { keys: input.keys } : {}),
      ...(input.parentEntity ? { parentEntity: input.parentEntity } : {}),
      ...(input.parentFieldKey ? { parentFieldKey: input.parentFieldKey } : {}),
      ...(input.parentRelation ? { parentRelation: input.parentRelation } : {}),
    })),
  });

  const workspaceCatalog = (pkg: ScreenSourcePackage) => buildDomainCatalog(packageScreenInputs(pkg));

  const customerKeys = (plan: ArtifactPlan) => plan.screens.find((one) => one.collection === 'customers');

  const first = buildArtifactPlan(keyedModel([documentKey]), EMPTY);
  const installedPackage = asWorkspacePackage(first);

  it('a primeira passada cria as chaves — a declarada e a do `unique` do campo', () => {
    expect(customerKeys(first)?.keys.map((one) => [one.name, one.operation])).toStrictEqual([
      ['document', 'create'],
      ['field:email', 'create'],
    ]);
  });

  it('a passada seguinte, lida do plugin.ts, não propõe criar o que o pacote já declara', () => {
    const second = buildArtifactPlan(keyedModel([documentKey]), workspaceCatalog(installedPackage));
    const customers = customerKeys(second);
    expect(customers?.keys.map((one) => [one.name, one.operation])).toStrictEqual([
      ['document', 'unchanged'],
      ['field:email', 'unchanged'],
    ]);
    expect(customers?.operation).toBe('unchanged');
    expect(customers?.retainedKeys).toStrictEqual([]);
    expect(second.versionBump).toBeNull();
  });

  it('o catálogo do workspace mostra a chave com o dono carimbado, como a instalação a grava', () => {
    const entity = workspaceCatalog(installedPackage).entities.find((one) => one.collection === 'customers');
    expect(entity?.keys?.find((one) => one.name === 'document')).toStrictEqual({ ...documentKey, ownerPluginId: 'com.example.sales' });
  });

  it('a mesma chave redefinida é alteração, não "unchanged" — a instalação varre de novo o que está gravado', () => {
    const redefined = buildArtifactPlan(keyedModel([{ ...documentKey, fields: ['phone', 'email'] }]), workspaceCatalog(installedPackage));
    const key = customerKeys(redefined)?.keys.find((one) => one.name === 'document');
    expect(key?.operation).toBe('update');
    expect(key?.adoption).toBe('sweep-existing-records');
    expect(key?.reason).toContain('swept again');
    expect(customerKeys(redefined)?.operation).toBe('update');
  });

  it('mudar só a normalização também é alteração: muda qual reserva cada registro recebe', () => {
    const plan = buildArtifactPlan(keyedModel([{ ...documentKey, normalize: { caseInsensitive: true } }]), workspaceCatalog(installedPackage));
    expect(customerKeys(plan)?.keys.find((one) => one.name === 'document')?.operation).toBe('update');
  });

  it('mudar só a mensagem do conflito não é: a reserva é a mesma', () => {
    const plan = buildArtifactPlan(keyedModel([{ ...documentKey, message: '@com.example.sales/key.document' }]), workspaceCatalog(installedPackage));
    expect(customerKeys(plan)?.keys.find((one) => one.name === 'document')?.operation).toBe('unchanged');
  });

  it('a chave que o pacote declara e o modelo não descreve fica — o plano nunca a remove', () => {
    const plan = buildArtifactPlan(keyedModel([]), workspaceCatalog(installedPackage));
    expect(customerKeys(plan)?.retainedKeys).toStrictEqual(['document']);
    expect(customerKeys(plan)?.keys.map((one) => one.name)).toStrictEqual(['field:email']);
  });
});

describe('o que a reconciliação NÃO pode fazer, e diz que não pode', () => {
  const installed = (fields: Parameters<typeof installedScreen>[1]) =>
    buildDomainCatalog([installedScreen('contracts', fields, { titleFieldKey: 'number', ownerPluginId: 'com.example.contracts' })]);

  const model = (type: 'text' | 'number', multi = false): DomainModel => ({
    version: 1,
    target: 'screenDefinitions',
    entities: [{
      name: 'Contract',
      kind: 'entity',
      collection: 'contracts',
      titleField: 'number',
      fields: [{ key: 'number', label: 'number', semanticType: 'scalar', type, ...(multi ? { multi: true } : {}) }],
    }],
    relationships: [],
  });

  it('não retipa um campo que já existe — tipo é imutável depois de criado', () => {
    const plan = buildArtifactPlan(model('number'), installed([platformField('number', 'text')]));
    expect(plan.ok).toBe(false);
    const issue = plan.issues.find((one) => one.code === 'domain.plan.field-type-immutable');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('immutable');
    expect(plan.screens[0].fields[0].operation).toBe('blocked');
  });

  it('exige migração declarada quando o formato do dado gravado muda', () => {
    const plan = buildArtifactPlan(model('text', true), installed([platformField('number', 'text')]));
    expect(plan.ok).toBe(false);
    expect(plan.migrationsRequired).toStrictEqual([{
      collection: 'contracts',
      field: 'number',
      change: 'a single value becomes a list: every stored value has to be wrapped in an array',
    }]);
    expect(plan.issues.find((one) => one.code === 'domain.plan.migration-required')?.suggestion).toContain('input.collections');
  });

  it('nunca remove: o que existe e o modelo não descreve fica, com aviso', () => {
    const plan = buildArtifactPlan(model('text'), installed([platformField('number', 'text'), platformField('legacyNote', 'textarea')]));
    expect(plan.screens[0].retainedFields).toStrictEqual(['legacyNote']);
    const warning = plan.issues.find((one) => one.code === 'domain.plan.removal-soft-block');
    expect(warning?.severity).toBe('warning');
    expect(warning?.suggestion).toContain('cannot see the records');
    expect(plan.ok).toBe(true);
  });

  it('avisa quando a coleção é de outra extensão: dali só se acrescenta campo', () => {
    const owned = model('text');
    owned.target = 'extension';
    owned.extensionId = 'com.example.other';
    const plan = buildArtifactPlan(owned, installed([platformField('number', 'text')]));
    const warning = plan.issues.find((one) => one.code === 'domain.plan.collection-owned-elsewhere');
    expect(warning?.severity).toBe('warning');
    expect(warning?.suggestion).toContain('screenPatch');
  });
});

describe('listas de opções no plano', () => {
  it('propõe a lista que um campo select aponta, e diz quem a consome', () => {
    const model: DomainModel = {
      version: 1,
      target: 'screenDefinitions',
      entities: [{
        name: 'Sale',
        kind: 'entity',
        collection: 'sales',
        titleField: 'code',
        fields: [scalar('code'), { key: 'stage', label: 'stage', semanticType: 'scalar', type: 'select', lookup: 'saleStages' }],
      }],
      relationships: [],
    };
    const plan = buildArtifactPlan(model, EMPTY);
    expect(plan.lookups).toStrictEqual([{ operation: 'create', collection: 'saleStages', label: 'saleStages', usedBy: ['Sale.stage'] }]);
  });

  it('não propõe de novo a lista que o escritório já tem', () => {
    const catalog = buildDomainCatalog([], [{ collection: 'saleStages', label: 'Stages' }]);
    const model: DomainModel = {
      version: 1,
      target: 'screenDefinitions',
      entities: [{
        name: 'Sale', kind: 'entity', collection: 'sales', titleField: 'code',
        fields: [scalar('code'), { key: 'stage', label: 'stage', semanticType: 'scalar', type: 'select', lookup: 'saleStages' }],
      }],
      relationships: [],
    };
    expect(buildArtifactPlan(model, catalog).lookups[0].operation).toBe('unchanged');
  });
});

/**
 * A EXCEÇÃO TEM DE SOBREVIVER AO CICLO.
 *
 * `howToDeclareException` só vale se a declaração persistir. `source` e `reason` de um snapshot não
 * têm onde morar num `FieldDefinition` — o artefato guarda um campo `text` comum —, então quem
 * remodelasse a coleção a partir do catálogo na sessão seguinte reabriria a mesma discussão. A pessoa
 * reaprovaria para sempre, que é o custo exato de uma exceção que não persiste.
 */
describe('a duplicação declarada não é perguntada duas vezes', () => {
  const snapshotModel = (semanticType: 'snapshot' | 'scalar'): DomainModel => ({
    version: 1,
    target: 'screenDefinitions',
    entities: [
      { name: 'Product', kind: 'entity', collection: 'products', titleField: 'name', fields: [scalar('name')] },
      {
        name: 'SaleItem',
        kind: 'entity',
        collection: 'saleItems',
        titleField: 'label',
        fields: [
          scalar('label'),
          semanticType === 'snapshot'
            ? {
              key: 'productName',
              label: 'p',
              semanticType: 'snapshot',
              type: 'text',
              source: 'Product.name',
              reason: 'the description as it was printed on the invoice',
            }
            : scalar('productName'),
        ],
      },
    ],
    relationships: [],
  });

  const declared = buildArtifactPlan(snapshotModel('snapshot'), EMPTY);
  const after = applyPlanToCatalog(EMPTY, declared);

  it('o plano carrega a declaração, porque o artefato não tem onde carregá-la', () => {
    expect(declared.declaredExceptions).toStrictEqual([{
      collection: 'saleItems',
      field: 'productName',
      semanticType: 'snapshot',
      source: 'Product.name',
      reason: 'the description as it was printed on the invoice',
      declaredIn: 'screenDefinitions',
    }]);
    // E o CAMPO gravado é um texto comum — é isso que torna a declaração necessária.
    const field = declared.screens.find((one) => one.collection === 'saleItems')?.fields.find((one) => one.key === 'productName');
    expect(field?.type).toBe('text');
    expect(JSON.stringify(field)).not.toContain('Product.name');
  });

  it('e o catálogo depois do plano a conhece', () => {
    expect(after.exceptions.map((one) => `${one.collection}.${one.field}`)).toStrictEqual(['saleItems.productName']);
  });

  /** O caso que o defeito produzia: a sessão seguinte remodela do catálogo, e o campo volta escalar. */
  it('a sessão seguinte, remodelando do catálogo, NÃO reabre a discussão', () => {
    const again = validateDomainModel(snapshotModel('scalar'), after);
    expect(again.issues.filter((one) => one.severity !== 'info')).toEqual([]);
    const info = again.issues.find((one) => one.code === 'domain.field.exception-on-record');
    expect(info?.message).toContain('Product.name');
    expect(info?.message).toContain('printed on the invoice');
  });

  it('sem a declaração, o mesmo campo é levantado — a exceção é o que cala, não o esquecimento', () => {
    const virgin = validateDomainModel(snapshotModel('scalar'), EMPTY);
    expect(virgin.issues.map((one) => one.code)).toContain('domain.field.belongs-to-other-entity');
  });

  it('aplicar o mesmo plano duas vezes não duplica a declaração', () => {
    const twice = applyPlanToCatalog(after, buildArtifactPlan(snapshotModel('snapshot'), after));
    expect(twice.exceptions).toHaveLength(1);
  });
});
