import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import { INSTALLED_CATALOG_FILE, INSTALLED_CATALOG_VERSION } from './installedCatalog';
import { readMcpResource } from './mcp';
import { referenceableArtifacts } from './referenceable';
import { readWorkspaceCatalog } from './workspaceCatalog';
import { EXAMPLES_DIR, findPluginFiles } from './workspacePlugins';

/**
 * `examples/` DENTRO do diretório de autoria, e por que ele não é autoria.
 *
 * As extensões de primeira parte viajam em fonte e são copiadas para `extensions/examples/`, uma pasta
 * cada, porque é ali que se lê o que se vai escrever. O efeito colateral não era ausência — era
 * atribuição errada, que é pior: as duas varreduras de `plugin.ts` as pegavam, e a partir daí o
 * escritório aparecia como AUTOR de seis pacotes que ele nunca escreveu, a superfície do exemplo
 * respondia no lugar da extensão instalada, e a coleção do exemplo DESCARTAVA a tela real do escritório
 * pela precedência "o workspace ganha" — que existe justamente para o contrário.
 */

const authoredSource = `export default {
  manifest: {
    id: 'com.office.sales',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: 'Sales',
    description: 'What the office wrote.',
    contributes: [],
  },
  summary: 'What the office wrote.',
  workflows: [],
  screens: [{
    key: 'orders',
    titleSingular: 'Order',
    titlePlural: 'Orders',
    icon: 'receipt',
    titleFieldKey: 'code',
    fields: [{ key: 'code', label: 'Code', type: 'text', required: true, order: 0 }],
  }],
};
`;

/**
 * O exemplo declara de propósito a MESMA coleção que a instalação tem (`customers`) e uma que só ele
 * tem (`calendarEvents`), e exporta um artefato com nome DIFERENTE do que está instalado. É o que
 * separa as três consequências do defeito num fixture só.
 */
const exampleSource = `export default {
  manifest: {
    id: 'com.microteia.calendar',
    version: '9.0.0',
    kernel: '^2.0.0',
    name: 'Calendar',
    description: 'Ours, as reading material.',
    contributes: [],
    exports: ['refresh-from-example'],
  },
  summary: 'Ours, as reading material.',
  workflows: [],
  scripts: [{
    templateId: 'refresh-from-example',
    name: 'Refresh from example',
    sourceTs: '',
    compiledJs: '',
    inputParams: [],
    outputParams: [],
  }],
  screens: [
    {
      key: 'calendarEvents',
      titleSingular: 'Event',
      titlePlural: 'Events',
      icon: 'calendar',
      titleFieldKey: 'title',
      fields: [{ key: 'title', label: 'Title', type: 'text', required: true, order: 0 }],
    },
    {
      key: 'customers',
      titleSingular: 'Customer',
      titlePlural: 'Customers',
      icon: 'user',
      titleFieldKey: 'name',
      fields: [{ key: 'name', label: 'Name', type: 'text', required: true, order: 0 }],
    },
  ],
};
`;

const workspace = mkdtempSync(join(tmpdir(), 'microteia-examples-'));
mkdirSync(join(workspace, 'sales'), { recursive: true });
mkdirSync(join(workspace, EXAMPLES_DIR, 'calendar'), { recursive: true });
writeFileSync(join(workspace, 'sales', 'plugin.ts'), authoredSource);
writeFileSync(join(workspace, EXAMPLES_DIR, 'calendar', 'plugin.ts'), exampleSource);

/** A tela que o escritório criou no Form Design, e a extensão que ele instalou de verdade. */
const writeSnapshot = (): void => writeFileSync(
  join(workspace, INSTALLED_CATALOG_FILE),
  JSON.stringify({
    version: INSTALLED_CATALOG_VERSION,
    projectId: 'office-prod',
    tenantId: 'tenant-1',
    tenantName: 'Escritório Central',
    exportedAt: new Date().toISOString(),
    kernelVersion: KERNEL_VERSION,
    consoleVersion: '2.20.0',
    extensions: [{
      id: 'com.microteia.calendar',
      name: 'Calendar',
      version: '1.2.0',
      active: true,
      exports: [{ id: 'refresh-as-installed', kind: 'script', name: 'Refresh as installed' }],
    }],
    screens: [{
      key: 'customers',
      collection: 'customers',
      titleSingular: 'Customer',
      titlePlural: 'Customers',
      titleFieldKey: 'legalName',
      fields: [{ key: 'legalName', label: 'Legal name', type: 'text', required: true, order: 0 }],
    }],
    lookups: [],
    tagLists: [],
  }),
);

afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe('o que mora em `examples/` é material de leitura, nunca autoria do escritório', () => {
  it('a varredura separa os dois, e é ela que o resto do SDK importa', () => {
    const files = findPluginFiles(workspace);
    expect(files.authored).toStrictEqual([join(workspace, 'sales', 'plugin.ts')]);
    expect(files.examples).toStrictEqual([join(workspace, EXAMPLES_DIR, 'calendar', 'plugin.ts')]);
  });

  /**
   * A consequência mais silenciosa das três: `calendarEvents` não existe em escritório nenhum, e uma
   * entidade inventada no catálogo faz o detector de campo de outra entidade disparar contra ela.
   */
  it('a entidade que só o exemplo declara NÃO entra no catálogo', () => {
    const read = readWorkspaceCatalog(workspace);
    expect(read.failures).toEqual([]);
    expect(read.catalog.entities.map((one) => one.collection).sort())
      .toStrictEqual(['members', 'orders', 'tenant']);
    expect(read.sources.map((one) => one.pluginId)).toStrictEqual(['com.office.sales']);
    expect(read.authored.map((one) => one.pluginId)).toStrictEqual(['com.office.sales']);
  });

  /** Ele continua sendo DITO, com o caminho: um diretório só com exemplos não pode parecer vazio. */
  it('mas é anunciado como fonte para ler, e como o que o catálogo não tem', () => {
    const read = readWorkspaceCatalog(workspace);
    expect(read.examples).toStrictEqual([join(EXAMPLES_DIR, 'calendar', 'plugin.ts')]);

    const answer = readMcpResource('microteia://entities', workspace);
    expect(answer).toContain(join(EXAMPLES_DIR, 'calendar', 'plugin.ts'));
    expect(answer).toContain('NOT in this catalog');
  });

  /**
   * A pior das três: o exemplo vencia a precedência do workspace e a tela real do escritório era
   * descartada — o agente passava a modelar contra `name`, que a instalação não tem.
   */
  it('o exemplo NÃO sombreia a tela que o escritório tem de verdade', () => {
    writeSnapshot();
    try {
      const read = readWorkspaceCatalog(workspace);
      expect(read.installed?.shadowedCollections).toStrictEqual([]);
      expect(read.installed?.addedCollections).toStrictEqual(['customers']);

      const customers = read.catalog.entities.find((one) => one.collection === 'customers');
      expect(customers?.source).toBe('installation');
      expect(customers?.fields.map((one) => one.key)).toStrictEqual(['legalName']);
    } finally {
      rmSync(join(workspace, INSTALLED_CATALOG_FILE), { force: true });
    }
  });

  /** Quem responde pela extensão instalada é o retrato: ele sabe a versão e se ela está ligada. */
  it('a superfície referenciável é a da extensão INSTALADA, não a do exemplo de mesmo id', () => {
    writeSnapshot();
    try {
      const artifacts = referenceableArtifacts(readWorkspaceCatalog(workspace));
      expect(artifacts.map((one) => `${one.ref} ${one.from}`))
        .toStrictEqual(['com.microteia.calendar/refresh-as-installed installation']);
    } finally {
      rmSync(join(workspace, INSTALLED_CATALOG_FILE), { force: true });
    }
  });

  /** Sem retrato, a resposta honesta é que não se sabe — nunca a superfície do exemplo. */
  it('sem retrato, o exemplo não responde pela extensão: a lista fica vazia', () => {
    expect(referenceableArtifacts(readWorkspaceCatalog(workspace))).toEqual([]);
  });

  it('a lista de pacotes do workspace nomeia o exemplo À PARTE, e não como escrito aqui', () => {
    const answer = readMcpResource('microteia://workspace/plugins', workspace);
    expect(answer).toContain('com.office.sales');
    expect(answer).not.toContain('com.microteia.calendar');
    expect(answer).toContain('nobody here wrote them');
    expect(answer).toContain(join(EXAMPLES_DIR, 'calendar', 'plugin.ts'));
  });

  it('e o retrato do workspace os lista em campos separados', () => {
    const answer = JSON.parse(readMcpResource('microteia://workspace/info', workspace)) as {
      plugins: string[];
      examples: string[];
    };
    expect(answer.plugins).toStrictEqual([join('sales', 'plugin.ts')]);
    expect(answer.examples).toStrictEqual([join(EXAMPLES_DIR, 'calendar', 'plugin.ts')]);
  });
});
