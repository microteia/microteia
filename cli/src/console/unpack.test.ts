import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../shared/paths.js';

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
   * O par é o contrato: um pacote montado hoje exige um Console que saiba `unpack`, então os dois números
   * andam juntos enquanto a mudança for do tipo que o pacote passa a DEPENDER.
   */
  it('a versão do Console acompanha a mudança de contrato, e o pacote exige essa versão', () => {
    const consoleVersion = /CLI_VERSION = '([^']+)'/.exec(source('shared/paths.ts'))?.[1];
    const required = /MINIMUM_CLI_VERSION = '([^']+)'/.exec(source('kernel/manifest.ts'))?.[1];

    expect(consoleVersion).toBe('2.0.0');
    expect(required).toBe(consoleVersion);
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
