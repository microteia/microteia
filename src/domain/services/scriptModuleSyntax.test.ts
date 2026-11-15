import { describe, expect, it } from 'vitest';
import { stripCommentsAndLiterals, usesModuleSyntax } from './scriptModuleSyntax';
import { transpileScriptSource } from './scriptSource';

/**
 * A trava olhava o texto cru: a palavra `import` num comentário, ou um `log('export done')`, recusava
 * o script com a mensagem de "não use módulos" — e quem a recebia não tinha módulo nenhum para tirar.
 */
describe('a trava de sintaxe de módulo do script', () => {
  it.each([
    ['comentário de linha', '// import the records first\nasync function main() { return 1; }\nmain()'],
    ['comentário de bloco', '/* export: see below */\nasync function main() { return 1; }\nmain()'],
    ['string', "log('export done'); log(\"import ok\");"],
    ['template', 'log(`import ${input.code} and export`);'],
    ['regex', 'const r = /import|export/g;\nlog(r.test(input.code));'],
    ['nome de propriedade', 'const o = { import: 1, export: 2 };\nlog(o.import + o.export);'],
    ['identificador parecido', 'const imported = 1; const exporter = 2; const requireCode = 3;'],
  ])('deixa passar a palavra em %s', (_what, source) => {
    expect(usesModuleSyntax(source)).toBe(false);
  });

  it.each([
    ['import de nomes', "import { a } from 'x';\nlog(a);"],
    ['import de efeito', "import 'x';"],
    ['import dinâmico', "const m = await import('x');"],
    ['export de declaração', 'export const a = 1;'],
    ['export default', 'export default 1;'],
    ['require', "const fs = require('fs');"],
    ['import depois de um template com expressão', "log(`${input.a}`);\nimport { b } from 'y';"],
  ])('recusa %s', (_what, source) => {
    expect(usesModuleSyntax(source)).toBe(true);
  });

  it('preserva as quebras de linha ao apagar comentário e literal', () => {
    const source = "/* a\nb */\nlog('x');\n";
    expect(stripCommentsAndLiterals(source).split('\n')).toHaveLength(source.split('\n').length);
  });

  it('a gravação aceita o script que só MENCIONA import num comentário', () => {
    const result = transpileScriptSource('// we never import anything here\nasync function main() { return 1; }\nmain()');
    expect('compiledJs' in result).toBe(true);
  });

  it('e continua recusando o que importa de verdade', () => {
    expect(transpileScriptSource("import { a } from 'x';\nlog(a);"))
      .toEqual({ error: '@core.automation/script.error.no-modules' });
  });
});
