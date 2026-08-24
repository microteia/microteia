import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { digestMismatch, digestOfFile } from '../shared/digest.js';
import { info, pending, success, warn } from '../shared/ui.js';
import { compareVersions } from '../kernel/manifest.js';
import { LATEST, kernelTarballName, parseIndex, resolveVersion } from '../kernel/channel.js';
import type { ChannelEntry, ChannelIndex } from '../kernel/channel.js';

/**
 * O lado que BAIXA. Uma responsabilidade: transformar "a versão que eu quero" num arquivo local que já
 * foi verificado.
 *
 * Ele é opcional por construção. `microteia unpack --kernel <arquivo>.tgz` continua existindo e continua
 * sendo o caminho de quem está numa rede fechada, ou de quem recebeu o pacote por outro meio — o canal
 * não pode virar pré-requisito para instalar, porque a instalação já depende de coisas demais que não
 * são nossas.
 */

/**
 * A URL do catálogo, e a razão de ela ser NOSSA e não a do host dos arquivos.
 *
 * Os tarballs ficam onde é barato hospedá-los, e as URLs deles são dado dentro do índice. Esta é a única
 * que o Console conhece de cor, e é por isso que ela tem de estar num domínio que responda por si:
 * mudar de hospedagem — ou passar a emitir URL assinada por escritório, que o host de hoje não faz —
 * reescreve o índice, e um Console já instalado continua achando o catálogo no mesmo lugar.
 */
export const DEFAULT_INDEX_URL = 'https://microteia.github.io/releases/kernel/index.json';

export const indexUrl = (): string => {
  const override = process.env.MICROTEIA_INDEX_URL;
  return override === undefined || override === '' ? DEFAULT_INDEX_URL : override;
};

/**
 * O cache fica FORA da instalação, de propósito: `.microteia/` é apagado por inteiro a cada troca de
 * kernel, e um cache ali seria descartado exatamente no momento em que serve para algo (voltar à versão
 * anterior sem baixá-la de novo).
 */
export const cacheRoot = (): string => {
  const override = process.env.MICROTEIA_CACHE;
  return override === undefined || override === ''
    ? join(homedir(), '.microteia', 'cache')
    : override;
};

/** O catálogo é pequeno, e o timeout existe para que uma rede muda não pareça um comando travado. */
const INDEX_TIMEOUT_MS = 15_000;

const fetchText = async (url: string, timeoutMs: number): Promise<string> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status} ${response.statusText}.`);
  }
  return response.text();
};

export const fetchIndex = async (url = indexUrl()): Promise<ChannelIndex> => {
  const text = await fetchText(url, INDEX_TIMEOUT_MS).catch((error: unknown) => {
    throw new Error(
      `Could not read the Microteia catalog at ${url}.\n`
      + `${error instanceof Error ? error.message : String(error)}\n`
      + 'If this machine has no access to it, install from a file: microteia unpack --kernel <package>.tgz',
    );
  });

  return parseIndex(text, url);
};

export interface KernelDownload {
  path: string;
  entry: ChannelEntry;
  /** `true` quando o arquivo já estava no cache e conferiu — o comando não usou a rede para baixá-lo. */
  cached: boolean;
}

const verified = async (path: string, entry: ChannelEntry): Promise<string | null> => {
  const digest = await digestOfFile(path).catch(() => null);
  if (digest === null) return 'it is not there.';
  return digestMismatch({ bytes: entry.bytes, sha256: entry.sha256 }, digest);
};

/**
 * Baixa para um `.part` e só então renomeia.
 *
 * Escrever direto no nome final deixa, numa queda de rede, um arquivo com o nome certo e o conteúdo
 * incompleto — e o `tar` recusa aquilo com uma mensagem sobre formato de arquivo, que manda procurar o
 * defeito no pacote. Um `.part` que sobrou não é confundido com nada.
 */
const download = async (entry: ChannelEntry, target: string): Promise<void> => {
  const part = `${target}.part`;
  await rm(part, { force: true });

  const response = await fetch(entry.tarball);
  if (!response.ok) {
    throw new Error(
      `${entry.tarball} answered ${response.status} ${response.statusText}.\n`
      + 'The catalog points at this file, so either the release was removed or the catalog is ahead of it.',
    );
  }

  // Em memória, e não por stream: o artefato é de um dígito de MB, e o que se ganharia em bytes
  // residentes se pagaria em duas conversões de tipo entre o corpo web e o stream do Node.
  await writeFile(part, Buffer.from(await response.arrayBuffer()));
  await rename(part, target);
};

/**
 * Resolve a versão pedida num arquivo local verificado, reusando o cache quando ele confere.
 *
 * Não há bandeira para ignorar o cache, e é deliberado: a entrada que não confere é apagada e baixada de
 * novo aqui mesmo. Uma bandeira só serviria para quem já desconfia — e quem desconfia é justamente quem
 * não vai lembrar de passá-la.
 */
export const fetchKernel = async (requested: string, url = indexUrl()): Promise<KernelDownload> => {
  const index = await fetchIndex(url);
  const entry = resolveVersion(index, requested);

  const directory = join(cacheRoot(), 'kernel', entry.version);
  const target = join(directory, kernelTarballName(entry.version));
  await mkdir(directory, { recursive: true });

  const stale = await verified(target, entry);
  if (stale === null) {
    success(`kernel ${entry.version} is already in the cache, and it checks out`);
    return { path: target, entry, cached: true };
  }

  pending(`downloading kernel ${entry.version} (${(entry.bytes / 1_000_000).toFixed(1)} MB)`);
  await rm(target, { force: true });
  await download(entry, target);

  const problem = await verified(target, entry);
  if (problem !== null) {
    await rm(target, { force: true });
    throw new Error(
      `What was downloaded is not the kernel ${entry.version} the catalog describes: ${problem}\n`
      + `Source: ${entry.tarball}`,
    );
  }

  success(`downloaded kernel ${entry.version} and verified its sha256`);
  info(`  cached in ${directory}`);
  return { path: target, entry, cached: false };
};

/**
 * A versão mais nova que o canal oferece, ou `null` — e NUNCA uma exceção.
 *
 * Serve ao `--version`, que responde sobre a instalação e não sobre a rede: numa máquina sem acesso ao
 * catálogo, perguntar a versão não pode falhar. O aviso é para o caso de alguém ter apontado
 * `MICROTEIA_INDEX_URL` para um lugar errado e ficar sem entender por que nada é oferecido.
 */
export const newerThan = async (version: string | null): Promise<ChannelEntry | null> => {
  const url = indexUrl();
  const index = await fetchIndex(url).catch((error: unknown) => {
    if (url !== DEFAULT_INDEX_URL) {
      warn(`could not read the catalog at ${url}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
    }
    return null;
  });
  if (index === null) return null;

  const latest = (() => {
    try {
      return resolveVersion(index, LATEST);
    } catch {
      return null;
    }
  })();

  if (latest === null || version === null) return latest;
  // MAIOR, não "diferente": numa máquina de desenvolvimento a versão local costuma estar à frente do
  // que foi publicado, e oferecer um downgrade como se fosse novidade é pior que não dizer nada.
  return compareVersions(latest.version, version) > 0 ? latest : null;
};
