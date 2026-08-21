import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../shared/paths.js';
import { compareVersions } from '../kernel/manifest.js';

/**
 * `unpack` e `deploy` são comandos separados, e a separação é o contrato — não uma organização interna.
 *
 * Juntos, custavam duas coisas. Trocar de kernel obrigava a publicar TUDO: quem quisesse só o hosting,
 * porque functions, rules e índices não mudaram naquela versão, não tinha como pedir — o `--only` vinha
 * depois da troca do pacote, no mesmo comando. E não existia momento entre "o pacote chegou" e "o pacote
 * foi publicado" para preencher a configuração que o pacote DECLARA, que é justamente quando se
 * descobre que há um parâmetro novo.
 *
 * O teste lê a fonte porque o que ele guarda é a fronteira: quem extrai, quem publica, e o fato de o
 * `deploy` não aceitar mais um tarball.
 */
const source = (relative: string): string =>
  readFileSync(join(repoRoot, 'cli/src', relative), 'utf8');

const unpack = source('console/unpack.ts');

describe('a fronteira entre unpack e deploy', () => {
  const deploy = source('console/deploy.ts');
  const index = source('index.ts');

  it('só o unpack extrai o tarball', () => {
    expect(unpack).toContain("'tar', ['-xzf'");
    expect(deploy).not.toContain('-xzf');
  });

  it('só o unpack apaga o install — o deploy publica o que encontra', () => {
    expect(unpack).toContain('await rm(install');
    expect(deploy).not.toContain('await rm(install');
  });

  it('o deploy não aceita mais --kernel: o pacote chega pelo unpack', () => {
    expect(deploy).not.toContain("requiredFlag(args, 'kernel')");
    expect(unpack).toContain("requiredFlag(args, 'kernel')");
    expect(index).toContain('microteia unpack --kernel');
    expect(index).not.toContain('microteia deploy --kernel');
  });

  it('o unpack não toca no Firebase — é seguro rodar a qualquer momento', () => {
    expect(unpack).not.toContain('FIREBASE_BIN');
    expect(unpack).not.toContain('firebase deploy');
  });

  /**
   * A lista de exceção do `rm` encolheu, e isso é o objetivo. Sobrou só `node_modules`, que é CACHE — o
   * que evita reinstalar ~250 pacotes a cada upgrade. Tudo o que uma pessoa escreve vive fora de
   * `.microteia/`: `functions/`, `extensions/` e `.env.<projectId>`, ao lado do `microteia.yaml`. Uma
   * exceção a menos aqui é uma coisa a menos que depende de alguém não mexer nela.
   */
  it('preserva apenas o cache — nada do escritório mora dentro de .microteia', () => {
    expect(unpack).toContain("PRESERVED = ['functions/node_modules']");
    expect(unpack).not.toContain("'functions/custom'");
  });

  /** `custom/src` é DERIVADO: montado no deploy a partir das fontes de fora. */
  it('as functions do escritório são montadas no deploy, das fontes de fora', () => {
    expect(deploy).toContain('gatherCustomFunctions');
    expect(source('console/customFunctions.ts')).toContain("join(install, 'functions', 'custom', 'src')");
  });

  it('o deploy e o provision descobrem o pacote pela MESMA porta', () => {
    for (const [name, text] of [['deploy', deploy], ['provision', source('console/provision.ts')]] as const) {
      expect(text, name).toContain('readInstalledManifest');
      expect(text, name).not.toContain("join(install, 'manifest.json')");
    }
  });

  it('quem publicar sem ter desempacotado recebe o comando que falta, não um ENOENT', () => {
    expect(unpack).toContain('microteia unpack --kernel <package>.tgz');
  });

  /** A configuração é lida da RAIZ nos dois caminhos que a usam. */
  it('a fonte da configuração é a raiz, nunca a cópia dentro de install', () => {
    expect(source('console/backendParameters.ts')).toContain('join(root, `.env.${projectId}`)');
    expect(source('console/backendParameters.ts')).not.toContain("join(install, 'functions'");
  });

  /** A cópia tem de ser reescrita ANTES de qualquer deploy de function, nos dois comandos que fazem isso. */
  it('a cópia é atualizada antes de o deploy e o provision subirem functions', () => {
    expect(deploy).toContain('stageOfficeEnv');
    expect(source('console/provision.ts')).toContain('stageOfficeEnv');
  });

  /**
   * O Console tem versão PRÓPRIA, e ela é o que o `minimumCliVersion` do pacote confere. Ficou em
   * `1.0.0` enquanto o `deploy` perdia o `--kernel` e a configuração mudava de lugar — um Console
   * anterior teria gravado a credencial exatamente onde o upgrade a apaga, e nada o recusaria.
   *
   * Os dois números NÃO são o mesmo número, e exigir igualdade aqui era o erro: toda alteração do
   * Console move o `CLI_VERSION`, e a maioria delas não faz pacote nenhum passar a depender de nada.
   * O `MINIMUM_CLI_VERSION` se move só quando o PACOTE passa a exigir algo que o Console faz — foi o
   * caso da configuração de backend na raiz (`2.0.0`) e o das Cloud Functions do escritório (`2.1.0`):
   * um Console anterior a este último monta a function da extensão dentro do pacote e nunca a deploya,
   * deixando a extensão "Backend pendente" para sempre com a mensagem apontando para o lugar errado.
   *
   * O que tem de valer sempre é a ORDEM: um Console que exigisse de si mesmo uma versão maior do que
   * a sua recusaria o próprio pacote que acabou de montar.
   */
  it('o Console nunca exige de si mesmo uma versão maior do que a sua', () => {
    const consoleVersion = /CLI_VERSION = '([^']+)'/.exec(source('shared/paths.ts'))?.[1];
    const required = /MINIMUM_CLI_VERSION = '([^']+)'/.exec(source('kernel/manifest.ts'))?.[1];

    expect(required).toBe('2.1.0');
    expect(compareVersions(consoleVersion ?? '0.0.0', required ?? '0.0.0')).toBeGreaterThanOrEqual(0);
  });

  /**
   * O caminho do arquivo de configuração NÃO é escrito por extensão nenhuma. O texto do pré-requisito de
   * `com.microteia.push` dizia `functions/.env.<projectId>` — o caminho de dentro de `install/` — e ficou
   * errado quando a configuração se mudou para a raiz. Quem conhece o layout é o Console.
   */
  it('nenhuma extensão nomeia o arquivo de configuração; o Console o imprime resolvido', () => {
    const templates = import.meta.glob('/extension-templates/*.json', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;

    const offenders = Object.entries(templates)
      .filter(([, json]) => /functions\/\.env|\.microteia\//.test(json))
      .map(([path]) => path);
    expect(offenders, 'deixe o caminho para o Console').toEqual([]);

    expect(source('console/provision.ts')).toContain('Backend settings go in ${officeEnvPath(');
  });
});

/**
 * As Cloud Functions do escritório eram montadas e esquecidas.
 *
 * O `gatherCustomFunctions` copiava `extensions/<plugin>/functions/` para dentro do pacote e o
 * `predeploy` as compilava — e então o deploy mandava ao `firebase` apenas os nomes da BASELINE. O
 * `provision`, que é quem deveria subir as de extensão, conferia a reivindicação contra
 * `manifest.functions` (só o que o pacote exporta) e rejeitava a extensão inteira com "this kernel
 * package does not contain" — recusando exatamente o pacote que o `microteia-plugin create function`
 * gera, que declara a própria function em `manifest.backend.functions`.
 *
 * O teste lê a fonte porque o que ele guarda é a decisão de QUAIS nomes cada comando envia: o efeito
 * real só aparece contra um projeto Firebase.
 */
describe('as functions que o escritório escreve chegam ao deploy', () => {
  const deploy = source('console/deploy.ts');
  const provision = source('console/provision.ts');

  it('o deploy sobe a baseline MAIS as comuns, não só a baseline', () => {
    expect(deploy).toContain('const own = [...baseline, ...gathered.shared];');
    expect(deploy).toContain('deployFunctionsOneByOne(own');
    expect(deploy).not.toContain('deployFunctionsOneByOne(baseline');
  });

  it('o provision confere e escolhe contra o pacote MAIS o que o escritório escreveu', () => {
    expect(provision).toContain('const deployable = [...manifest.functions, ...office.all];');
    expect(provision).toContain('functionClaimProblems(claims, deployable)');
    expect(provision).toContain('deployable.filter(');
    expect(provision).not.toContain('functionClaimProblems(claims, manifest.functions)');
  });

  /**
   * O `provision` roda sozinho depois de alguém instalar uma extensão pela aplicação, e nesse caminho
   * ninguém passou pelo `deploy` que monta as fontes. Sem remontar, ele deployaria a montagem anterior.
   */
  it('o provision remonta as fontes quando alguma delas está na fila', () => {
    expect(provision).toContain('gatherCustomFunctions');
  });

  /** Sem ela, a aplicação abre e a chamada falha no navegador parecendo erro de CORS. */
  it('a callable do escritório entra na mesma conferência de alcance que a do kernel', () => {
    expect(deploy).toContain('...gathered.callables');
    expect(provision).toContain('...office.callables');
  });

  /**
   * O `firebase-functions` valida os `defineString` GLOBALMENTE: um parâmetro sem linha no arquivo
   * recusa o deploy de TODAS as functions, e não só das que o leem.
   */
  it('os parâmetros do escritório entram no .env, nos dois comandos que o escrevem', () => {
    for (const [name, text] of [['unpack', unpack], ['deploy', deploy]] as const) {
      expect(text, name).toContain('...office.parameters');
      expect(text, name).not.toMatch(/ensureOfficeEnv\(\s*root,\s*projectId,\s*manifest\.backendParameters/);
    }
  });
});

/**
 * O gate de versão do Console — e o defeito que ele deixou passar.
 *
 * Um `microteia` de PATH linkado a um Console 2.0.2 provisionou uma instalação montada por um Console
 * 2.1.1. Ele desempacotou o pacote sem reclamar (o `minimumCliVersion` ainda era `2.0.0`), montou as
 * cinco functions da extensão dentro do pacote, não deployou nenhuma, e recusou a extensão com "this
 * kernel package does not contain" — apontando para o pacote, quando o problema era a ferramenta.
 *
 * Nada no relato dizia isso. O gate existe exatamente para essa situação e não disparou porque ninguém
 * o moveu junto com a capacidade nova.
 */
describe('o Console mínimo que o pacote exige', () => {
  const manifest = source('kernel/manifest.ts');

  it('exige o Console que sabe deployar a function do escritório', () => {
    expect(manifest).toContain("MINIMUM_CLI_VERSION = '2.1.0'");
  });

  /**
   * A regra que o caso ensinou: o pacote carrega o SDK, e o `create function` do SDK gera uma extensão
   * que declara a própria function. A partir daí o pacote DEPENDE de um Console que a deploye — e a
   * dependência tem de estar escrita no lugar que a confere.
   */
  it('e a razão está escrita junto do número, não só no histórico', () => {
    const bloco = manifest.slice(0, manifest.indexOf('MINIMUM_CLI_VERSION ='));
    expect(bloco).toContain('2.1.0');
    expect(bloco).toMatch(/Cloud Functions do ESCRITÓRIO/);
  });

  /**
   * A recusa não pode nomear só o pacote: das duas origens possíveis de uma function, a outra é o
   * diretório do escritório — e é a que mais aparece, porque o autor declara a function e esquece de
   * exportá-la do `index.ts`.
   */
  it('a recusa nomeia as DUAS origens possíveis de uma function', () => {
    const provision = source('console/provision.ts');
    expect(source('kernel/backendShape.ts')).toContain('is not available to deploy');
    expect(source('kernel/backendShape.ts')).not.toContain('this kernel package does not contain');
    expect(provision).toContain('extensions/<folder>/functions/index.ts');
    expect(provision).toContain('this Microteia package');
  });
});

/**
 * O `unpack` preserva `functions/node_modules` MOVENDO, e não copiando.
 *
 * Copiar falhava de forma intermitente e ilegível: são ~250 pacotes e dezenas de milhares de arquivos,
 * o `cp` recursivo abre muitos descritores ao mesmo tempo, e o macOS respondia
 * `ENFILE: file table overflow` apontando um diretório qualquer dentro do `@google-cloud/firestore`.
 * O mesmo comando passava na tentativa seguinte — o pior tipo de defeito para quem instala.
 *
 * E a cópia nunca teve para que existir: a origem é apagada três linhas abaixo.
 */
describe('como o unpack preserva o cache entre versões', () => {
  const unpackSource = source('console/unpack.ts');

  it('move, e o `cp` fica só para o caso em que mover não pode funcionar', () => {
    expect(unpackSource).toContain('await preserve(previous, join(staging, relative));');
    expect(unpackSource).toContain('await rename(from, to);');
    // `EXDEV` é a única razão para o `cp` — e o comentário tem de dizer que é caminho morto aqui.
    expect(unpackSource).toContain("!== 'EXDEV'");
    expect(unpackSource).not.toContain('await cp(previous, join(staging, relative)');
  });

  /** Um erro que não seja `EXDEV` tem de subir: cair no `cp` calado esconderia o defeito de novo. */
  it('e qualquer outro erro sobe, em vez de cair no caminho lento em silêncio', () => {
    const bloco = unpackSource.slice(
      unpackSource.indexOf('const preserve ='),
      unpackSource.indexOf('export const installPath'),
    );
    expect(bloco).toContain('throw error;');
  });
});
