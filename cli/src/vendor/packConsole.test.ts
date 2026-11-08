import { describe, expect, it } from 'vitest';
import {
  CONSOLE_PACKAGE_NAME,
  consolePackageJson,
  consoleReadme,
  packageFunctionsPackageJson,
} from './packageTemplates.js';

/**
 * O `package.json` é a razão de `pack-console` existir em vez de um `cp -R`: o Console compilado é
 * ESM, e sem `type: module` o Node só o carrega por adivinhação de sintaxe — que existe a partir do
 * 22.7 e falha antes dele com "Cannot use import statement outside a module". Uma pasta montada à mão
 * esquece disso, e o erro parece defeito da ferramenta.
 */
describe('Console empacotado para fora do repositório', () => {
  const parsed = (): Record<string, unknown> =>
    JSON.parse(consolePackageJson('1.2.3')) as Record<string, unknown>;

  it('declara type module — sem isso o Node recusa o compilado', () => {
    expect(parsed().type).toBe('module');
  });

  it('expõe o comando microteia apontando para o entrypoint compilado', () => {
    expect(parsed().bin).toEqual({ microteia: 'lib/index.js' });
  });

  it('exige o Node da versão em que as functions rodam', () => {
    expect(parsed().engines).toEqual({ node: '>=22' });
  });

  it('carrega a versão do Console, não a do produto', () => {
    expect(parsed().version).toBe('1.2.3');
  });

  /**
   * Ele deixou de ser `private`, e é o que resolve um ovo-e-galinha: enquanto o Console também tinha de
   * ser baixado de algum lugar, alguém precisava baixar o baixador — o primeiro passo de quem instala
   * era uma pasta recebida por e-mail e um `ln -s` escrito à mão.
   */
  it('é publicável: nome com escopo, e acesso público declarado', () => {
    expect(parsed().name).toBe(CONSOLE_PACKAGE_NAME);
    expect(parsed().private).toBeUndefined();
    expect(parsed().publishConfig).toEqual({ access: 'public' });
  });

  /**
   * O `CONSOLE-VERSIONS.md` está em `files` por um motivo que NÃO é documentação: o `unpack` lê aquele
   * arquivo ao lado do binário que está rodando, para pô-lo na raiz da instalação. Fora de `files`, ele
   * não existe numa instalação global — e o comando passa a avisar que o Console não carrega histórico,
   * na máquina do escritório e só lá.
   */
  it('publica o compilado, o README, o histórico que o unpack vai ler, a licença e o NOTICE', () => {
    expect(parsed().files).toEqual(['lib', 'README.md', 'CONSOLE-VERSIONS.md', 'LICENSE', 'NOTICE']);
  });

  /** A AGPL exige que quem recebe o compilado saiba sob que licença o recebeu e onde está a fonte. */
  it('declara a AGPL e diz onde está o código-fonte', () => {
    expect(parsed().license).toBe('AGPL-3.0-or-later');
    expect(consoleReadme('1.2.3')).toContain('https://github.com/microteia/microteia');
  });

  it('o README diz como instalar, como rodar a pasta, e o que a máquina precisa ter', () => {
    const readme = consoleReadme('1.2.3');
    expect(readme).toContain(`npm i -g ${CONSOLE_PACKAGE_NAME}`);
    expect(readme).toContain(`npx ${CONSOLE_PACKAGE_NAME}`);
    expect(readme).toContain('node lib/index.js --help');
    expect(readme).toContain('firebase login');
  });

  it('e aponta para a documentação oficial — é a página que o npm mostra a quem nunca viu a Microteia', () => {
    expect(consoleReadme('1.2.3')).toContain('https://doc.microteia.com');
  });

  /**
   * O `ln -s ~/.local/bin` e o `npm link` eram a recomendação enquanto a pasta era entregue à mão.
   * Publicado o pacote, ensinar os dois é ensinar a instalar uma cópia que nada atualiza — e a que o
   * `npm i -g` traz é a mesma pasta, com `npm outdated` de graça.
   */
  it('e não ensina mais a linkar a pasta à mão', () => {
    const readme = consoleReadme('1.2.3');
    expect(readme).not.toContain('ln -s');
    expect(readme).not.toContain('npm link');
  });

  /** O caminho de quem não alcança o catálogo continua escrito, e continua sendo um caminho de arquivo. */
  it('o README mostra as DUAS formas de trazer uma versão da plataforma', () => {
    const readme = consoleReadme('1.2.3');
    expect(readme).toContain('microteia unpack --version latest');
    expect(readme).toContain('microteia unpack --kernel');
  });
});

/**
 * Estas duas regressões vieram de uma instalação REAL, não de leitura de código: o `npm install` das
 * functions imprimiu `package: undefined` num aviso de engine, e a única causa possível é o
 * `package.json` gerado não conseguir formar `nome@versão`.
 */
describe('package.json das functions no pacote', () => {
  const parsed = (): Record<string, unknown> =>
    JSON.parse(packageFunctionsPackageJson(
      { engines: { node: '22' }, dependencies: { 'firebase-admin': '^14.0.0' } },
      '7.53.0',
    )) as Record<string, unknown>;

  it('tem nome E versão — sem os dois o npm avisa sobre "package: undefined"', () => {
    expect(parsed().name).toBe('microteia-functions');
    expect(parsed().version).toBe('7.53.0');
  });

  it('mantém engines.node EXATO, não uma faixa: é por ele que o Firebase escolhe o runtime', () => {
    expect(parsed().engines).toEqual({ node: '22' });
  });

  it('carrega as dependências intactas, para o package-lock que viaja continuar válido', () => {
    expect(parsed().dependencies).toEqual({ 'firebase-admin': '^14.0.0' });
  });

  it('o build do pacote compila só custom/ — o kernel já vem compilado', () => {
    expect(parsed().scripts).toEqual({ build: 'tsc -p custom/tsconfig.json' });
  });
});
