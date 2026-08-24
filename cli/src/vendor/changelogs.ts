import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { consoleRoot } from '../shared/paths.js';
import { compareVersions } from '../kernel/manifest.js';

/**
 * O histórico técnico dos DOIS artefatos que o escritório recebe — a plataforma e o Console.
 *
 * Cada um carrega o seu, e essa é a decisão inteira. O `KERNEL-VERSIONS.md` viaja dentro do pacote; o
 * `CONSOLE-VERSIONS.md` viaja com o binário do Console. Enquanto os dois textos saem do artefato que
 * eles descrevem, nenhum dos dois pode falar de uma versão que não está ali — que é exatamente o que
 * acontecia com os guias de `extensions/` enquanto eles moravam no Console.
 *
 * Os dois são ESCRITOS EM INGLÊS, ao contrário do `VERSIONS.md` da raiz do repositório. A regra é a de
 * sempre: o que é entregue a um escritório que pode estar em qualquer lugar é superfície de produto e
 * fala inglês; o que é comunicação nossa continua em português. O `VERSIONS.md` da raiz é para o
 * usuário do escritório e não viaja no pacote; estes dois são o registro do que mudou no código, para
 * quem mantém ou integra uma instalação.
 *
 * **NÃO ficam em `extensions/`.** Aquele diretório é opcional (pode nem existir, e pode ter sido criado
 * com `--dir` em qualquer lugar), é escrito pelo SDK, e já tem um `VERSIONS.md` por extensão dentro
 * dele — um segundo arquivo com o mesmo nome, um nível acima, significando outra coisa. Os dois moram
 * na raiz da instalação, ao lado do `microteia.yaml`, que é onde o `--version` aponta.
 */

export const KERNEL_CHANGELOG = 'KERNEL-VERSIONS.md';
export const CONSOLE_CHANGELOG = 'CONSOLE-VERSIONS.md';

/**
 * O cabeçalho de uma entrada. É o MESMO formato dos outros históricos do produto — o `VERSIONS.md` da
 * raiz e o de cada extensão que o `create` gera —, para que não existam duas convenções para a mesma
 * coisa.
 */
const ENTRY = /^#### \[(\d+\.\d+\.\d+)\] — /gm;

/**
 * O comentário HTML do topo é o MOLDE da entrada nova, e ele mostra um cabeçalho de verdade — é o que faz
 * alguém acertar o formato sem procurar. Por isso ele sai antes da contagem: senão o molde é lido como a
 * entrada mais recente do arquivo, e o histórico inteiro parece fora de ordem.
 */
const withoutTemplates = (contents: string): string => contents.replace(/<!--[\s\S]*?-->/g, '');

export const changelogVersions = (contents: string): string[] =>
  [...withoutTemplates(contents).matchAll(ENTRY)].map((match) => match[1]);

/**
 * O que impede o arquivo de ser confiável, na ordem em que atrapalha.
 *
 * A primeira é a que existe para doer: a versão que está sendo empacotada tem de ser a do TOPO. Sem
 * isso o histórico é opcional na prática, e um histórico opcional para na primeira release apressada
 * — que é justamente a que alguém vai querer ler depois.
 */
export const changelogProblems = (file: string, contents: string, version: string): string[] => {
  const versions = changelogVersions(contents);
  const problems: string[] = [];

  if (versions.length === 0) {
    problems.push(`${file} carries no entry at all. Expected one headed "#### [${version}] — <date>".`);
    return problems;
  }

  if (versions[0] !== version) {
    problems.push(
      versions.includes(version)
        ? `${file} has an entry for ${version}, but ${versions[0]} is on top. The newest goes first.`
        : `${file} has no entry for ${version}, which is the version being packaged. Add one on top.`,
    );
  }

  for (let index = 1; index < versions.length; index += 1) {
    const order = compareVersions(versions[index - 1], versions[index]);
    if (order === 0) problems.push(`${file} lists ${versions[index]} twice.`);
    else if (order < 0) {
      problems.push(`${file} lists ${versions[index - 1]} above ${versions[index]}, and the newest goes first.`);
    }
  }

  return problems;
};

/**
 * Lê o histórico e RECUSA se ele não cobre a versão que está saindo. Usado pelo `pack` e pelo
 * `pack-console`, que são os dois momentos em que ainda dá para escrever a entrada.
 *
 * A recusa é do artefato, não do procedimento — mesma postura do `bundleAudit` e da conferência de
 * reivindicações de backend: o que sai daqui vai para escritórios, e um pacote cujo histórico não
 * menciona a própria versão é um pacote que ninguém consegue datar depois.
 */
export const readChangelog = async (
  directory: string,
  file: string,
  version: string,
): Promise<string> => {
  const contents = await readFile(join(directory, file), 'utf8').catch(() => {
    throw new Error(
      `${join(directory, file)} does not exist, and every packaged version needs its entry there.`,
    );
  });

  const problems = changelogProblems(file, contents, version);
  if (problems.length > 0) {
    throw new Error(
      `The technical changelog does not cover this version:\n${problems.map((problem) => `  ${problem}`).join('\n')}`,
    );
  }

  return contents;
};

/**
 * A entrada de UMA versão, para ser o corpo do release publicado.
 *
 * O texto do release não é escrito à mão em lugar nenhum: ele é o mesmo parágrafo que já foi conferido
 * pelo `pack`, recortado daqui. Dois textos sobre a mesma versão divergem — e o que divergiria é
 * justamente o que fica visível para quem procura o que mudou.
 *
 * Recorta do cabeçalho da versão até o próximo cabeçalho, e não até o fim: o que vem depois é o
 * histórico anterior, e ele já está publicado nos releases dele.
 */
export const changelogEntry = (contents: string, version: string): string => {
  const body = withoutTemplates(contents);
  const headings = [...body.matchAll(ENTRY)];
  const index = headings.findIndex((match) => match[1] === version);

  if (index === -1) {
    throw new Error(`The changelog has no entry for ${version}.`);
  }

  const start = headings[index].index;
  const end = index + 1 < headings.length ? headings[index + 1].index : body.length;
  return `${body.slice(start, end).trim()}\n`;
};

export interface ChangelogRefresh {
  written: string[];
  missing: string[];
}

/**
 * Põe os dois históricos na raiz da instalação, SOBREPONDO — pela mesma razão que o `MICROTEIA.md` é
 * sobreposto: eles prometem estar atuais, e um documento que promete isso não pode ser editável.
 *
 * A falta de um dos dois avisa e não derruba nada. O do kernel falta num pacote anterior a esta
 * capacidade, e trocar de kernel não pode falhar por causa de um documento.
 */
export const refreshChangelogs = async (root: string, install: string): Promise<ChangelogRefresh> => {
  const sources: [string, string][] = [
    [join(install, KERNEL_CHANGELOG), KERNEL_CHANGELOG],
    [join(consoleRoot, CONSOLE_CHANGELOG), CONSOLE_CHANGELOG],
  ];

  const written: string[] = [];
  const missing: string[] = [];

  for (const [from, name] of sources) {
    const contents = await readFile(from, 'utf8').catch(() => null);
    if (contents === null) {
      missing.push(name);
      continue;
    }
    await writeFile(join(root, name), contents);
    written.push(name);
  }

  return { written, missing };
};
