import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../shared/paths.js';
import { CONSOLE_PACKAGE_NAME } from './packageTemplates.js';

/**
 * `publish` é o comando em que já não há como voltar atrás: release é imutável, e o npm também não
 * desfaz. Então o que este teste guarda são as decisões que precisam valer ANTES de a primeira coisa
 * subir — e elas são decisões de ordem e de recusa, cujo efeito real só aparece contra o GitHub e o
 * registry.
 */
const source = (relative: string): string =>
  readFileSync(join(repoRoot, 'cli/src', relative), 'utf8');

const publish = source('vendor/publish.ts');

describe('o que o publish recusa antes de publicar', () => {
  /** O `pack` é que roda o gate de qualidade. Um comando que constrói e publica junto não tem momento
   * para alguém olhar o que saiu. */
  it('não constrói: sem os artefatos no lugar, ele manda rodar o pack', () => {
    expect(publish).toContain('publishing does not build');
    expect(publish).toContain('npm run pack:kernel');
    expect(publish).toContain('npm run pack:console');
    expect(publish).not.toContain("run('npm', ['run', 'verify']");
    expect(publish).not.toContain("run('npm', ['run', 'build']");
  });

  /**
   * O `sha256` é RECALCULADO do arquivo, e não aceito do manifesto ao lado dele. Os dois saem do mesmo
   * `pack`, então em teoria concordam — e é por isso que a conferência é barata: ela pega o caso em que
   * alguém reconstruiu um dos dois e não o outro, que é o único jeito de um pacote publicado divergir do
   * hash que o descreve.
   */
  it('reconfere o hash do tarball contra o manifesto que viaja com ele', () => {
    expect(publish).toContain('digestMismatch(manifest.tarball, await digestOfFile(tarball))');
    expect(publish).toContain('One of the two was rebuilt without the other');
  });

  it('e recusa um pacote sem hash: publicá-lo é publicar o que ninguém verifica depois', () => {
    expect(publish).toContain('manifest.tarball === undefined');
  });

  /** A recusa por versão repetida mora no catálogo, que é quem sabe o que já está lá. */
  it('a versão já publicada é recusada pelo catálogo, não por uma segunda regra aqui', () => {
    expect(publish).toContain('withEntry(published.index');
    expect(source('kernel/channel.ts')).toContain('is already published');
  });

  /** As duas pastas de `distributions/` sobrevivem entre versões, então publicar a de ontem é possível. */
  it('o histórico do Console é conferido aqui de novo, e não só no pack-console', () => {
    expect(publish).toContain('readChangelog(directory, CONSOLE_CHANGELOG, CLI_VERSION)');
  });

  it('e o do kernel também, na versão que está saindo', () => {
    expect(publish).toContain('readChangelog(root, KERNEL_CHANGELOG, version)');
  });
});

/**
 * O corpo do release cobre o INTERVALO desde a última versão publicada, e não só a versão que está
 * saindo.
 *
 * O defeito: a 9.65.0 foi empacotada e não subiu, e o release da 9.66.0 — que CONTÉM a 9.65.0 — não
 * citava uma linha dela. Release é imutável e não há release posterior que volte a contá-las: para quem
 * procura o que mudou, aquelas alterações nunca existiram.
 */
describe('as notas do release cobrem o intervalo', () => {
  it('o corte começa na última versão já publicada, lida do catálogo', () => {
    expect(publish).toContain('publishedBefore(published.index, version)');
    expect(publish).toContain('changelogEntries(changelog, version, since)');
  });

  /** O catálogo é quem sabe o que já subiu, então o recorte só pode acontecer depois de lê-lo. */
  it('e por isso ele acontece depois da leitura do catálogo, não ao ler o pacote', () => {
    const kernel = publish.slice(publish.indexOf('const publishKernel ='));
    expect(kernel.indexOf('await readPublishedIndex(repo)'))
      .toBeLessThan(kernel.indexOf('changelogEntries(changelog'));
    expect(source('vendor/publish.ts')).not.toContain('changelogEntry(');
  });

  /** Quem publica vê quais versões o release está descrevendo — inclusive no dry-run. */
  it('e o comando diz quais versões as notas carregam', () => {
    expect(publish).toContain('notes.versions.length === 1');
    expect(publish).toContain('every entry since');
    expect(publish.indexOf('release notes:')).toBeLessThan(publish.indexOf('if (dryRun) {'));
  });
});

/**
 * A ordem que importa, e a razão dela: um índice que aponta para um arquivo que não subiu quebra a
 * instalação de todo mundo que pedir `latest`; um arquivo que subiu e que o índice ainda não menciona
 * não quebra nada — ninguém o encontra até a publicação terminar.
 */
describe('artefatos primeiro, catálogo depois', () => {
  const at = (needle: string): number => {
    const index = publish.indexOf(needle);
    expect(index, `${needle} deveria estar no publish`).toBeGreaterThan(-1);
    return index;
  };

  // Recortado no `publishKernel`: o release do repositório-FONTE também é um `release create`, e vem
  // antes no arquivo — buscar no módulo inteiro tornaria esta conferência verdadeira por acaso.
  it('o release é criado antes de o catálogo ser escrito', () => {
    const kernel = publish.slice(at('const publishKernel ='), at('const publishedConsoleVersion'));
    expect(kernel.indexOf("'release', 'create'")).toBeGreaterThan(-1);
    expect(kernel.indexOf("'release', 'create'")).toBeLessThan(kernel.indexOf('await writePublishedIndex('));
  });

  /**
   * O estado que a ordem produz quando algo falha no meio: o release existe e o catálogo não o menciona.
   * Recusar ali deixaria como única saída apagar o release à mão — então ele retoma.
   */
  it('e uma publicação interrompida é retomada, não recusada', () => {
    expect(publish).toContain('completing the interrupted publish');
    expect(publish).toContain("'--clobber'");
  });

  /**
   * O 502 do GitHub no meio do `gh release create` deixou um RASCUNHO, e a retomada subia os arquivos
   * e escrevia o catálogo sem publicá-lo: `latest` apontava para um download que só quem publicou
   * conseguia fazer.
   */
  it('a retomada publica o rascunho que a interrupção deixou, antes do catálogo', () => {
    expect(at("'--draft=false'")).toBeGreaterThan(at("'--clobber'"));
    expect(at("'--draft=false'")).toBeLessThan(at('await writePublishedIndex('));
  });

  /**
   * O catálogo é lido pela API de conteúdo do repositório, e não pela URL pública que o Pages serve: o
   * Pages responde de um cache que pode estar minutos atrás, e publicar contra ele perderia a entrada de
   * quem publicou antes.
   */
  it('o catálogo publicado é lido do repositório, não do cache que o serve', () => {
    expect(publish).toContain('repos/${repo}/contents/${INDEX_PATH}');
    expect(publish).not.toContain('dist.microteia');
  });

  /**
   * Primeira publicação: o arquivo ainda não existe, e isso não é erro. Mas um 404 tem DUAS causas que
   * pedem coisas opostas — o catálogo faltando (siga) e o repositório faltando (pare) —, e elas não se
   * distinguem por texto: a API diz "Not Found" quando falta o arquivo e "This repository is empty"
   * quando não há commit nenhum, que é justamente o estado de um repo recém-criado. A primeira versão
   * disto procurava "Not Found" e recusava a primeira publicação de verdade.
   */
  it('a ausência do catálogo é a primeira versão, e não uma falha', () => {
    expect(publish).toContain('this is the first published version');
    expect(publish).toContain('emptyIndex()');
    expect(publish).toContain("detail.includes('HTTP 404')");
    expect(publish).not.toContain("includes('Not Found')");
  });

  /** E quem distingue as duas causas é uma pergunta sobre o repositório, não uma leitura de texto. */
  it('e um repositório inexistente recusa, em vez de virar "primeira versão"', () => {
    expect(publish).toContain('could not be read');
    expect(publish).toContain('Check the name, and that "gh auth status"');
  });

  /**
   * Um repositório de releases recém-criado não tem commit, e o GitHub recusa criar release ou tag ali
   * com `422 Repository is empty` — depois de o pacote já ter sido conferido, que é o pior momento para
   * descobrir. Semear é uma escrita que o comando ia fazer de qualquer forma três passos adiante.
   */
  it('um repositório sem commit é semeado antes, porque release exige commit', () => {
    expect(publish).toContain('const seedRepository');
    expect(publish).toContain('has no commits yet');
    const kernel = publish.slice(publish.indexOf('const publishKernel ='));
    expect(kernel.indexOf('await seedRepository(repo)'))
      .toBeLessThan(kernel.indexOf("'release', 'create'"));
  });

  it('e a semente traz o README que o repositório precisa ter, com o link da documentação', () => {
    expect(publish).toContain('const releasesReadme');
    expect(publish).toContain('No source lives here');
    expect(publish).toContain('https://doc.microteia.com');
  });

  /**
   * Escrito só ao semear, o README congelava no texto do primeiro `publish`: o link da documentação
   * oficial nunca chegaria ao repositório que já existia. Ele é regravado quando diverge — depois do
   * catálogo, e sem derrubar a publicação, porque um release no ar não pode parecer desfeito por ele.
   */
  it('um README divergente é regravado depois do catálogo, e a falha só avisa', () => {
    const kernel = publish.slice(publish.indexOf('const publishKernel ='), publish.indexOf('const publishedConsoleVersion'));
    expect(kernel).toContain('await staleReadme(repo)');
    expect(kernel.indexOf('await writePublishedIndex(')).toBeLessThan(kernel.indexOf('await writeReadme(repo, readme.sha'));
    expect(kernel).toContain('could not be rewritten');
  });
});

describe('o que o dry-run faz e o que ele não faz', () => {
  /**
   * Ele LÊ o catálogo — é como se descobre que a versão já está publicada antes de criar release
   * nenhum —, e não escreve nada. "Sem tocar em rede" seria um dry-run que não sabe dizer o que
   * aconteceria.
   */
  it('lê o estado publicado e não escreve nada', () => {
    const kernel = publish.slice(publish.indexOf('const publishKernel ='), publish.indexOf('const publishedConsoleVersion'));
    expect(kernel.indexOf('await readPublishedIndex(repo)')).toBeLessThan(kernel.indexOf('if (dryRun)'));
    expect(kernel.indexOf('if (dryRun)')).toBeLessThan(kernel.indexOf("'release', 'create'"));
    expect(kernel.indexOf('if (dryRun)')).toBeLessThan(kernel.indexOf('await writePublishedIndex('));
  });

  it('e o do Console para antes do npm publish', () => {
    const console_ = publish.slice(publish.indexOf('const publishConsole ='), publish.indexOf('export const publish ='));
    expect(console_.indexOf('if (dryRun)')).toBeLessThan(console_.indexOf("await run('npm', args"));
  });

  it('a versão do Console que já está no registry é pulada, e não republicada', () => {
    expect(publish).toContain('already on the registry');
  });
});

describe('onde os artefatos vão', () => {
  /**
   * O repositório dos releases é SÓ de releases. Os artefatos são compilados, mas o repositório que os
   * hospeda é público, e a distância entre "público" e "fonte pública" tem de ser estrutural — não uma
   * configuração que alguém pode errar.
   */
  it('o repositório de releases é separado, e nomeado num lugar só', () => {
    expect(publish).toContain("RELEASES_REPO = 'microteia/releases'");
    expect(publish.match(/microteia\/releases/g)).toHaveLength(1);
  });

  it('a tag diz de que artefato ela é: o Console tem canal próprio', () => {
    expect(publish).toContain('`kernel-${version}`');
    // O nome do pacote npm vem do módulo que o GERA, para os dois não poderem divergir.
    expect(publish).toContain('CONSOLE_PACKAGE_NAME');
    expect(publish).not.toContain(`'${CONSOLE_PACKAGE_NAME}'`);
  });

  /**
   * As URLs do tarball e do manifesto são montadas aqui e gravadas no catálogo como DADO. É o que faz
   * trocar de hospedagem — ou passar a emitir URL assinada por escritório — reescrever o índice sem
   * mudar comando nenhum que alguém digita.
   */
  it('e as URLs entram no catálogo como dado, não são montadas por quem lê', () => {
    expect(publish).toContain('const assetUrl =');
    expect(source('console/channel.ts')).not.toContain('releases/download');
  });
});

/**
 * A tag `kernel-<versão>` também vai para o repositório-FONTE, no commit de que o pacote saiu. É
 * registro — responde de que código veio cada kernel, e preenche a seção Releases dele —, e por isso
 * nada nela pode recusar nem desfazer uma publicação.
 */
describe('o release no repositório-fonte', () => {
  const kernel = publish.slice(publish.indexOf('const publishKernel ='), publish.indexOf('const publishedConsoleVersion'));
  const pack = source('vendor/pack.ts');

  it('o pack lê o commit antes do gate e dos builds, que deixam arquivos na árvore', () => {
    expect(pack.indexOf('await sourceOf(root)')).toBeGreaterThan(-1);
    expect(pack.indexOf('await sourceOf(root)')).toBeLessThan(pack.indexOf("['run', 'verify']"));
    expect(pack).toContain("['status', '--porcelain']");
  });

  it('marca o commit que o pack registrou, e nenhum quando a árvore estava suja', () => {
    expect(publish).toContain("'--target', target.commit");
    expect(publish).toContain('manifest.source.dirty');
  });

  it('é criado depois do catálogo, e a falha só avisa', () => {
    expect(kernel.indexOf('await writePublishedIndex(')).toBeLessThan(kernel.indexOf('await createSourceRelease('));
    expect(kernel).toContain('could not be created in');
  });

  it('o dry-run diz o que marcaria, e não marca', () => {
    expect(kernel.indexOf('sourceReleaseBlocker(manifest)')).toBeLessThan(kernel.indexOf('if (dryRun)'));
    expect(kernel.indexOf('if (dryRun)')).toBeLessThan(kernel.indexOf('await createSourceRelease('));
  });

  /** O repositório é o do checkout de que o `pack` leu o commit — escrever o nome seria uma segunda fonte. */
  it('o repositório-fonte vem do checkout, não de um nome escrito aqui', () => {
    expect(publish).toContain("'repo', 'view', '--json', 'nameWithOwner'");
    expect(publish).not.toContain("'microteia/microteia'");
  });

  /**
   * Conferido só no fim, um commit que não subiu deixava o kernel no ar e a tag por fazer à mão — e
   * rodar o `publish` de novo não consertava, porque o catálogo já recusa a versão publicada. Recusado
   * antes de qualquer envio, o mesmo comando funciona depois do `git push`.
   */
  it('um commit que não subiu recusa ANTES de qualquer envio, mandando dar push', () => {
    expect(publish).toContain('is not on GitHub yet');
    expect(publish).toContain('Push it first');
    expect(kernel.indexOf('await assertSourcePushed(')).toBeGreaterThan(-1);
    expect(kernel.indexOf('await assertSourcePushed(')).toBeLessThan(kernel.indexOf('if (dryRun)'));
    expect(kernel.indexOf('await assertSourcePushed(')).toBeLessThan(kernel.indexOf('await seedRepository('));
    expect(kernel.indexOf('await assertSourcePushed(')).toBeLessThan(kernel.indexOf("'release', 'create'"));
  });

  /** Só o "GitHub não conhece este commit" manda dar push; rede ou credencial é dita como é. */
  it('e só manda dar push quando o GitHub diz que não conhece o commit', () => {
    expect(publish).toContain("detail.includes('HTTP 422')");
    expect(publish).toContain('Could not check whether commit');
  });

  it('o pack avisa já na montagem, pelas referências remotas locais', () => {
    expect(pack).toContain("['branch', '-r', '--contains', source.commit]");
    expect(pack).toContain('will refuse until it is');
  });
});

/** Ele viaja no Console publicado, e recusa fora do checkout — como o `pack` e o `pack-console`. */
describe('de quem é o comando', () => {
  it('é de publicador, e recusa fora do repositório', () => {
    expect(publish).toContain("assertInsideRepository('publish')");
    const index = source('index.ts');
    expect(index).toContain("name: 'publish'");
    expect(index.slice(index.indexOf("name: 'publish'"))).toContain("audience: 'publisher'");
  });
});

/**
 * As duas metades são independentes de propósito: o kernel vai para releases e o Console para o npm, e
 * eles têm versões, históricos e ferramentas diferentes. Publicar um não pode exigir o que só o outro
 * precisa.
 */
describe('as duas metades e o que cada uma exige', () => {
  it('a falta do gh recusa com o conserto na mão, e não com um spawn ENOENT', () => {
    expect(publish).toContain('const assertGitHubCli');
    expect(publish).toContain('gh auth login');
    expect(publish).toContain('--console-only');
  });

  /** E ela é a PRIMEIRA coisa do lado do kernel: descobrir depois de conferir 7 MB não adianta nada. */
  it('e a conferência da ferramenta vem antes da do pacote', () => {
    const kernel = publish.slice(publish.indexOf('const publishKernel ='));
    expect(kernel.indexOf('await assertGitHubCli()'))
      .toBeLessThan(kernel.indexOf('await readKernelPackage('));
  });

  it('o cabeçalho diz o que está sendo publicado, e não os dois sempre', () => {
    expect(publish).toContain('const what = consoleOnly');
    expect(publish).toContain('heading(dryRun ?');
  });

  it('as duas bandeiras juntas recusam: elas se anulam', () => {
    expect(publish).toContain('--kernel-only and --console-only cannot both be given');
  });
});

/**
 * O npm exige 2FA para publicar, e o comando não passava o código — ele chamava `npm publish`, o
 * registry respondia 403, e a única saída era rodar o `npm` à mão, pulando a conferência de histórico
 * que este comando existe para fazer. Foi assim que a primeira publicação falhou.
 */
describe('a autenticação de dois fatores do npm', () => {
  it('o código atravessa o comando, em vez de obrigar a contornar o comando', () => {
    expect(publish).toContain("flagValue(args, 'otp')");
    expect(publish).toContain("['publish', `--otp=${otp}`]");
  });

  /**
   * A nota é impressa em TODA falha do `npm publish`, e não só quando a mensagem do erro fala em 2FA.
   * A primeira versão procurava "2fa" no texto do erro — e o texto do erro é "Command failed (exit 1):
   * npm publish", porque a saída do npm vai para o terminal e não para cá. A ajuda nunca apareceu.
   */
  it('a recusa diz as duas saídas, e não depende de ler a mensagem do npm', () => {
    expect(publish).toContain('bypass 2FA');
    expect(publish).toContain('is not accepted for publishing');
    expect(publish).not.toMatch(/test\(detail\)|\/two-factor\|2fa/);
  });

  /** E ela não AFIRMA a causa: o erro do npm está na tela logo acima, e é ele que a diz. */
  it('e não afirma a causa, porque ela não pode ser lida daqui', () => {
    expect(publish).toContain('says which is missing');
  });

  it('o código NÃO tem valor padrão nem é lido do ambiente: ele é de quem publica', () => {
    expect(publish).not.toContain('NPM_OTP');
    expect(publish).not.toContain("otp ?? '");
  });
});
