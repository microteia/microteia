import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { readWorkspaceCatalog } from './workspaceCatalog';
import { validateDomainModel } from '../domain/validateDomainModel';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import { INSTALLED_CATALOG_FILE, INSTALLED_CATALOG_STALE_DAYS, INSTALLED_CATALOG_VERSION } from './installedCatalog';
import { RULE_LEDGER_FILE } from '../domain/traceability';

/**
 * A OUTRA metade da persistência da exceção.
 *
 * `applyPlanToCatalog` faz a declaração sobreviver DENTRO de uma conversa. Entre conversas não há
 * memória nenhuma: o agente abre o editor amanhã, lê o catálogo e remodela a coleção do zero. Como
 * `source` e `reason` não descem para o artefato — não há onde, em `FieldDefinition` —, a declaração
 * fica num arquivo do autor, ao lado do `plugin.ts`, e é lida de volta daqui.
 *
 * É o menor caminho que a plataforma já oferecia: um arquivo do workspace, que não é do pacote e não
 * muda a forma de nada instalado.
 */
const PLUGIN = `export default {
  manifest: {
    id: 'com.example.invoicing',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: 'Invoicing',
    description: 'Invoices and their lines.',
    contributes: [],
  },
  summary: 'Invoices and their lines.',
  workflows: [],
  screens: [
    {
      key: 'invoiceLines',
      titleSingular: 'Invoice line',
      titlePlural: 'Invoice lines',
      icon: 'receipt',
      titleFieldKey: 'label',
      fields: [
        { key: 'label', label: 'Label', type: 'text', required: true, order: 0 },
        { key: 'productName', label: 'Product name', type: 'text', required: false, order: 1 },
      ],
    },
    {
      key: 'products',
      titleSingular: 'Product',
      titlePlural: 'Products',
      icon: 'box',
      titleFieldKey: 'name',
      fields: [{ key: 'name', label: 'Name', type: 'text', required: true, order: 0 }],
    },
  ],
};
`;

const DOMAIN_MODEL = JSON.stringify({
  version: 1,
  target: 'extension',
  extensionId: 'com.example.invoicing',
  entities: [
    { name: 'Product', kind: 'entity', collection: 'products', titleField: 'name', fields: [{ key: 'name', label: 'Name', semanticType: 'scalar', type: 'text' }] },
    {
      name: 'InvoiceLine',
      kind: 'entity',
      collection: 'invoiceLines',
      titleField: 'label',
      fields: [
        { key: 'label', label: 'Label', semanticType: 'scalar', type: 'text' },
        {
          key: 'productName',
          label: 'Product name',
          semanticType: 'snapshot',
          type: 'text',
          source: 'Product.name',
          reason: 'the description as it was printed on the invoice; renaming the product must not rewrite issued invoices',
        },
      ],
    },
  ],
  relationships: [],
}, null, 2);

const workspace = mkdtempSync(join(tmpdir(), 'microteia-domain-'));
mkdirSync(join(workspace, 'invoicing'), { recursive: true });
writeFileSync(join(workspace, 'invoicing', 'plugin.ts'), PLUGIN);

afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe('o catálogo lido do diretório de autoria', () => {
  it('traz as telas que os pacotes deste diretório declaram', () => {
    const { catalog, sources, failures } = readWorkspaceCatalog(workspace);
    expect(failures).toEqual([]);
    expect(sources[0].pluginId).toBe('com.example.invoicing');
    expect(catalog.entities.map((one) => one.collection).sort())
      .toStrictEqual(['invoiceLines', 'members', 'products', 'tenant']);
    expect(catalog.entities.find((one) => one.collection === 'invoiceLines')?.source).toBe('workspace');
  });

  /** Sem o arquivo, o campo copiado é levantado — como seria numa sessão nova sem memória nenhuma. */
  it('sem `domain-model.json`, a duplicação volta a ser levantada', () => {
    const { catalog } = readWorkspaceCatalog(workspace);
    expect(catalog.exceptions).toEqual([]);
    const remodelled = JSON.parse(DOMAIN_MODEL) as Parameters<typeof validateDomainModel>[0];
    remodelled.entities[1].fields[1] = { key: 'productName', label: 'Product name', semanticType: 'scalar', type: 'text' };
    const codes = validateDomainModel(remodelled, catalog).issues.map((one) => one.code);
    expect(codes).toContain('domain.field.belongs-to-other-entity');
  });

  it('com o arquivo ao lado do plugin.ts, a declaração volta pelo catálogo', () => {
    writeFileSync(join(workspace, 'invoicing', 'domain-model.json'), DOMAIN_MODEL);
    const { catalog, models } = readWorkspaceCatalog(workspace);
    expect(models).toStrictEqual([{ path: join('invoicing', 'domain-model.json'), exceptions: 1 }]);
    expect(catalog.exceptions[0]).toMatchObject({
      collection: 'invoiceLines',
      field: 'productName',
      source: 'Product.name',
    });

    const remodelled = JSON.parse(DOMAIN_MODEL) as Parameters<typeof validateDomainModel>[0];
    remodelled.entities[1].fields[1] = { key: 'productName', label: 'Product name', semanticType: 'scalar', type: 'text' };
    const issues = validateDomainModel(remodelled, catalog).issues;
    expect(issues.filter((one) => one.severity !== 'info')).toEqual([]);
    expect(issues.find((one) => one.code === 'domain.field.exception-on-record')?.message)
      .toContain(join('invoicing', 'domain-model.json'));
  });

  /**
   * O LIVRO DE RASTREABILIDADE, lido pelo mesmo caminho e pelo mesmo motivo: sem o vínculo de ontem, a
   * regra alterada de hoje propõe uma segunda leva parecida com a primeira, e a decisão "isto
   * substitui aquilo" fica com quem lembrar.
   */
  it('sem o arquivo, não há leva anterior nenhuma — e isso é o caso normal', () => {
    const { ruleLedger, ledgers } = readWorkspaceCatalog(workspace);
    expect(ledgers).toEqual([]);
    expect(ruleLedger.rules).toEqual([]);
  });

  it('com o arquivo ao lado do plugin.ts, as levas anteriores voltam', () => {
    writeFileSync(join(workspace, 'invoicing', RULE_LEDGER_FILE), JSON.stringify({
      version: 1,
      rules: [{
        ruleId: 'invoice-lines',
        statement: 'An invoice carries its lines.',
        fingerprint: 'deadbeef',
        screens: ['invoiceLines'],
        lists: [],
        actions: [],
        transitions: [],
        permissions: [],
      }],
    }));
    const { ruleLedger, ledgers } = readWorkspaceCatalog(workspace);
    expect(ledgers).toStrictEqual([{ path: join('invoicing', RULE_LEDGER_FILE), rules: 1 }]);
    expect(ruleLedger.rules[0].screens).toEqual(['invoiceLines']);
  });

  it('livro ilegível é ignorado, e o catálogo continua de pé', () => {
    writeFileSync(join(workspace, 'invoicing', RULE_LEDGER_FILE), '{ not json');
    const { ruleLedger, failures, catalog } = readWorkspaceCatalog(workspace);
    expect(failures).toEqual([]);
    expect(ruleLedger.rules).toEqual([]);
    expect(catalog.entities.length).toBeGreaterThan(0);
  });

  /** Arquivo torto não derruba a validação: perder o veredito de ontem é ruim, não validar é pior. */
  it('um `domain-model.json` ilegível é ignorado, e o catálogo continua de pé', () => {
    writeFileSync(join(workspace, 'invoicing', 'domain-model.json'), '{ not json');
    const { catalog, models, failures } = readWorkspaceCatalog(workspace);
    expect(failures).toEqual([]);
    expect(models[0].exceptions).toBe(0);
    expect(catalog.entities.length).toBeGreaterThan(0);
  });
});

/**
 * O RETRATO DA INSTALAÇÃO somado ao catálogo, que é o que fecha a cegueira que este módulo tinha.
 *
 * Estas quatro provas são a razão de o arquivo existir, e as quatro nascem de defeito e não de
 * precaução:
 *
 * - sem retrato, tudo continua EXATAMENTE como antes (é a maioria dos diretórios);
 * - com retrato, uma entidade que só existe na instalação entra — e faz disparar um detector que
 *   antes não tinha como disparar, que era o buraco;
 * - uma entidade nas duas fontes resolve para a do WORKSPACE, e a divergência é informação;
 * - retrato velho continua valendo e é ANUNCIADO como velho.
 */

const TAKEN_AT = new Date('2026-08-01T12:00:00.000Z');

const SNAPSHOT = {
  version: INSTALLED_CATALOG_VERSION,
  projectId: 'office-prod',
  tenantId: 'tenant-1',
  tenantName: 'Escritório Central',
  exportedAt: TAKEN_AT.toISOString(),
  kernelVersion: KERNEL_VERSION,
  consoleVersion: '2.10.0',
  extensions: [{ id: 'com.example.billing', name: 'Billing', version: '2.1.0', active: true }],
  screens: [
    {
      key: 'customers',
      titleSingular: 'Customer',
      titlePlural: 'Customers',
      titleFieldKey: 'name',
      origin: 'design',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, order: 0, origin: 'design' },
        { key: 'email', label: 'E-mail', type: 'text', required: false, order: 1, origin: 'design' },
      ],
    },
    {
      key: 'products',
      titleSingular: 'Produto instalado',
      titlePlural: 'Produtos instalados',
      titleFieldKey: 'name',
      origin: 'plugin',
      ownerPluginId: 'com.example.billing',
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, order: 0, origin: 'plugin' },
        { key: 'barcode', label: 'Barcode', type: 'text', required: false, order: 1, origin: 'plugin' },
      ],
    },
  ],
  lookups: [{ collection: 'customerSegments', label: 'Segments' }],
  tagLists: [],
};

const SALE_MODEL = {
  version: 1,
  target: 'extension',
  extensionId: 'com.example.invoicing',
  entities: [
    {
      name: 'Sale',
      kind: 'entity',
      collection: 'sales',
      titleField: 'reference',
      fields: [
        { key: 'reference', label: 'Reference', semanticType: 'scalar', type: 'text' },
        { key: 'customerName', label: 'Customer name', semanticType: 'scalar', type: 'text' },
      ],
    },
  ],
  relationships: [],
} as unknown as Parameters<typeof validateDomainModel>[0];

const writeSnapshot = (overrides: Record<string, unknown> = {}): void => {
  writeFileSync(
    join(workspace, INSTALLED_CATALOG_FILE),
    JSON.stringify({ ...SNAPSHOT, ...overrides }, null, 2),
  );
};

describe('o retrato da instalação somado ao catálogo do diretório', () => {
  afterEach(() => {
    rmSync(join(workspace, INSTALLED_CATALOG_FILE), { force: true });
    rmSync(join(workspace, 'invoicing', 'domain-model.json'), { force: true });
  });

  /** O caminho de quem nunca exportou nada, que é a maioria. Nada pode mudar para ele. */
  it('sem o arquivo, o catálogo é exatamente o de antes', () => {
    const read = readWorkspaceCatalog(workspace, { now: TAKEN_AT });
    expect(read.installed).toBeNull();
    expect(read.installedProblems).toEqual([]);
    expect(read.catalog.entities.map((one) => one.collection).sort())
      .toStrictEqual(['invoiceLines', 'members', 'products', 'tenant']);
    expect(validateDomainModel(SALE_MODEL, read.catalog).issues
      .map((one) => one.code)).not.toContain('domain.field.belongs-to-other-entity');
  });

  it('com o arquivo, a entidade que só existe na instalação entra — e faz o detector disparar', () => {
    writeSnapshot();
    const read = readWorkspaceCatalog(workspace, { now: TAKEN_AT });

    expect(read.installed?.addedCollections).toStrictEqual(['customers']);
    const customers = read.catalog.entities.find((one) => one.collection === 'customers');
    expect(customers?.source).toBe('installation');
    expect(read.catalog.lookups.map((one) => one.collection)).toContain('customerSegments');

    // O buraco que este arquivo existe para fechar: `Sale.customerName` é defeito PORQUE Customer
    // existe, e Customer só existe na instalação.
    const issues = validateDomainModel(SALE_MODEL, read.catalog).issues;
    expect(issues.map((one) => one.code)).toContain('domain.field.belongs-to-other-entity');
    expect(issues.find((one) => one.code === 'domain.field.belongs-to-other-entity')?.message)
      .toContain('customers');
  });

  it('entidade nas duas fontes resolve para a do WORKSPACE, e a divergência é informação', () => {
    writeSnapshot();
    const read = readWorkspaceCatalog(workspace, { now: TAKEN_AT });

    expect(read.installed?.shadowedCollections).toStrictEqual(['products']);
    const products = read.catalog.entities.find((one) => one.collection === 'products');
    expect(products?.source).toBe('workspace');
    // A tela instalada foi descartada INTEIRA: o campo que só ela tinha não entrou pela porta dos fundos.
    expect(products?.fields.map((one) => one.key)).not.toContain('barcode');
    // E nada disso é erro.
    expect(validateDomainModel(SALE_MODEL, read.catalog).issues
      .filter((one) => one.severity === 'error')).toEqual([]);
  });

  it('retrato velho continua valendo, e o aviso diz há quantos dias ele foi tirado', () => {
    writeSnapshot();
    const later = new Date(TAKEN_AT.getTime() + (INSTALLED_CATALOG_STALE_DAYS + 5) * 86_400_000);
    const read = readWorkspaceCatalog(workspace, { now: later });

    expect(read.installed?.stale).toBe(true);
    expect(read.installed?.ageDays).toBe(INSTALLED_CATALOG_STALE_DAYS + 5);
    expect(read.installedProblems.join(' ')).toContain('export-catalog --tenant tenant-1');
    // Velho não é inválido: a entidade continua no catálogo.
    expect(read.catalog.entities.some((one) => one.collection === 'customers')).toBe(true);
  });

  it('retrato recusado não derruba nada — o catálogo do diretório segue inteiro', () => {
    writeFileSync(join(workspace, INSTALLED_CATALOG_FILE), '{ not json');
    const read = readWorkspaceCatalog(workspace, { now: TAKEN_AT });
    expect(read.installed).toBeNull();
    expect(read.installedProblems).toHaveLength(1);
    expect(read.catalog.entities.some((one) => one.collection === 'invoiceLines')).toBe(true);
  });
});
