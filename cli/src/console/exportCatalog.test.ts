import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCatalogWriter } from './exportCatalog.js';
import type { CatalogSourceDocument } from './exportCatalog.js';
import { CLI_VERSION } from '../shared/paths.js';
import {
  INSTALLED_CATALOG_FILE as CATALOG_FILE,
  INSTALLED_CATALOG_VERSION as CATALOG_FORMAT_VERSION,
  buildInstalledCatalog,
} from '../../../src/domain/usecases/plugins/installedCatalogSnapshot';
import type { InstalledExtensionRecord } from './installedExtensions.js';
import { decodeFields, documentId } from './firestoreRest.js';
import type { FirestoreDocument } from './firestoreRest.js';
import { installedScreenInput, readInstalledCatalog } from '../../../src/sdk/node/installedCatalog';
import { declaredDocumentTemplates } from '../../../src/domain/usecases/plugins/documentStepIntegrity';
import { documentExamplePlugin } from '../../../src/plugins/marketplace/examples/document-example/plugin';
import { declaredFieldPresets } from '../../../src/domain/usecases/plugins/fieldPresetRefs';
import { brasilPlugin } from '../../../src/plugins/marketplace/brasil';
import { buildDomainCatalog } from '../../../src/sdk/domain/catalog';

/**
 * O RETRATO, montado a partir do que o Firestore devolve — e lido de volta pelo SDK.
 *
 * O Console não traz mais escritor próprio: ele carrega `buildInstalledCatalog` do SDK instalado em
 * `extensions/` (`loadCatalogWriter`). Este teste exercita o percurso REAL do arquivo pelo Console — a
 * resposta crua da REST, a decodificação, a cópia instalada como `readInstalledExtensions` a entrega, o
 * escritor e o leitor DO KERNEL —, com o escritor importado da fonte, que é o que o SDK compila.
 *
 * A fixture é a resposta CRUA da REST do Firestore, com os `stringValue`/`arrayValue` que ela usa: se a
 * decodificação mudar, o retrato muda com ela, e é isso que se quer exercitar.
 */

const document = (id: string, fields: Record<string, unknown>): FirestoreDocument => ({
  name: `projects/office-prod/databases/(default)/documents/tenants/tenant-1/screenDefinitions/${id}`,
  fields,
});

const str = (value: string): Record<string, unknown> => ({ stringValue: value });
const bool = (value: boolean): Record<string, unknown> => ({ booleanValue: value });
const int = (value: number): Record<string, unknown> => ({ integerValue: String(value) });
const map = (fields: Record<string, unknown>): Record<string, unknown> => ({ mapValue: { fields } });
const arr = (values: Record<string, unknown>[]): Record<string, unknown> => ({ arrayValue: { values } });

const SCREENS: FirestoreDocument[] = [
  document('customers', {
    titleSingular: str('Customer'),
    titlePlural: str('Customers'),
    titleFieldKey: str('name'),
    origin: str('design'),
    enabled: bool(true),
    fields: arr([
      map({ key: str('name'), label: str('Nome'), type: str('text'), required: bool(true), order: int(0) }),
      map({
        key: str('segmentId'),
        label: str('Segmento'),
        type: str('lookup'),
        required: bool(false),
        order: int(1),
        lookupCollection: str('customerSegments'),
        // Conteúdo, não esquema: as opções que o escritório digitou não podem sair daqui.
        options: arr([map({ key: str('gold'), label: str('Ouro') })]),
        placeholder: str('Escolha um segmento'),
      }),
    ]),
  }),
  document('invoices', {
    titleSingular: str('Invoice'),
    titleFieldKey: str('number'),
    dataCollection: str('billingInvoices'),
    ownerPluginId: str('com.example.billing'),
    parentEntity: str('customers'),
    parentFieldKey: str('customerId'),
    parentRelation: str('owned'),
    enabled: bool(true),
    fields: arr([
      map({ key: str('number'), label: str('Número'), type: str('text'), required: bool(true), order: int(0) }),
      map({
        key: str('total'),
        label: str('Total'),
        type: str('number'),
        required: bool(false),
        order: int(1),
        logic: map({ compute: str('quantity * price') }),
      }),
    ]),
  }),
  // Desligada no escritório: nada da plataforma a desenha, e trazê-la afirmaria que a entidade existe.
  document('archivedThings', {
    titleSingular: str('Archived'),
    titleFieldKey: str('name'),
    enabled: bool(false),
    fields: arr([map({ key: str('name'), label: str('Nome'), type: str('text'), required: bool(true), order: int(0) })]),
  }),
];

const LOOKUPS: FirestoreDocument[] = [
  { name: '.../lookupDefinitions/customerSegments', fields: { label: str('Segmentos') } },
];

const TAG_LISTS: FirestoreDocument[] = [
  { name: '.../tagDefinitions/customerTags', fields: { label: str('Etiquetas'), ownerPluginId: str('com.example.billing') } },
];

const EXTENSIONS: InstalledExtensionRecord[] = [
  {
    tenantId: 'tenant-1',
    documentPath: '/tenants/tenant-1/installed_extensions/com.example.billing',
    documentId: 'com.example.billing',
    id: 'com.example.billing',
    name: 'Billing',
    version: '2.1.0',
    active: true,
    manifest: { id: 'com.example.billing' },
    data: {},
  },
];

const decode = (documents: FirestoreDocument[]): CatalogSourceDocument[] =>
  documents.map((one) => ({ id: documentId(one), data: decodeFields(one.fields) }));

const EXPORTED_AT = new Date('2026-08-27T10:00:00.000Z');

/**
 * A cópia instalada como ela está GRAVADA: o manifesto dentro de `package`. É o que o Console entrega
 * ao escritor (`data` do documento), e a fixture acima a descreve pelos campos já interpretados.
 */
const stored = (record: InstalledExtensionRecord): CatalogSourceDocument => {
  const pkg = (record.data.package ?? {}) as Record<string, unknown>;
  return {
    id: record.documentId,
    data: {
      ...record.data,
      active: record.active,
      package: { ...pkg, manifest: { name: record.name, version: record.version, ...record.manifest } },
    },
  };
};

interface ConsoleExportInput {
  projectId: string;
  tenant: { id: string; name: string };
  kernelVersion: string;
  exportedAt: Date;
  screens: CatalogSourceDocument[];
  lookups: CatalogSourceDocument[];
  tagLists: CatalogSourceDocument[];
  extensions: InstalledExtensionRecord[];
}

const buildCatalogExport = (input: ConsoleExportInput) => buildInstalledCatalog({
  ...input,
  exporter: { tool: 'console', version: CLI_VERSION },
  extensions: input.extensions.map(stored),
});

const build = () => buildCatalogExport({
  projectId: 'office-prod',
  tenant: { id: 'tenant-1', name: 'Escritório Central' },
  kernelVersion: '2.7.0',
  exportedAt: EXPORTED_AT,
  screens: decode(SCREENS),
  lookups: decode(LOOKUPS),
  tagLists: decode(TAG_LISTS),
  extensions: EXTENSIONS,
});

describe('a exportação do catálogo instalado', () => {
  it('se anuncia como retrato: projeto, escritório, quando e por qual kernel', () => {
    const exported = build();
    expect(exported.version).toBe(CATALOG_FORMAT_VERSION);
    expect(exported.projectId).toBe('office-prod');
    expect(exported.tenantId).toBe('tenant-1');
    expect(exported.tenantName).toBe('Escritório Central');
    expect(exported.exportedAt).toBe(EXPORTED_AT.toISOString());
    expect(exported.kernelVersion).toBe('2.7.0');
    expect(exported.exportedBy).toBe('console');
    expect(exported.consoleVersion).toBe(CLI_VERSION);
  });

  it('traz a tela do Form Design e a da extensão, com a coleção e o pai de cada uma', () => {
    const exported = build();
    expect(exported.screens.map((one) => one.key)).toStrictEqual(['customers', 'invoices']);

    const customers = exported.screens[0];
    expect(customers.origin).toBe('design');
    expect(customers.fields.map((one) => one.key)).toStrictEqual(['name', 'segmentId']);
    expect(customers.fields[1].lookupCollection).toBe('customerSegments');

    const invoices = exported.screens[1];
    expect(invoices.collection).toBe('billingInvoices');
    // Sem `origin` gravado, o dono é o que decide — a mesma dedução que a aplicação faz ao ler a tela.
    expect(invoices.origin).toBe('plugin');
    expect(invoices.ownerPluginId).toBe('com.example.billing');
    expect(invoices.parentEntity).toBe('customers');
    expect(invoices.fields[1].compute).toBe('quantity * price');
  });

  it('deixa de fora a tela desligada, e o conteúdo que o escritório digitou', () => {
    const exported = build();
    expect(exported.screens.some((one) => one.key === 'archivedThings')).toBe(false);

    const segment = exported.screens[0].fields[1] as unknown as Record<string, unknown>;
    expect(segment.options).toBeUndefined();
    expect(segment.placeholder).toBeUndefined();
    expect(JSON.stringify(exported)).not.toContain('Ouro');
  });

  it('traz as listas de opções e as de etiqueta pelo id do documento', () => {
    const exported = build();
    expect(exported.lookups).toStrictEqual([{ collection: 'customerSegments', label: 'Segmentos' }]);
    expect(exported.tagLists).toStrictEqual([
      { collection: 'customerTags', label: 'Etiquetas', ownerPluginId: 'com.example.billing' },
    ]);
    expect(exported.extensions).toStrictEqual([
      { id: 'com.example.billing', name: 'Billing', version: '2.1.0', active: true, exports: [], navGroups: [], documentTemplates: [], fieldPresets: [] },
    ]);
  });

  /**
   * A prova que atravessa a fronteira: o arquivo que o Console escreve é o arquivo que o SDK lê. Se um
   * dos dois lados mudar sozinho, é aqui que se descobre — e não numa instalação, meses depois.
   */
  it('é lido de volta pelo leitor do kernel, com o mesmo conteúdo', () => {
    const directory = mkdtempSync(join(tmpdir(), 'microteia-export-'));
    try {
      writeFileSync(join(directory, CATALOG_FILE), `${JSON.stringify(build(), null, 2)}\n`);
      const read = readInstalledCatalog(directory, EXPORTED_AT);

      expect(read.problems).toEqual([]);
      expect(read.snapshot?.tenantName).toBe('Escritório Central');
      expect(read.snapshot?.screens.map((one) => one.key)).toStrictEqual(['customers', 'invoices']);
      expect(read.snapshot?.screens[1].collection).toBe('billingInvoices');
      expect(read.snapshot?.screens[1].parentRelation).toBe('owned');
      expect(read.snapshot?.screens[1].fields[1].compute).toBe('quantity * price');
      expect(read.snapshot?.lookups[0].collection).toBe('customerSegments');
      expect(read.snapshot?.extensions[0].id).toBe('com.example.billing');
      expect(read.ageDays).toBe(0);
      expect(read.stale).toBe(false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

/**
 * A superfície exportada é a única parte do COMPORTAMENTO que atravessa: o nome e o tipo são contrato,
 * os passos e o código não. Sem ela, quem autora fora do escritório sabia que a extensão está lá e não
 * tinha como descobrir o nome de nada dentro dela.
 */
describe('o que cada extensão declara para as outras referenciarem', () => {
  const billing = (manifest: Record<string, unknown>, data: Record<string, unknown>): InstalledExtensionRecord => ({
    ...EXTENSIONS[0], manifest: { id: 'com.example.billing', ...manifest }, data,
  });

  const buildWith = (extension: InstalledExtensionRecord) => buildCatalogExport({
    projectId: 'office-prod',
    tenant: { id: 'tenant-1', name: 'Escritório Central' },
    kernelVersion: '2.7.0',
    exportedAt: EXPORTED_AT,
    screens: [], lookups: [], tagLists: [],
    extensions: [extension],
  });

  const PACKAGE = {
    package: {
      scripts: [{ templateId: 'normalize-tax-id', name: 'Normalize tax id' }],
      workflows: [{ templateId: 'notify-customer', name: 'Notify the customer' }],
      actions: [{ templateId: 'reissue', title: 'Reissue' }],
    },
  };

  it('casa cada export com o artefato que o atende, para dar tipo e nome', () => {
    const exported = buildWith(billing({ exports: ['notify-customer', 'normalize-tax-id'] }, PACKAGE));
    expect(exported.extensions[0].exports).toStrictEqual([
      { id: 'normalize-tax-id', kind: 'script', name: 'Normalize tax id' },
      { id: 'notify-customer', kind: 'workflow', name: 'Notify the customer' },
    ]);
  });

  /** A ação usa `title`, não `name` — o nome do artefato vem de onde cada um o guarda. */
  it('a ação exportada viaja com o título dela', () => {
    const exported = buildWith(billing({ exports: ['reissue'] }, PACKAGE));
    expect(exported.extensions[0].exports).toStrictEqual([
      { id: 'reissue', kind: 'action', name: 'Reissue' },
    ]);
  });

  /**
   * O export declarado que não casa com nada: o portão da instalação confere a LISTA e deixaria passar
   * uma referência a ele, que só falharia na primeira execução. Dizê-lo é melhor que escondê-lo.
   */
  it('o export que a extensão declara e não entrega viaja como "unknown"', () => {
    const exported = buildWith(billing({ exports: ['fantasma'] }, PACKAGE));
    expect(exported.extensions[0].exports).toStrictEqual([
      { id: 'fantasma', kind: 'unknown', name: 'fantasma' },
    ]);
  });

  it('sem declarar nada, a lista sai vazia — e vazia é uma resposta, nunca a chave ausente', () => {
    const exported = buildWith(billing({}, PACKAGE));
    expect(exported.extensions[0].exports).toStrictEqual([]);
    expect('exports' in exported.extensions[0]).toBe(true);
  });

  it('o kernel lê a superfície de volta e a considera conhecida', () => {
    const directory = mkdtempSync(join(tmpdir(), 'microteia-export-surface-'));
    try {
      const document = buildWith(billing({ exports: ['normalize-tax-id'] }, PACKAGE));
      writeFileSync(join(directory, CATALOG_FILE), `${JSON.stringify(document, null, 2)}\n`);
      const read = readInstalledCatalog(directory, EXPORTED_AT);

      expect(read.exportsKnown).toBe(true);
      expect(read.snapshot?.extensions[0].exports).toStrictEqual([
        { id: 'normalize-tax-id', kind: 'script', name: 'Normalize tax id' },
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

/**
 * Os grupos da barra lateral atravessam pelo mesmo motivo do `exports`: a chave é o que outra extensão
 * escreve para ENTRAR no grupo. Sem ela, quem autora inventa outra, e o menu ganha dois títulos iguais.
 */
describe('os grupos da barra lateral que cada extensão declara', () => {
  const calendar: InstalledExtensionRecord = {
    ...EXTENSIONS[0],
    id: 'com.microteia.calendar',
    manifest: {
      id: 'com.microteia.calendar',
      contributes: [
        { point: 'i18n.messages', id: 'en.com.microteia.calendar', metadata: { locale: 'en', namespace: 'com.microteia.calendar', messages: { 'nav.group.schedule': 'Schedule' } } },
        { point: 'i18n.messages', id: 'pt-br.com.microteia.calendar', metadata: { locale: 'pt-BR', namespace: 'com.microteia.calendar', messages: { 'nav.group.schedule': 'Agenda' } } },
        { point: 'ui.nav.group', id: 'schedule', metadata: { key: 'schedule', label: '@com.microteia.calendar/nav.group.schedule', order: 20 } },
        { point: 'ui.nav', id: 'calendar', metadata: { key: 'calendar', label: 'x', group: 'schedule' } },
      ],
    },
  };
  const literal: InstalledExtensionRecord = {
    ...EXTENSIONS[0],
    id: 'com.acme.menu',
    manifest: { id: 'com.acme.menu', contributes: [{ point: 'ui.nav.group', id: 'x', metadata: { key: 'com.acme.cases', label: 'Processos', order: 20 } }] },
  };

  const buildWith = (extensions: InstalledExtensionRecord[]) => buildCatalogExport({
    projectId: 'office-prod',
    tenant: { id: 'tenant-1', name: 'Escritório Central' },
    kernelVersion: '2.7.0',
    exportedAt: EXPORTED_AT,
    screens: [], lookups: [], tagLists: [],
    extensions,
  });

  it('traz a chave, a ordem e o nome em cada idioma que o pacote traz', () => {
    const calendarGroups = buildWith([calendar]).extensions[0].navGroups;
    expect(calendarGroups).toStrictEqual([
      { key: 'schedule', label: 'Schedule', translations: { en: 'Schedule', 'pt-BR': 'Agenda' }, order: 20 },
    ]);
  });

  it('o rótulo literal viaja como está, sem tradução', () => {
    expect(buildWith([literal]).extensions[0].navGroups).toStrictEqual([
      { key: 'com.acme.cases', label: 'Processos', translations: {}, order: 20 },
    ]);
  });

  it('sem grupo, a lista sai vazia — nunca a chave ausente', () => {
    const groups = buildWith(EXTENSIONS).extensions[0];
    expect(groups.navGroups).toStrictEqual([]);
  });

  it('o kernel lê os grupos de volta e os considera conhecidos', () => {
    const directory = mkdtempSync(join(tmpdir(), 'microteia-export-groups-'));
    try {
      writeFileSync(join(directory, CATALOG_FILE), `${JSON.stringify(buildWith([calendar, literal]), null, 2)}\n`);
      const read = readInstalledCatalog(directory, EXPORTED_AT);

      expect(read.navGroupsKnown).toBe(true);
      expect(read.snapshot?.extensions.find((one) => one.id === 'com.microteia.calendar')?.navGroups).toStrictEqual([
        { key: 'schedule', label: 'Schedule', translations: { en: 'Schedule', 'pt-BR': 'Agenda' }, order: 20 },
      ]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

/**
 * Os modelos de documento atravessam como CONTRATO: é contra eles que o passo `render-document` de
 * outra extensão é conferido. A leitura do Console é uma cópia da do kernel — o Console não alcança
 * `src/` —, e este teste é o que impede as duas de divergirem.
 */
describe('os modelos de documento que cada extensão declara', () => {
  const documents: InstalledExtensionRecord = {
    ...EXTENSIONS[0],
    id: documentExamplePlugin.manifest.id,
    manifest: JSON.parse(JSON.stringify(documentExamplePlugin.manifest)) as Record<string, unknown>,
  };

  const buildWith = (extensions: InstalledExtensionRecord[]) => buildCatalogExport({
    projectId: 'office-prod',
    tenant: { id: 'tenant-1', name: 'Escritório Central' },
    kernelVersion: '2.7.0',
    exportedAt: EXPORTED_AT,
    screens: [], lookups: [], tagLists: [],
    extensions,
  });

  it('o Console lê o mesmo contrato que o kernel lê do manifesto', () => {
    const exported = buildWith([documents]).extensions[0].documentTemplates;
    const kernel = declaredDocumentTemplates(documentExamplePlugin.manifest.contributes)
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    expect(exported).toStrictEqual(kernel);
    expect(exported.map((one) => one.key)).toStrictEqual(['installment-receipt', 'payment-plan']);
  });

  it('leva a forma, nunca o texto do modelo', () => {
    const written = JSON.stringify(buildWith([documents]).extensions[0].documentTemplates);
    expect(written).not.toContain('Receipt');
    expect(written).not.toContain('@com.microteia.document-example/');
  });

  it('o kernel lê os modelos de volta e os considera conhecidos', () => {
    const directory = mkdtempSync(join(tmpdir(), 'microteia-export-templates-'));
    try {
      writeFileSync(join(directory, CATALOG_FILE), `${JSON.stringify(buildWith([documents, EXTENSIONS[0]]), null, 2)}\n`);
      const read = readInstalledCatalog(directory, EXPORTED_AT);

      expect(read.documentTemplatesKnown).toBe(true);
      expect(read.snapshot?.extensions.find((one) => one.id === documents.id)?.documentTemplates)
        .toStrictEqual(buildWith([documents]).extensions[0].documentTemplates);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

/**
 * Os presets de campo atravessam como as PARTES que cada um tem: é contra elas que o `mask` de um
 * campo de outra extensão é conferido. A leitura do Console é uma cópia da do kernel, e este teste é o
 * que impede as duas de divergirem.
 */
describe('os presets de campo que cada extensão declara', () => {
  const brasil: InstalledExtensionRecord = {
    ...EXTENSIONS[0],
    id: brasilPlugin.manifest.id,
    manifest: JSON.parse(JSON.stringify(brasilPlugin.manifest)) as Record<string, unknown>,
  };

  const buildWith = (extensions: InstalledExtensionRecord[]) => buildCatalogExport({
    projectId: 'office-prod',
    tenant: { id: 'tenant-1', name: 'Escritório Central' },
    kernelVersion: '2.80.0',
    exportedAt: EXPORTED_AT,
    screens: [], lookups: [], tagLists: [],
    extensions,
  });

  it('o Console lê o mesmo que o kernel lê do manifesto', () => {
    const exported = buildWith([brasil]).extensions[0].fieldPresets;
    const kernel = declaredFieldPresets(brasilPlugin.manifest.contributes)
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    expect(exported).toStrictEqual(kernel);
    expect(exported.find((one) => one.key === 'cpfCnpj')?.slots).toStrictEqual(['mask', 'format', 'validate']);
  });

  it('leva a chave e as partes, nunca o template nem a regra', () => {
    const written = JSON.stringify(buildWith([brasil]).extensions[0].fieldPresets);
    expect(written).not.toContain('###');
    expect(written).not.toContain('isCPF');
  });

  it('o kernel lê os presets de volta e os considera conhecidos', () => {
    const directory = mkdtempSync(join(tmpdir(), 'microteia-export-presets-'));
    try {
      writeFileSync(join(directory, CATALOG_FILE), `${JSON.stringify(buildWith([brasil, EXTENSIONS[0]]), null, 2)}\n`);
      const read = readInstalledCatalog(directory, EXPORTED_AT);

      expect(read.fieldPresetsKnown).toBe(true);
      expect(read.snapshot?.extensions.find((one) => one.id === brasil.id)?.fieldPresets)
        .toStrictEqual(buildWith([brasil]).extensions[0].fieldPresets);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

/**
 * As chaves da tela atravessam como esquema: sem elas, o plano propunha como nova, a cada execução, a
 * chave que o escritório declarou no Form Design ou que uma extensão de terceiro instalou.
 */
describe('as chaves de cada tela', () => {
  const keyed = document('customers', {
    titleSingular: str('Customer'),
    titleFieldKey: str('name'),
    origin: str('design'),
    enabled: bool(true),
    keys: arr([
      map({
        name: str('customer-name'),
        kind: str('unique'),
        fields: arr([str('name')]),
        normalize: map({ caseInsensitive: bool(true), formatPreset: str('digits') }),
        sparse: bool(false),
        // Apresentação e estado: não mudam qual reserva um registro recebe.
        message: str('@com.example.billing/key.customer-name'),
        status: str('active'),
        ownerPluginId: str('com.example.billing'),
      }),
      map({ name: str('incomplete'), kind: str('unique'), fields: arr([]) }),
    ]),
    fields: arr([
      map({ key: str('name'), label: str('Nome'), type: str('text'), required: bool(true), order: int(0) }),
      map({ key: str('email'), label: str('E-mail'), type: str('text'), required: bool(false), order: int(1), unique: bool(true) }),
    ]),
  });

  const buildWith = (screens: FirestoreDocument[]) => buildCatalogExport({
    projectId: 'office-prod',
    tenant: { id: 'tenant-1', name: 'Escritório Central' },
    kernelVersion: '2.7.0',
    exportedAt: EXPORTED_AT,
    screens: decode(screens), lookups: [], tagLists: [],
    extensions: [],
  });

  const CUSTOMER_NAME = {
    name: 'customer-name',
    kind: 'unique',
    fields: ['name'],
    normalize: { caseInsensitive: true, formatPreset: 'digits' },
    sparse: false,
    ownerPluginId: 'com.example.billing',
  };

  it('leva a forma da chave e o `unique` do campo, nunca a mensagem nem o estado', () => {
    const [screen] = buildWith([keyed]).screens;
    expect(screen.keys).toStrictEqual([CUSTOMER_NAME]);
    expect(screen.fields.map((one) => one.unique)).toStrictEqual([undefined, true]);
    expect(JSON.stringify(screen)).not.toContain('key.customer-name');
  });

  it('sem chave, a lista sai vazia — nunca a chave ausente', () => {
    const [screen] = buildWith([SCREENS[0]]).screens;
    expect(screen.keys).toStrictEqual([]);
    expect('keys' in screen).toBe(true);
  });

  it('o kernel lê as chaves de volta, e o catálogo as resolve como a instalação', () => {
    const directory = mkdtempSync(join(tmpdir(), 'microteia-export-keys-'));
    try {
      writeFileSync(join(directory, CATALOG_FILE), `${JSON.stringify(buildWith([keyed]), null, 2)}\n`);
      const read = readInstalledCatalog(directory, EXPORTED_AT);

      expect(read.keysKnown).toBe(true);
      expect(read.snapshot?.screens[0].keys).toStrictEqual([CUSTOMER_NAME]);
      const catalog = buildDomainCatalog(read.snapshot!.screens.map(installedScreenInput));
      expect(catalog.entities.find((one) => one.collection === 'customers')?.keys?.map((one) => one.name))
        .toStrictEqual(['field:email', 'customer-name']);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

/**
 * O escritor vem do SDK de `extensions/`, não do Console. O que se prova aqui é a fronteira: o SDK que
 * o tem é usado, e o que não o tem é RECUSADO com o caminho de saída — nunca substituído em silêncio por
 * uma cópia que não é conferida contra o leitor.
 */
describe('o escritor carregado do SDK de extensions/', () => {
  const workspace = (sdkSource: string | null): string => {
    const directory = mkdtempSync(join(tmpdir(), 'microteia-writer-'));
    writeFileSync(join(directory, 'package.json'), '{"name":"extensions","private":true}\n');
    if (sdkSource !== null) {
      const sdk = join(directory, 'node_modules', '@microteia', 'sdk');
      mkdirSync(sdk, { recursive: true });
      writeFileSync(join(sdk, 'package.json'), '{"name":"@microteia/sdk","main":"index.js"}\n');
      writeFileSync(join(sdk, 'index.js'), sdkSource);
    }
    return directory;
  };

  it('sem SDK instalado, recusa dizendo como trazê-lo', () => {
    const directory = workspace(null);
    try {
      expect(() => loadCatalogWriter(directory)).toThrow(/plugin-init/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('com um SDK anterior ao escritor, recusa e aponta as duas portas', () => {
    const directory = workspace('module.exports = { KERNEL_VERSION: "2.0.0" };\n');
    try {
      expect(() => loadCatalogWriter(directory)).toThrow(/unpack --version latest[\s\S]*Export catalog/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('com o escritor no SDK, é ele que monta e serializa o arquivo', () => {
    const directory = workspace([
      'exports.INSTALLED_CATALOG_FILE = "installed-catalog.json";',
      'exports.buildInstalledCatalog = (input) => ({ from: "sdk", tenantId: input.tenant.id });',
      'exports.serializeInstalledCatalog = (snapshot) => JSON.stringify(snapshot);',
    ].join('\n'));
    try {
      const writer = loadCatalogWriter(directory);
      const built = writer.build({
        projectId: 'office-prod',
        tenant: { id: 'tenant-1', name: 'Escritório Central' },
        kernelVersion: '2.7.0',
        exportedAt: EXPORTED_AT,
        exporter: { tool: 'console', version: CLI_VERSION },
        screens: [], lookups: [], tagLists: [], extensions: [],
      });
      expect(writer.file).toBe('installed-catalog.json');
      expect(writer.serialize(built)).toBe('{"from":"sdk","tenantId":"tenant-1"}');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
