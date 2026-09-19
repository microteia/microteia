import { describe, expect, it } from 'vitest';
import {
  INDEX_SCHEMA,
  LATEST,
  emptyIndex,
  entryOf,
  kernelTarballName,
  parseIndex,
  publishedBefore,
  resolveVersion,
  serializeIndex,
  withEntry,
} from './channel.js';
import type { ChannelEntry } from './channel.js';
import type { KernelManifest } from './manifest.js';

/**
 * O catálogo é a única coisa que o escritório lê antes de baixar 7 MB, e é a única parte da distribuição
 * que os DOIS lados escrevem — o `publish` acrescenta, o `unpack` resolve. Uma discordância entre eles
 * seria descoberta na máquina de quem instala, então ela é decidida aqui.
 */
const entry = (version: string, overrides: Partial<ChannelEntry> = {}): ChannelEntry => ({
  version,
  kernelVersion: '2.2.0',
  minimumCliVersion: '2.1.0',
  publishedAt: '2026-08-24T00:00:00.000Z',
  bytes: 7_000_000,
  sha256: 'a'.repeat(64),
  tarball: `https://example.test/${version}/${kernelTarballName(version)}`,
  manifest: `https://example.test/${version}/manifest.json`,
  ...overrides,
});

const catalog = (versions: string[], stable?: string): string => serializeIndex({
  schema: INDEX_SCHEMA,
  channels: stable === undefined ? {} : { stable },
  kernel: versions.map((version) => entry(version)),
});

describe('o que o catálogo recusa ler', () => {
  it('um JSON quebrado recusa dizendo que não há catálogo, não estourando o parser', () => {
    expect(() => parseIndex('{ nope', 'x')).toThrow(/not valid JSON/);
  });

  /**
   * A recusa que existe para doer. Uma entrada sem `sha256` passaria por uma verificação que não compara
   * nada — que é exatamente a forma de o hash não servir para nada —, e o pacote seria instalado sem que
   * ninguém soubesse que ele não foi conferido.
   */
  it('uma entrada sem sha256 ou sem bytes recusa: ela não poderia ser verificada', () => {
    for (const missing of ['sha256', 'bytes'] as const) {
      const broken = { ...entry('9.8.2') };
      delete (broken as Record<string, unknown>)[missing];
      const text = serializeIndex({ schema: 1, channels: {}, kernel: [broken as ChannelEntry] });
      expect(() => parseIndex(text, 'x'), missing).toThrow(/could not be verified/);
    }
  });

  it('uma entrada sem URL recusa nomeando o campo que falta', () => {
    const broken = { ...entry('9.8.2'), tarball: '' };
    const text = serializeIndex({ schema: 1, channels: {}, kernel: [broken] });
    expect(() => parseIndex(text, 'x')).toThrow(/has no tarball/);
  });

  /** A porta de compatibilidade para frente: quem publicou já sabia de algo que este Console não sabe. */
  it('um esquema mais novo recusa com o conserto na mão, em vez de adivinhar', () => {
    const text = serializeIndex({ schema: INDEX_SCHEMA + 1, channels: {}, kernel: [] });
    expect(() => parseIndex(text, 'x')).toThrow(/npm i -g @microteia\/console/);
  });

  it('e o que está bem formado volta com as versões e os canais', () => {
    const index = parseIndex(catalog(['9.8.2', '9.8.1'], '9.8.2'), 'x');
    expect(index.kernel.map((candidate) => candidate.version)).toEqual(['9.8.2', '9.8.1']);
    expect(index.channels.stable).toBe('9.8.2');
  });
});

describe('resolver a versão pedida', () => {
  const index = parseIndex(catalog(['9.8.2', '9.8.1', '9.7.0'], '9.8.1'), 'x');

  /**
   * `latest` é o canal, e não "a maior da lista". Publicar não é promover: uma versão pode estar no
   * catálogo, com URL e hash, sem ser a que uma instalação recebe ao pedir `latest` — que é o que
   * permite publicar antes de decidir.
   */
  it('latest é o canal promovido, não o maior número da lista', () => {
    expect(resolveVersion(index, LATEST).version).toBe('9.8.1');
  });

  it('um número exato resolve na entrada dele', () => {
    expect(resolveVersion(index, '9.7.0').version).toBe('9.7.0');
  });

  /** A alternativa é a pessoa tentar de novo com outro palpite. */
  it('uma versão que não existe recusa NOMEANDO as que existem', () => {
    expect(() => resolveVersion(index, '9.7.1')).toThrow(/9\.8\.2, 9\.8\.1, 9\.7\.0/);
  });

  it('sem canal promovido, latest diz isso em vez de escolher por conta', () => {
    expect(() => resolveVersion(parseIndex(catalog(['9.8.2']), 'x'), LATEST))
      .toThrow(/promotes no version/);
  });
});

describe('acrescentar uma versão ao catálogo', () => {
  it('promove o canal e mantém a lista em ordem decrescente', () => {
    const next = withEntry(parseIndex(catalog(['9.7.0'], '9.7.0'), 'x'), entry('9.8.2'));
    expect(next.kernel.map((candidate) => candidate.version)).toEqual(['9.8.2', '9.7.0']);
    expect(next.channels.stable).toBe('9.8.2');
  });

  it('e o número menor entra na posição dele, sem virar o canal errado', () => {
    const next = withEntry(parseIndex(catalog(['9.8.2'], '9.8.2'), 'x'), entry('9.7.9'));
    expect(next.kernel.map((candidate) => candidate.version)).toEqual(['9.8.2', '9.7.9']);
  });

  /**
   * Republicar não tem conserto depois: alguém conferiu um hash contra o download de ontem, e a partir
   * dali duas instalações discordam sobre o que `9.8.2` significa. Um número novo custa um minuto.
   */
  it('recusa uma versão que já está publicada', () => {
    expect(() => withEntry(parseIndex(catalog(['9.8.2'], '9.8.2'), 'x'), entry('9.8.2')))
      .toThrow(/already published/);
  });

  it('o primeiro publish parte de um catálogo vazio', () => {
    expect(withEntry(emptyIndex(), entry('1.0.0')).kernel).toHaveLength(1);
  });
});

describe('a entrada montada a partir do manifesto', () => {
  const manifest = (tarball?: { name: string; bytes: number; sha256: string }): KernelManifest => ({
    id: 'com.microteia.kernel',
    name: 'Microteia Kernel',
    version: '9.8.2',
    kernelVersion: '2.2.0',
    minimumCliVersion: '2.1.0',
    packagedAt: '2026-08-24T00:00:00.000Z',
    components: [],
    requires: { functionsRegion: 'southamerica-east1', nodeVersion: '22' },
    functions: [],
    baselineFunctions: [],
    baselineIndexes: [],
    backendParameters: [],
    manualPrerequisites: [],
    tarball,
  });

  const urls = { tarball: 'https://example.test/a.tgz', manifest: 'https://example.test/manifest.json' };

  it('carrega o hash do manifesto EXTERNO, que é o único que o tem', () => {
    const built = entryOf(manifest({ name: 'a.tgz', bytes: 7, sha256: 'b'.repeat(64) }), urls, 'now');
    expect(built.sha256).toBe('b'.repeat(64));
    expect(built.bytes).toBe(7);
    expect(built.tarball).toBe(urls.tarball);
  });

  /**
   * Um manifesto sem hash é o de DENTRO do tarball (ele não pode descrever o arquivo que o contém), ou
   * o de um pacote anterior ao canal. Publicar qualquer um dos dois é publicar algo que ninguém consegue
   * verificar depois de baixar.
   */
  it('e recusa o manifesto que não tem hash, mandando reconstruir o pacote', () => {
    expect(() => entryOf(manifest(undefined), urls, 'now')).toThrow(/npm run pack:kernel/);
  });
});

/** O nome sai do NÚMERO, e não da URL: quem baixa não deriva caminho de arquivo do que veio pela rede. */
describe('o nome do arquivo', () => {
  it('é montado da versão, e é o mesmo que o pack escreve', () => {
    expect(kernelTarballName('9.8.2')).toBe('microteia-kernel-9.8.2.tgz');
  });
});

/**
 * O release de uma versão descreve o que ela acrescenta a quem tinha a anterior — e a anterior é a maior
 * versão PUBLICADA abaixo dela, que não é necessariamente a versão de número imediatamente anterior:
 * entre as duas pode haver versões empacotadas e nunca publicadas.
 */
describe('a última versão publicada abaixo de uma', () => {
  const index = (versions: string[]) => ({
    schema: INDEX_SCHEMA,
    channels: {},
    kernel: versions.map((version) => entry(version)),
  });

  it('pula o que foi empacotado e nunca subiu', () => {
    expect(publishedBefore(index(['9.64.0', '9.60.0']), '9.66.0')).toBe('9.64.0');
  });

  /** Publicar fora de ordem é possível, e o topo do catálogo não é o que esta versão sucede. */
  it('é a maior ABAIXO desta, e não o topo do catálogo', () => {
    expect(publishedBefore(index(['9.70.0', '9.64.0']), '9.66.0')).toBe('9.64.0');
  });

  it('e um catálogo vazio não tem anterior nenhuma', () => {
    expect(publishedBefore(emptyIndex(), '9.66.0')).toBeUndefined();
  });
});
