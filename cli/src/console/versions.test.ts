import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLI_VERSION } from '../shared/paths.js';
import { ENVIRONMENT_FILE, serializeEnvironment } from './environment.js';
import type { Environment } from './environment.js';
import { versionReport } from './versions.js';

/**
 * `microteia --version` respondia um número só, e justamente o que quem pergunta quase nunca quer: o da
 * FERRAMENTA. A versão do Console é deliberadamente independente da do kernel — é ela que o
 * `minimumCliVersion` do pacote confere —, então responder só ela manda procurar no `MICROTEIA.md` o que
 * a pergunta já era.
 */
const environment: Environment = {
  project: { name: 'Escritório Ação & Cia' },
  environment: { id: 'acao-cia', name: 'Produção' },
  firebase: { projectId: 'acme-microteia', region: 'southamerica-east1' },
  kernel: { version: '7.47.0', deployed: '7.46.0' },
  backend: { functions: null, parameters: null, indexes: null },
  login: { extensions: null },
};

let root = '';

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'microteia-version-'));
  return async () => { await rm(root, { recursive: true, force: true }); };
});

const install = async (manifest: Record<string, unknown> | null): Promise<void> => {
  await writeFile(join(root, ENVIRONMENT_FILE), serializeEnvironment(environment));
  if (manifest === null) return;
  const dir = join(root, '.microteia', 'install');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest));
};

describe('o que --version responde', () => {
  it('fora de uma instalação, responde só o Console — não há kernel a que se referir', async () => {
    expect(await versionReport(root)).toEqual([`Microteia Console ${CLI_VERSION}`]);
  });

  /**
   * As duas versões do kernel vêm de fontes DIFERENTES de propósito: a que está no lugar é o manifesto
   * do pacote (o artefato), a publicada é o `microteia.yaml` (o registro do que um comando fez). Ler as
   * duas do mesmo lugar seria não poder mostrar que elas divergem — e divergir é o estado normal entre
   * o `unpack` e o `deploy`.
   */
  it('dentro de uma instalação, diz o que está no lugar e o que o projeto roda', async () => {
    await install({ version: '7.47.0', kernelVersion: '4.2.0' });
    const report = (await versionReport(root)).join('\n');

    expect(report).toContain(`Microteia Console ${CLI_VERSION}`);
    expect(report).toContain('Kernel in place   7.47.0');
    expect(report).toContain('Kernel deployed   7.46.0');
    expect(report).toContain('Plugin contract   4.2.0');
    expect(report).toContain('acme-microteia');
    expect(report).toContain('"microteia deploy" publishes it');
  });

  it('a versão no lugar sai do MANIFESTO, que é o artefato, e não do registro', async () => {
    await install({ version: '8.0.0' });
    expect((await versionReport(root)).join('\n')).toContain('Kernel in place   8.0.0');
  });

  it('sem pacote desempacotado, diz o comando que falta em vez de mentir um número', async () => {
    await writeFile(join(root, ENVIRONMENT_FILE), serializeEnvironment({
      ...environment,
      kernel: { version: null, deployed: null },
    }));
    const report = (await versionReport(root)).join('\n');
    expect(report).toContain('microteia unpack --version latest');
    expect(report).toContain('Kernel deployed   none');
  });

  /** É o primeiro comando que se roda quando algo está estranho: ele não pode ser o que falha. */
  it('um microteia.yaml ilegível não derruba a resposta', async () => {
    await writeFile(join(root, ENVIRONMENT_FILE), 'project:\n  isso não é sintaxe que ele leia\n');
    const report = await versionReport(root);
    expect(report[0]).toBe(`Microteia Console ${CLI_VERSION}`);
    expect(report.join('\n')).toContain('could not be read');
  });
});

/**
 * A linha do canal, e por que ela é INJETADA.
 *
 * `--version` é o primeiro comando que se roda quando algo está estranho, e a resposta que se cola num
 * pedido de ajuda. Ele responde sobre a instalação, não sobre a rede: numa máquina sem acesso ao
 * catálogo — ou dentro de um teste — tudo acima da última linha continua sendo a resposta inteira.
 */
describe('quando o canal oferece uma versão mais nova', () => {
  it('sem consulta nenhuma, o relatório é exatamente o que era', async () => {
    await install({ version: '7.47.0' });
    expect((await versionReport(root)).join('\n')).not.toContain('is published');
  });

  it('com uma versão nova publicada, diz o comando que a traz', async () => {
    await install({ version: '7.47.0' });
    const report = await versionReport(root, async () => ({ version: '7.48.0' }));
    expect(report.join('\n')).toContain('Kernel 7.48.0 is published');
    expect(report.join('\n')).toContain('microteia unpack --version latest');
  });

  /** A consulta recebe o que está NO LUGAR, e não o que foi publicado: é dela que a comparação parte. */
  it('a consulta recebe a versão que está em uso', async () => {
    await install({ version: '7.47.0' });
    let asked: string | null = 'não perguntou';
    await versionReport(root, async (version) => { asked = version; return null; });
    expect(asked).toBe('7.47.0');
  });

  /** Uma rede muda não pode mudar a resposta: o `newerThan` devolve `null` e o relatório segue igual. */
  it('e uma consulta sem resposta não acrescenta linha nenhuma', async () => {
    await install({ version: '7.47.0' });
    const report = await versionReport(root, async () => null);
    expect(report.join('\n')).not.toContain('is published');
  });
});
