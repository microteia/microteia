import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scaffoldPlugin } from './scaffold';
import type { PluginSpec } from './scaffold';

/**
 * O molde é a primeira coisa que um autor — ou uma IA — vê da plataforma, e o que ele NÃO gera vira
 * hábito. O histórico de versões é o caso claro: um `VERSIONS.md` que só nasce na segunda versão nunca
 * nasce, porque quando alguém sente falta dele a primeira mudança já foi publicada sem registro.
 */
const SPEC: PluginSpec = {
  id: 'com.example.hello-world',
  name: 'Hello World',
  summary: 'What this extension does, in one line.',
  publisher: 'Acme',
  screen: true,
  view: false,
  functions: false,
};

describe('o molde de uma extensão', () => {
  const directories: string[] = [];

  const scaffold = (spec: PluginSpec = SPEC): { directory: string; files: string[] } => {
    const parent = mkdtempSync(join(tmpdir(), 'microteia-scaffold-'));
    directories.push(parent);
    return scaffoldPlugin(spec, parent, false);
  };

  const fileOf = (directory: string, relative: string): string =>
    readFileSync(join(directory, relative), 'utf8');

  afterEach(() => {
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it('nasce com um VERSIONS.md, e não com o histórico começando na segunda versão', () => {
    const { directory, files } = scaffold();
    expect(files).toContain('VERSIONS.md');
    expect(fileOf(directory, 'VERSIONS.md')).toContain('# Release notes — Hello World');
  });

  /**
   * A entrada tem de casar com a versão do manifesto: é essa correspondência que faz o arquivo servir
   * para alguma coisa. E a data é a de hoje, não um `YYYY-MM-DD` para alguém trocar à mão.
   */
  it('a primeira entrada é a 1.0.0 do manifesto, datada de hoje', () => {
    const { directory } = scaffold();
    const versions = fileOf(directory, 'VERSIONS.md');
    const today = new Date().toISOString().slice(0, 10);

    expect(versions).toContain(`#### [1.0.0] — ${today}`);
    expect(fileOf(directory, 'plugin.ts')).toContain("version: '1.0.0'");
  });

  it('o formato de uma entrada nova fica no arquivo, para não se inventar outro', () => {
    const { directory } = scaffold();
    expect(fileOf(directory, 'VERSIONS.md')).toContain('#### [1.0.1] — YYYY-MM-DD');
  });

  /** O histórico é do escritório que usa a extensão, não de quem a escreveu — a mesma regra daqui. */
  it('o README manda subir a versão e escrever a entrada na mesma alteração', () => {
    const { directory } = scaffold();
    const readme = fileOf(directory, 'README.md');
    expect(readme).toContain('VERSIONS.md');
    expect(readme).toContain('manifest.version');
    expect(readme).toContain('npm test');
  });

  it('gera o teste do pacote, que é o que faz um defeito falhar aqui e não no escritório', () => {
    const { files } = scaffold();
    expect(files).toContain('plugin.test.ts');
  });

  /**
   * O molde é o que vira hábito, e o que ele gerava era um `.view.tsx` único com estilo inline e
   * medida em pixel escrita à mão — a forma exata que o `AUTHORING.md` §7 desaconselha. Quem começa
   * num arquivo monolítico só descobre a divisão quando ele já está grande demais para dividir.
   */
  describe('a view que ele gera', () => {
    const withView = (): { directory: string; files: string[] } => scaffold({ ...SPEC, view: true });

    it('nasce dividida, e a lista do sourceFile nomeia os quatro arquivos', () => {
      const { directory, files } = withView();

      expect(files).toEqual(expect.arrayContaining([
        'views/Summary.view.tsx',
        'views/Summary.viewmodel.tsx',
        'views/Summary.styles.tsx',
        'views/Summary.rules.ts',
      ]));

      const plugin = fileOf(directory, 'plugin.ts');
      for (const file of ['Summary.view.tsx', 'Summary.viewmodel.tsx', 'Summary.styles.tsx', 'Summary.rules.ts']) {
        expect(plugin).toContain(`./views/${file}`);
      }
    });

    it('a view só renderiza: o estado e os efeitos ficam no view model', () => {
      const { directory } = withView();
      const view = fileOf(directory, 'views/Summary.view.tsx');

      expect(view).toContain('useSummaryViewModel()');
      expect(view).not.toMatch(/useState|useEffect|useMemo|useCallback/);
      expect(fileOf(directory, 'views/Summary.viewmodel.tsx')).not.toContain('<S.');
    });

    /** Cor e medida literais deixam de casar no dia em que o escritório troca de tema. */
    it('o estilo sai do tema, e não de um hexadecimal ou de um pixel escrito à mão', () => {
      const styles = fileOf(withView().directory, 'views/Summary.styles.tsx');

      expect(styles).toContain('theme.spacing');
      expect(styles).toContain('theme.colors');
      expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|\d+px/);
    });

    /**
     * A regra é a única parte que um teste alcança em um segundo — e ela só é alcançável enquanto não
     * importar nada, porque `@microteia/*` não existe fora do runtime da plataforma.
     */
    it('a regra vem sem import nenhum, com o teste dela ao lado', () => {
      const { directory, files } = withView();

      expect(files).toContain('views/Summary.rules.test.ts');
      expect(fileOf(directory, 'views/Summary.rules.ts')).not.toContain('import ');
      expect(fileOf(directory, 'views/Summary.rules.test.ts')).toContain("from './Summary.rules'");
    });
  });

  /** O que muda com as respostas é o CONTEÚDO; estes quatro vêm sempre. */
  it.each([
    ['plugin.ts'],
    ['messages.ts'],
    ['plugin.test.ts'],
    ['VERSIONS.md'],
  ])('%s vem em toda extensão, qualquer que seja a resposta', (file) => {
    const { files } = scaffold({ ...SPEC, screen: false, view: false, functions: false });
    expect(files).toContain(file);
  });
});
