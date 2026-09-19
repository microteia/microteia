import { compareVersions } from './manifest.js';
import type { KernelManifest } from './manifest.js';

/**
 * O catálogo de versões publicadas — a forma do `index.json`, e as regras de quem escreve nele e de quem
 * o lê. Fica em `kernel/` pela mesma razão que o `manifest.ts`: os DOIS lados dependem dele. O `publish`
 * acrescenta uma entrada, o `unpack` resolve uma versão a partir dela, e uma discordância entre os dois
 * seria descoberta na máquina de quem instala.
 *
 * O índice é o único ponto de acoplamento com onde os arquivos estão hospedados. As URLs são DADO dentro
 * dele, absolutas, e nada no Console monta uma: trocar de host — ou passar a emitir URL assinada por
 * escritório — reescreve o índice e não muda comando nenhum que alguém digita. Era o que precisava ser
 * comprado agora, porque o host escolhido não tem caminho próprio para isso.
 */

export const INDEX_SCHEMA = 1;

/**
 * O canal padrão, e por ora o único. Ele existe como nome — e não como "a maior versão da lista" —
 * porque publicar não é promover: uma versão pode estar no índice, com URL e hash, sem ser a que uma
 * instalação recebe ao pedir `latest`.
 */
export const STABLE_CHANNEL = 'stable';

export const LATEST = 'latest';

/**
 * O nome do arquivo, montado do número e não lido da URL. Quem baixa não deriva nome de caminho que veio
 * pela rede — e quem empacota usa o mesmo daqui, para que as duas pontas não possam divergir.
 */
export const kernelTarballName = (version: string): string => `microteia-kernel-${version}.tgz`;

export interface ChannelEntry {
  version: string;
  kernelVersion: string;
  minimumCliVersion: string;
  publishedAt: string;
  bytes: number;
  sha256: string;
  /** URL absoluta do tarball. */
  tarball: string;
  /** URL absoluta da cópia externa do manifesto, para ler pré-requisitos sem baixar 7 MB. */
  manifest: string;
}

export interface ChannelIndex {
  schema: number;
  channels: Record<string, string>;
  kernel: ChannelEntry[];
}

export const emptyIndex = (): ChannelIndex => ({
  schema: INDEX_SCHEMA,
  channels: {},
  kernel: [],
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const REQUIRED_TEXT = ['version', 'kernelVersion', 'minimumCliVersion', 'publishedAt', 'tarball', 'manifest'] as const;

const entryProblems = (value: unknown, where: string): string[] => {
  if (!isRecord(value)) return [`${where} is not an object.`];

  const problems = REQUIRED_TEXT
    .filter((field) => typeof value[field] !== 'string' || value[field] === '')
    .map((field) => `${where} has no ${field}.`);

  for (const field of ['bytes', 'sha256'] as const) {
    const actual = value[field];
    const ok = field === 'bytes' ? typeof actual === 'number' && actual > 0 : typeof actual === 'string';
    if (!ok) problems.push(`${where} has no ${field}, so what it points at could not be verified.`);
  }

  return problems;
};

/**
 * Lê o catálogo RECUSANDO o que não entende, em vez de seguir com campos ausentes.
 *
 * O que ele guarda não é a boa formação do JSON: é a impossibilidade de instalar algo cuja integridade
 * não pode ser conferida. Uma entrada sem `sha256` passaria por uma verificação que não compara nada, e
 * essa é exatamente a forma de o hash não servir para nada.
 *
 * `schema` maior que o desta ferramenta é recusa com o conserto na mão: quem publicou já sabia de algo
 * que este Console não sabe.
 */
export const parseIndex = (text: string, source: string): ChannelIndex => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${source} is not valid JSON, so there is no catalog to read.`);
  }

  if (!isRecord(value)) throw new Error(`${source} does not contain a catalog.`);

  const schema = value.schema;
  if (typeof schema !== 'number') throw new Error(`${source} does not say which schema it uses.`);
  if (schema > INDEX_SCHEMA) {
    throw new Error(
      `${source} uses catalog schema ${schema} and this Console understands ${INDEX_SCHEMA}.\n`
      + 'Update it with "npm i -g @microteia/console".',
    );
  }

  const kernel = value.kernel;
  if (!Array.isArray(kernel)) throw new Error(`${source} lists no kernel versions.`);

  const problems = kernel.flatMap((entry, index) => entryProblems(entry, `${source} entry ${index}`));
  if (problems.length > 0) {
    throw new Error(`The catalog cannot be trusted:\n${problems.map((problem) => `  ${problem}`).join('\n')}`);
  }

  const channels = isRecord(value.channels) ? value.channels : {};

  return {
    schema,
    channels: Object.fromEntries(
      Object.entries(channels).filter(([, version]) => typeof version === 'string'),
    ) as Record<string, string>,
    kernel: kernel as ChannelEntry[],
  };
};

export const serializeIndex = (index: ChannelIndex): string => `${JSON.stringify(index, null, 2)}\n`;

/**
 * A entrada que descreve um pacote, montada do manifesto EXTERNO — o único que carrega o tamanho e o
 * hash do tarball. Um manifesto sem eles é o de dentro do tarball, ou o de um pacote anterior ao canal,
 * e nos dois casos publicar seria publicar algo que ninguém consegue verificar.
 */
export const entryOf = (
  manifest: KernelManifest,
  urls: { tarball: string; manifest: string },
  publishedAt: string,
): ChannelEntry => {
  if (manifest.tarball === undefined) {
    throw new Error(
      'This manifest carries no tarball digest, so the version could not be verified after download.\n'
      + 'Rebuild the package with "npm run pack:kernel".',
    );
  }

  return {
    version: manifest.version,
    kernelVersion: manifest.kernelVersion,
    minimumCliVersion: manifest.minimumCliVersion,
    publishedAt,
    bytes: manifest.tarball.bytes,
    sha256: manifest.tarball.sha256,
    tarball: urls.tarball,
    manifest: urls.manifest,
  };
};

const byVersionDescending = (left: ChannelEntry, right: ChannelEntry): number =>
  compareVersions(right.version, left.version);

/**
 * Acrescenta a entrada e promove o canal, RECUSANDO uma versão que já está lá.
 *
 * Republicar é a origem de "a mesma versão com dois conteúdos", e ela não tem conserto depois: alguém
 * conferiu um hash contra o download de ontem e a partir dali as duas instalações discordam sobre o que
 * `9.8.2` significa. Um número novo custa um minuto.
 */
export const withEntry = (index: ChannelIndex, entry: ChannelEntry): ChannelIndex => {
  if (index.kernel.some((existing) => existing.version === entry.version)) {
    throw new Error(
      `${entry.version} is already published, and a released version is never rewritten.\n`
      + 'Bump the version in package.json and package it again.',
    );
  }

  return {
    schema: INDEX_SCHEMA,
    channels: { ...index.channels, [STABLE_CHANNEL]: entry.version },
    kernel: [entry, ...index.kernel].sort(byVersionDescending),
  };
};

/**
 * A última versão publicada ABAIXO desta — o começo do intervalo que o release novo cobre.
 *
 * É "abaixo desta" e não "o topo do catálogo" porque publicar fora de ordem é possível, e o que o
 * release precisa descrever é o que ele acrescenta a quem já tinha a anterior. Quem já tinha a anterior
 * está na maior versão MENOR que esta.
 *
 * Nada publicado ainda é `undefined`, e não a menor versão do histórico: o arquivo de histórico começa
 * antes do catálogo, e a primeira publicação não descreve o que veio antes dela.
 */
export const publishedBefore = (index: ChannelIndex, version: string): string | undefined =>
  [...index.kernel]
    .sort(byVersionDescending)
    .find((entry) => compareVersions(entry.version, version) < 0)
    ?.version;

/**
 * Resolve o que foi pedido — `latest` ou um número — nomeando o que existe quando não acha.
 *
 * A recusa lista as versões porque a alternativa é a pessoa tentar de novo com outro palpite. Cinco
 * bastam: quem pediu uma versão exata e errou quase sempre errou no patch.
 */
export const resolveVersion = (index: ChannelIndex, requested: string): ChannelEntry => {
  const available = [...index.kernel].sort(byVersionDescending);

  if (requested === LATEST) {
    const promoted = index.channels[STABLE_CHANNEL];
    if (promoted === undefined) {
      throw new Error('The catalog promotes no version to "latest" yet.');
    }
    const entry = available.find((candidate) => candidate.version === promoted);
    if (entry === undefined) {
      throw new Error(`The catalog promotes ${promoted} to "latest", and lists no such version.`);
    }
    return entry;
  }

  const entry = available.find((candidate) => candidate.version === requested);
  if (entry === undefined) {
    const names = available.slice(0, 5).map((candidate) => candidate.version);
    throw new Error(
      `The catalog has no kernel ${requested}.\n`
      + (names.length === 0
        ? 'It lists no versions at all.'
        : `The most recent are ${names.join(', ')} — or use --version latest.`),
    );
  }
  return entry;
};
