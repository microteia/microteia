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

describe('a fronteira entre unpack e deploy', () => {
  const unpack = source('console/unpack.ts');
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
   * caso da configuração de backend na raiz, e é por isso que ele está em `2.0.0`.
   *
   * O que tem de valer sempre é a ORDEM: um Console que exigisse de si mesmo uma versão maior do que
   * a sua recusaria o próprio pacote que acabou de montar.
   */
  it('o Console nunca exige de si mesmo uma versão maior do que a sua', () => {
    const consoleVersion = /CLI_VERSION = '([^']+)'/.exec(source('shared/paths.ts'))?.[1];
    const required = /MINIMUM_CLI_VERSION = '([^']+)'/.exec(source('kernel/manifest.ts'))?.[1];

    expect(required).toBe('2.0.0');
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
