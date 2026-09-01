import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import { INSTALLED_CATALOG_FILE, INSTALLED_CATALOG_VERSION } from './installedCatalog';
import { readMcpResource, runMcpTool } from './mcp';
import { buildPlugin } from './compile';
import type { CrossRefFinding } from './referenceable';
import { crossRefFindings, referenceableArtifacts } from './referenceable';
import { readWorkspaceCatalog } from './workspaceCatalog';

/**
 * O QUE SE PODE REFERENCIAR, e se o que já está escrito resolve.
 *
 * As duas perguntas nascem do mesmo defeito, e ele não é de precaução: uma extensão passou a poder
 * usar o artefato de outra, a superfície exportada passou a viajar no retrato da instalação — e a ser
 * anunciada em três respostas, todas sobre entidade, tela e campo. Quem escreve o passo pergunta o
 * passo. Pior: a extensão IRMÃ, escrita no mesmo diretório, não aparecia em fonte nenhuma, porque o
 * retrato só conhece o que já está instalado, e a irmã ainda não está.
 *
 * E o portão que confere a referência morava só na instalação: `validate_plugin` prometia "as mesmas
 * checagens que a plataforma roda na instalação" e não conferia as duas que só o outro lado responde.
 * Um id trocado passava aqui e era recusado no escritório de quem instala — o único lugar em que
 * ninguém tem como consertá-lo.
 */

const utilsSource = (exports: string[]): string => `export default {
  manifest: {
    id: 'com.example.utils',
    version: '1.4.0',
    kernel: '^2.0.0',
    name: 'Utils',
    description: 'Shared helpers.',
    contributes: [],
    exports: ${JSON.stringify(exports)},
  },
  summary: 'Shared helpers.',
  workflows: [{
    templateId: 'notify-customer',
    name: 'Notify customer',
    eventName: 'workflow.called',
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    steps: [],
  }],
  scripts: [{
    templateId: 'normalize-tax-id',
    name: 'Normalize tax id',
    sourceTs: '',
    compiledJs: '',
    inputParams: [],
    outputParams: [],
  }],
};
`;

const consumerSource = (ref: string, dependency = 'com.example.utils'): string => `export default {
  manifest: {
    id: 'com.example.sales',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: 'Sales',
    description: 'Sales.',
    contributes: [],
    dependencies: { '${dependency}': '^1.0.0' },
  },
  summary: 'Sales.',
  workflows: [{
    templateId: 'on-save',
    name: 'On save',
    eventName: 'workflow.called',
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    steps: [{
      id: 's1',
      stepDefinitionId: 'script',
      type: 'Action',
      order: 0,
      enabled: true,
      configuration: { scriptId: { kind: 'Literal', value: '${ref}' } },
    }],
  }],
};
`;

const workspace = mkdtempSync(join(tmpdir(), 'microteia-referenceable-'));
mkdirSync(join(workspace, 'utils'), { recursive: true });
mkdirSync(join(workspace, 'sales'), { recursive: true });

const writeUtils = (exports: string[]): void =>
  writeFileSync(join(workspace, 'utils', 'plugin.ts'), utilsSource(exports));

const writeConsumer = (ref: string, dependency?: string): void =>
  writeFileSync(join(workspace, 'sales', 'plugin.ts'), consumerSource(ref, dependency));

const snapshot = (extensions: Record<string, unknown>[]): void => writeFileSync(
  join(workspace, INSTALLED_CATALOG_FILE),
  JSON.stringify({
    version: INSTALLED_CATALOG_VERSION,
    projectId: 'office-prod',
    tenantId: 'tenant-1',
    tenantName: 'Escritório Central',
    exportedAt: new Date().toISOString(),
    kernelVersion: KERNEL_VERSION,
    consoleVersion: '2.20.0',
    extensions,
    screens: [],
    lookups: [],
    tagLists: [],
  }),
);

/** O pacote do consumidor conferido contra o que este diretório enxerga — o portão, rodado aqui. */
const consumerFindings = (ref: string, dependency?: string): CrossRefFinding[] => {
  writeConsumer(ref, dependency);
  const { package: pkg } = buildPlugin({ entry: join(workspace, 'sales', 'plugin.ts') });
  return crossRefFindings(pkg, readWorkspaceCatalog(workspace));
};

afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe('a superfície que se pode referenciar deste diretório', () => {
  afterEach(() => rmSync(join(workspace, INSTALLED_CATALOG_FILE), { force: true }));

  /**
   * O caso mais comum de compartilhamento, e o único que retrato nenhum alcança: a `utils` e quem a
   * usa, escritas lado a lado. O que se enxergava da irmã era id, versão e problemas.
   */
  it('a irmã deste diretório entra na lista, com o tipo e a referência já escrita', () => {
    writeUtils(['normalize-tax-id', 'notify-customer']);
    writeConsumer('com.example.utils/normalize-tax-id');

    const artifacts = referenceableArtifacts(readWorkspaceCatalog(workspace));
    expect(artifacts.map((one) => one.ref).sort())
      .toStrictEqual(['com.example.utils/normalize-tax-id', 'com.example.utils/notify-customer']);

    const script = artifacts.find((one) => one.ref === 'com.example.utils/normalize-tax-id');
    expect(script).toMatchObject({ kind: 'script', name: 'Normalize tax id', from: 'workspace' });
    // O `kind` decide ONDE a referência cabe, e é isso que a resposta diz em vez de deixar deduzir.
    expect(script?.writtenIn).toContain('scriptId');
    expect(artifacts.find((one) => one.ref === 'com.example.utils/notify-customer')?.writtenIn)
      .toContain('targetWorkflowId');
  });

  /** Prometer o que não se entrega passaria no portão da instalação, que confere a LISTA. */
  it('export declarado que não casa com artefato nenhum viaja como unknown, e não cabe em lugar nenhum', () => {
    writeUtils(['normalize-tax-id', 'ghost']);
    const ghost = referenceableArtifacts(readWorkspaceCatalog(workspace))
      .find((one) => one.id === 'ghost');
    expect(ghost).toMatchObject({ kind: 'unknown', from: 'workspace' });
    expect(ghost?.writtenIn).toBeUndefined();
  });

  /** Aqui a lista vazia é AFIRMAÇÃO: o `plugin.ts` está na mão. No retrato ela pode ser silêncio. */
  it('pacote sem exports não expõe nada', () => {
    writeUtils([]);
    expect(referenceableArtifacts(readWorkspaceCatalog(workspace))).toEqual([]);
  });

  it('a extensão instalada e a irmã do diretório entram na MESMA lista, cada uma dizendo de onde veio', () => {
    writeUtils(['normalize-tax-id']);
    snapshot([{
      id: 'com.example.billing',
      name: 'Billing',
      version: '2.1.0',
      active: false,
      exports: [{ id: 'charge', kind: 'workflow', name: 'Charge' }],
    }]);

    const artifacts = referenceableArtifacts(readWorkspaceCatalog(workspace));
    expect(artifacts.map((one) => `${one.ref} ${one.from}`)).toStrictEqual([
      'com.example.utils/normalize-tax-id workspace',
      'com.example.billing/charge installation',
    ]);
    // Desligada não é ausente: o artefato dela continua sendo documento do escritório.
    expect(artifacts[1].disabled).toBe(true);
  });

  it('extensão presente nas duas fontes resolve pela do WORKSPACE, que é a que está sendo editada', () => {
    writeUtils(['normalize-tax-id']);
    snapshot([{
      id: 'com.example.utils',
      name: 'Utils',
      version: '1.0.0',
      active: true,
      exports: [{ id: 'old-name', kind: 'script', name: 'Old name' }],
    }]);

    const artifacts = referenceableArtifacts(readWorkspaceCatalog(workspace));
    expect(artifacts.map((one) => one.ref)).toStrictEqual(['com.example.utils/normalize-tax-id']);
    expect(artifacts[0].from).toBe('workspace');
  });
});

describe('o portão da referência a outra extensão, cobrado fora do escritório', () => {
  afterEach(() => rmSync(join(workspace, INSTALLED_CATALOG_FILE), { force: true }));

  it('a referência que a dona exporta passa, e a resposta diz de onde a resposta veio', () => {
    writeUtils(['normalize-tax-id']);
    const [finding] = consumerFindings('com.example.utils/normalize-tax-id');
    expect(finding.status).toBe('ok');
    expect(finding.detail).toContain('plugin.ts of com.example.utils in this workspace');
  });

  /**
   * A checagem que faltava, e a que mais custa: ela só existia na instalação, e por isso o veredito
   * dela chegava no escritório de quem instala.
   */
  it('o id que a dona NÃO exporta é recusado aqui, com a frase do kernel', () => {
    writeUtils(['normalize-tax-id']);
    const [finding] = consumerFindings('com.example.utils/internal-cache');
    expect(finding.status).toBe('refused');
    // Resolvida, e resolvida com o texto do kernel: uma segunda redação divergiria da que a tela mostra.
    expect(finding.detail).not.toContain('@core.marketplace/');
    expect(finding.detail).toContain('com.example.utils');
  });

  it('a versão da dona fora da faixa declarada também é recusada', () => {
    writeUtils(['normalize-tax-id']);
    snapshot([]);
    writeFileSync(
      join(workspace, 'utils', 'plugin.ts'),
      utilsSource(['normalize-tax-id']).replace("version: '1.4.0'", "version: '3.0.0'"),
    );
    const [finding] = consumerFindings('com.example.utils/normalize-tax-id');
    expect(finding.status).toBe('refused');
    expect(finding.detail).toContain('3.0.0');
  });

  /** Ausência de conhecimento NÃO é ausência da dona: este diretório não é o escritório. */
  it('sem retrato e sem irmã, o veredito é "não dá para conferir daqui" — nunca uma recusa', () => {
    writeUtils(['normalize-tax-id']);
    const [finding] = consumerFindings('com.other.thing/whatever', 'com.other.thing');
    expect(finding.status).toBe('unverifiable');
    expect(finding.detail).toContain('export-catalog');
  });

  /** Com retrato, a ausência PASSA a ser informação: ele lista todas as extensões instaladas. */
  it('dona ausente do retrato: a instalação NAQUELE escritório seria recusada, e a resposta diz qual', () => {
    writeUtils(['normalize-tax-id']);
    snapshot([{ id: 'com.example.billing', name: 'Billing', version: '2.1.0', active: true, exports: [] }]);
    const [finding] = consumerFindings('com.other.thing/whatever', 'com.other.thing');
    expect(finding.status).toBe('absent-there');
    expect(finding.detail).toContain('Escritório Central');
  });

  /**
   * A distinção que o retrato carrega em `exportsKnown`, cobrada no veredito: chave ausente é
   * silêncio de um Console velho, e apresentá-la como "não exporta nada" fabricaria uma recusa.
   */
  it('retrato de um Console sem a superfície não é lido como "esta extensão não exporta nada"', () => {
    writeUtils(['normalize-tax-id']);
    snapshot([{ id: 'com.other.thing', name: 'Thing', version: '1.0.0', active: true }]);
    const [finding] = consumerFindings('com.other.thing/whatever', 'com.other.thing');
    expect(finding.status).toBe('unverifiable');
    expect(finding.detail).toContain('IS installed');
  });
});

describe('o que o servidor MCP responde sobre isso', () => {
  afterEach(() => rmSync(join(workspace, INSTALLED_CATALOG_FILE), { force: true }));

  it('serve a superfície como recurso próprio, com a procedência de cada linha', () => {
    writeUtils(['normalize-tax-id']);
    writeConsumer('com.example.utils/normalize-tax-id');
    const answer = JSON.parse(readMcpResource('microteia://referenceable', workspace)) as {
      total: number;
      referenceable: { ref: string; kind: string; from: string; writtenIn?: string }[];
      catalogSources: { referenceable: string[] };
    };
    expect(answer.total).toBe(1);
    expect(answer.referenceable[0]).toMatchObject({ ref: 'com.example.utils/normalize-tax-id', from: 'workspace' });
    expect(answer.catalogSources.referenceable[0]).toContain('com.example.utils/normalize-tax-id');
  });

  /**
   * O lugar EXATO em que a referência é escrita. Enquanto a lista só viajava nas respostas de modelo
   * de domínio, quem descrevia o passo não a via — e é o passo que guarda o id.
   */
  it('quem pergunta o PASSO recebe o que se pode referenciar naquele input', () => {
    writeUtils(['normalize-tax-id', 'notify-customer']);
    const script = JSON.parse(runMcpTool('describe_workflow_step', { stepDefinitionId: 'script' }, workspace)) as {
      inputs: { id: string; acceptsQualifiedRef?: string; referenceable?: string[] }[];
    };
    const scriptId = script.inputs.find((one) => one.id === 'scriptId');
    expect(scriptId?.acceptsQualifiedRef).toContain('<extension-id>/<source-id>');
    expect(scriptId?.referenceable).toStrictEqual([
      'com.example.utils/normalize-tax-id — Normalize tax id (script, authored here)',
    ]);
    // Só o que CABE ali: a automação da mesma dona não é candidata a `scriptId`.
    expect(scriptId?.referenceable?.join()).not.toContain('notify-customer');
  });

  it('validate_plugin reprova a referência que a instalação reprovaria, e diz qual artefato a escreveu', () => {
    writeUtils(['normalize-tax-id']);
    writeConsumer('com.example.utils/internal-cache');
    const answer = runMcpTool('validate_plugin', { path: join('sales', 'plugin.ts') }, workspace);
    expect(answer).toContain('would NOT install');
    expect(answer).toContain('[refused] com.example.utils/internal-cache');
    expect(answer).toContain('"On save"');
  });

  it('e aprova a que resolve, dizendo contra o que ela foi conferida', () => {
    writeUtils(['normalize-tax-id']);
    writeConsumer('com.example.utils/normalize-tax-id');
    const answer = runMcpTool('validate_plugin', { path: join('sales', 'plugin.ts') }, workspace);
    expect(answer).toContain('none of them refused here');
    expect(answer).toContain('[ok] com.example.utils/normalize-tax-id');
  });
});
