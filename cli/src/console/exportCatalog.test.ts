import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATALOG_FILE, CATALOG_FORMAT_VERSION, buildCatalogExport } from './exportCatalog.js';
import type { CatalogSourceDocument } from './exportCatalog.js';
import type { InstalledExtensionRecord } from './installedExtensions.js';
import { decodeFields, documentId } from './firestoreRest.js';
import type { FirestoreDocument } from './firestoreRest.js';
import { readInstalledCatalog } from '../../../src/sdk/node/installedCatalog';

/**
 * O RETRATO, montado a partir do que o Firestore devolve — e lido de volta pelo SDK.
 *
 * As duas pontas deste contrato são compiladas separadamente: o Console não alcança `src/`, porque ele
 * é distribuído sozinho e uma versão dele pode ser mais velha que o kernel instalado. Sobra um formato
 * escrito de um lado e lido de outro, que é exatamente a forma de acoplamento que envelhece calada — o
 * exportador acrescenta um campo, o leitor nunca soube dele, e nada reprova.
 *
 * Então o teste atravessa a fronteira de propósito: ele monta o documento com o exportador e o entrega
 * ao leitor DO KERNEL. É a única prova que vale, porque é o percurso real do arquivo.
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
    expect(exported.consoleVersion).toMatch(/^\d+\.\d+\.\d+$/);
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
      { id: 'com.example.billing', name: 'Billing', version: '2.1.0', active: true },
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
