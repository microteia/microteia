import { describe, expect, it } from 'vitest';
import {
  FUNCTIONS_PACKAGE_NAME,
  OFFICE_MODULE,
  OFFICE_SUBPATH,
  packageCustomTsconfig,
  packageFunctionsPackageJson,
} from './packageTemplates.js';

const functionsPackage = (): Record<string, unknown> =>
  JSON.parse(packageFunctionsPackageJson({ dependencies: {}, devDependencies: {} }, '1.0.0')) as Record<string, unknown>;

const customTsconfig = (): { compilerOptions: Record<string, unknown> } =>
  JSON.parse(packageCustomTsconfig()) as { compilerOptions: Record<string, unknown> };

/**
 * `microteia-functions/office` é escrito em TRÊS lugares que não podem se falar: o `exports` do pacote
 * instalado (que o resolve em execução), o `paths` do `custom/tsconfig.json` (que o resolve na
 * compilação do deploy) e o `paths` do workspace de autoria, que vive no KERNEL — o Console é
 * versionado à parte e não pode importá-lo.
 *
 * Separados em silêncio, cada divergência tem um sintoma diferente e nenhum aponta para a causa: o
 * autor vê vermelho no editor, ou o deploy falha a compilar, ou tudo passa e a function estoura em
 * produção com "Cannot find module". É por isso que os três são conferidos aqui, juntos.
 */
describe('a superfície de servidor que a extensão importa', () => {
  it('o pacote instalado a exporta, sem custar uma dependência nova', () => {
    const manifest = functionsPackage();
    expect(manifest.name).toBe(FUNCTIONS_PACKAGE_NAME);
    expect(manifest.dependencies).toEqual({});

    const exports = manifest.exports as Record<string, unknown>;
    // O `.` continua declarado: restringir os subcaminhos sem ele tiraria a plataforma inteira do ar.
    expect(exports['.']).toBe('./index.js');
    expect(exports[`./${OFFICE_SUBPATH}`]).toEqual({
      types: `./lib/${OFFICE_SUBPATH}/index.d.ts`,
      default: `./lib/${OFFICE_SUBPATH}/index.js`,
    });
  });

  it('a compilação do deploy resolve o tipo dele', () => {
    const paths = customTsconfig().compilerOptions.paths as Record<string, string[]>;
    expect(paths[OFFICE_MODULE]).toEqual([`../lib/${OFFICE_SUBPATH}/index.d.ts`]);
    // Sem `baseUrl`: ele faria qualquer arquivo de `src/` virar um módulo de nome curto por acidente.
    expect(customTsconfig().compilerOptions.baseUrl).toBeUndefined();
  });

  it('e o editor de quem escreve a extensão também, pelo tipo que o SDK carrega', async () => {
    const { REQUIRED_PATHS } = await import('../../../src/sdk/node/workspace/reconcile.js');
    const entry = REQUIRED_PATHS.find(([key]) => key === OFFICE_MODULE);
    expect(entry, `REQUIRED_PATHS has no "${OFFICE_MODULE}"`).toBeDefined();
    expect(entry?.[1]).toBe('./node_modules/@microteia/sdk/types/microteia-office.d.ts');
  });
});
