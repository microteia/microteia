import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import { EXAMPLE_NOTES } from './exampleNotes';
import { describeExtension, listExamples } from './describeExtension';
import { readMcpResource, runMcpTool } from './mcp';
import { EXAMPLES_DIR } from './workspacePlugins';

/**
 * O QUE UMA EXTENSÃO É CAPAZ DE FAZER, respondido do pacote compilado.
 *
 * A pergunta não tinha resposta: o que se enxergava de uma extensão era id, versão e problemas, e
 * "como se faz uma view de código?" só se respondia abrindo seis `plugin.ts` e inferindo. O que este
 * arquivo cobra é a única propriedade que faz a resposta valer mais que prosa ao lado do código: cada
 * linha dela sai do pacote — inclusive o texto, que vem do catálogo que o próprio pacote carrega.
 */

const NAMESPACE = 'com.example.billing';
const catalog = {
  locale: 'en',
  namespace: NAMESPACE,
  messages: {
    'package.name': 'Billing',
    'package.description': 'Invoices, and the taxes on them.',
    'package.category': 'Finance',
    'package.summary': 'Issues invoices and keeps the tax on each one.',
    'overview.body': 'It adds an Invoices screen and a monthly closing flow.',
    'overview.adds': 'Adds',
    'overview.adds.value': 'Invoices, Invoice lines',
    'overview.warning': 'The closing flow cannot be undone.',
    'screen.invoices': 'Invoice',
    'field.number': 'Number',
    'flow.closing': 'Monthly closing',
  },
};

const message = (key: string): string => `@${NAMESPACE}/${key}`;

const PLUGIN = `export default {
  manifest: {
    id: '${NAMESPACE}',
    version: '2.3.0',
    kernel: '^2.0.0',
    name: '${message('package.name')}',
    description: '${message('package.description')}',
    category: '${message('package.category')}',
    exports: ['monthly-closing'],
    dependencies: { 'com.example.utils': '^1.0.0' },
    permissions: ['data:invoices:close'],
    extensionPoints: [{
      id: 'billing.taxrule',
      apiVersion: '1.0.0',
      title: 'Tax rule',
      description: 'A rule that computes tax on an invoice line.',
      cardinality: 'many',
      allowedImplKinds: ['code'],
    }],
    backend: { functions: ['billingClose'], parameters: ['BILLING_TAX_ID'] },
    contributes: [
      {
        point: 'i18n.messages',
        id: 'messages.en',
        apiVersion: '1.0.0',
        metadata: ${JSON.stringify(catalog)},
      },
      {
        point: 'ui.page',
        id: 'page.invoices',
        apiVersion: '1.0.0',
        metadata: {},
        impl: { kind: 'code', key: 'invoices' },
      },
    ],
  },
  summary: '${message('package.summary')}',
  overview: {
    type: 'stack',
    children: [
      { type: 'markdown', content: '${message('overview.body')}' },
      { type: 'keyValue', items: [{ label: '${message('overview.adds')}', value: '${message('overview.adds.value')}' }] },
      { type: 'banner', message: '${message('overview.warning')}', variant: 'warning' },
    ],
  },
  workflows: [{
    templateId: 'monthly-closing',
    name: '${message('flow.closing')}',
    eventName: 'workflow.called',
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    steps: [],
  }],
  screens: [{
    key: 'invoices',
    titleSingular: '${message('screen.invoices')}',
    titlePlural: 'Invoices',
    icon: 'contract',
    titleFieldKey: 'number',
    fields: [
      { key: 'number', label: '${message('field.number')}', type: 'text', required: true, order: 0 },
      { key: 'total', label: 'Total', type: 'currency', required: false, order: 1 },
    ],
  }],
  lookups: [{ collection: 'invoiceStatuses', label: 'Invoice status' }],
  views: [{ key: 'invoices', title: 'Invoices', icon: 'contract', source: 'export default () => null;' }],
};
`;

/** Um exemplo de primeira parte, na pasta em que o `sync` os põe e com o nome de um deles. */
const EXAMPLE = `export default {
  manifest: {
    id: 'com.microteia.calendar',
    version: '1.3.0',
    kernel: '^2.0.0',
    name: 'Calendar',
    description: 'A calendar over what the office already stores.',
    contributes: [],
  },
  summary: 'A calendar over what the office already stores.',
  workflows: [],
};
`;

const workspace = mkdtempSync(join(tmpdir(), 'microteia-describe-'));
mkdirSync(join(workspace, 'billing'), { recursive: true });
mkdirSync(join(workspace, EXAMPLES_DIR, 'calendar'), { recursive: true });
writeFileSync(join(workspace, 'billing', 'plugin.ts'), PLUGIN);
writeFileSync(join(workspace, EXAMPLES_DIR, 'calendar', 'plugin.ts'), EXAMPLE);

afterAll(() => rmSync(workspace, { recursive: true, force: true }));

const answer = (query: string, detail?: 'summary' | 'full'): Record<string, unknown> => {
  const result = describeExtension(workspace, query, detail === undefined ? {} : { detail });
  expect(result.found, typeof result.answer === 'string' ? result.answer : '').toBe(true);
  return result.answer as Record<string, unknown>;
};

describe('a descrição de UMA extensão, derivada do pacote', () => {
  it('encontra pelo nome da pasta, pelo id e pelo caminho do plugin.ts', () => {
    for (const query of ['billing', NAMESPACE, join('billing', 'plugin.ts')]) {
      expect((answer(query).extension as { id: string }).id).toBe(NAMESPACE);
    }
  });

  /**
   * O texto sai do catálogo que o PACOTE carrega. Sem isso a resposta imprimiria
   * `@com.example.billing/package.description` — a chave, para quem quer a frase.
   */
  it('resolve o texto do pacote em vez de devolver a chave dele', () => {
    const read = answer('billing');
    expect(read.extension).toMatchObject({
      id: NAMESPACE,
      version: '2.3.0',
      name: 'Billing',
      description: 'Invoices, and the taxes on them.',
      category: 'Finance',
    });
    expect(read.whatItDoes).toMatchObject({ summary: 'Issues invoices and keeps the tax on each one.' });
  });

  /** A `overview` é Widget DSL e é `unknown` no tipo: a caminhada colhe o texto e ignora o resto. */
  it('achata a overview em linhas, sem precisar conhecer cada tipo de nó', () => {
    const overview = (answer('billing').whatItDoes as { overview: string[] }).overview;
    expect(overview).toContain('It adds an Invoices screen and a monthly closing flow.');
    expect(overview).toContain('Adds — Invoices, Invoice lines');
    expect(overview).toContain('The closing flow cannot be undone.');
  });

  it('agrupa as contribuições pelo PONTO, que é a pergunta que se faz delas', () => {
    const capability = answer('billing').capability as {
      contributesTo: { point: string; ids: string[]; impl: string[] }[];
      declaresExtensionPoints: string[];
      declaresPermissions: string[];
    };
    expect(capability.contributesTo.map((one) => one.point)).toStrictEqual(['i18n.messages', 'ui.page']);
    expect(capability.contributesTo[1]).toMatchObject({ ids: ['page.invoices'], impl: ['code'] });
    expect(capability.declaresExtensionPoints).toStrictEqual(['billing.taxrule']);
    expect(capability.declaresPermissions).toStrictEqual(['data:invoices:close']);
  });

  it('diz o que a extensão traz, e o que ela exige do projeto Firebase', () => {
    const read = answer('billing');
    expect(read.brings).toMatchObject({
      lookups: ['invoiceStatuses'],
      codeViews: ['invoices'],
      hasStartupCode: false,
      migrations: [],
    });
    const screens = (read.brings as { screens: Record<string, unknown>[] }).screens;
    expect(screens[0]).toMatchObject({ key: 'invoices', collection: 'invoices', title: 'Invoice', fields: 2 });
    expect(read.requiresOfTheProject)
      .toStrictEqual({ functions: ['billingClose'], parameters: ['BILLING_TAX_ID'] });
  });

  /** O padrão CONTA os campos; abrir todos por padrão faria da resposta o `.json` que ninguém lê. */
  it('só o detalhe `full` abre campo por campo', () => {
    const screens = (answer('billing', 'full').brings as { screens: { fields: unknown[] }[] }).screens;
    expect(screens[0].fields).toStrictEqual([
      { key: 'number', label: 'Number', type: 'text', required: true },
      { key: 'total', label: 'Total', type: 'currency' },
    ]);
  });

  it('diz a superfície pública, o acoplamento declarado e se o pacote instalaria', () => {
    const read = answer('billing');
    expect(read.surface).toMatchObject({
      exports: [{ id: 'monthly-closing', kind: 'workflow', name: 'Monthly closing' }],
      dependencies: { 'com.example.utils': '^1.0.0' },
    });
    expect(read.wouldInstall).toContain('Yes');
  });

  /** A resposta de um exemplo carrega o que ele é: material de leitura, e o mecanismo que ele ensina. */
  it('o exemplo se apresenta como exemplo, com a nota de por que ler aquele', () => {
    const source = answer('calendar').source as { origin: string; isReadingMaterial: string; whyReadThisOne: string };
    expect(source.origin).toBe('example');
    expect(source.isReadingMaterial).toContain('Nobody in this organization wrote it');
    expect(source.whyReadThisOne).toBe(EXAMPLE_NOTES.calendar);
  });

  it('o que ele escreveu é autoria, e não carrega nota nenhuma', () => {
    const source = answer('billing').source as { origin: string; whyReadThisOne?: string };
    expect(source.origin).toBe('authored');
    expect(source.whyReadThisOne).toBeUndefined();
  });

  /** Um nome que não existe volta com os que existem — nunca com uma descrição inventada. */
  it('nome desconhecido volta com a lista do que existe aqui', () => {
    const result = describeExtension(workspace, 'com.example.ghost');
    expect(result.found).toBe(false);
    expect(result.answer).toContain('billing');
    expect(result.answer).toContain(join(EXAMPLES_DIR, 'calendar'));
  });

  it('a tool exige o argumento em vez de escolher uma extensão por conta própria', () => {
    expect(runMcpTool('describe_extension', { extension: '  ' }, workspace)).toContain('Name the extension');
  });
});

describe('a lista dos exemplos — a pergunta que vem antes', () => {
  it('diz qual mecanismo cada um ensina, que é o que nenhum pacote responde', () => {
    const read = listExamples(workspace) as {
      total: number;
      examples: { folder: string; path: string; whyReadThisOne: string }[];
    };
    expect(read.total).toBe(1);
    expect(read.examples[0]).toMatchObject({
      folder: 'calendar',
      path: join(EXAMPLES_DIR, 'calendar', 'plugin.ts'),
      whyReadThisOne: EXAMPLE_NOTES.calendar,
    });
  });

  it('e é servida como recurso, porque não recebe argumento nenhum', () => {
    const served = JSON.parse(readMcpResource('microteia://examples', workspace)) as { total: number };
    expect(served.total).toBe(1);
  });

  /** Um diretório sem exemplos diz por que não os tem, em vez de devolver uma lista vazia. */
  it('sem exemplos, a resposta explica a ausência', () => {
    const empty = mkdtempSync(join(tmpdir(), 'microteia-noexamples-'));
    try {
      const read = listExamples(empty) as { total: number; note: string };
      expect(read.total).toBe(0);
      expect(read.note).toContain('never synced');
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

/** O kernel de que esta descrição fala é o desta árvore: um exemplo compilado contra outro contrato mentiria. */
it('o contrato do kernel é o desta instalação', () => {
  expect(KERNEL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
});
