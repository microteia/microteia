import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STAMP_MAX_BYTES,
  STAMP_WARN_BYTES,
  buildLoginExtensions,
  parseExtensionPaths,
} from './loginExtensions.js';

const PRE_LOGIN = ['auth.provider', 'i18n.messages', 'theme.definition', 'theme.tokens', 'ui.slot'];

const workspace = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'microteia-login-'));
  await mkdir(join(root, 'dist'), { recursive: true });
  return root;
};

const writePackage = async (root: string, name: string, pkg: unknown): Promise<string> => {
  const path = join('dist', name);
  await writeFile(join(root, path), JSON.stringify(pkg));
  return path;
};

const ssoPackage = (id = 'com.acme.sso', version = '1.0.0') => ({
  manifest: {
    id,
    version,
    contributes: [
      { point: 'auth.provider', id: 'acme', metadata: { key: 'acme', kind: 'oidc', providerId: 'oidc.acme' } },
    ],
  },
});

describe('a lista declarada', () => {
  it('é vazia quando não há nada, e não engole entrada em branco', () => {
    expect(parseExtensionPaths(null)).toEqual([]);
    expect(parseExtensionPaths('')).toEqual([]);
    expect(parseExtensionPaths(' a.json , , b.json ')).toEqual(['a.json', 'b.json']);
  });
});

describe('o carimbo das extensões pré-login', () => {
  it('sem nada declarado, escreve um carimbo VAZIO em vez de não escrever', async () => {
    const result = await buildLoginExtensions(await workspace(), null, PRE_LOGIN);
    expect(result.stamped).toEqual([]);
    expect(result.contents).toContain('window.__MICROTEIA_EXTENSIONS__ = [];');
  });

  it('carimba o pacote declarado, na ordem em que foi declarado', async () => {
    const root = await workspace();
    const first = await writePackage(root, 'sso.json', ssoPackage('com.acme.sso'));
    const second = await writePackage(root, 'marca.json', {
      manifest: {
        id: 'com.acme.marca',
        version: '2.1.0',
        contributes: [{ point: 'ui.slot', id: 'aviso', metadata: { surface: 'login.footer' } }],
      },
    });

    const result = await buildLoginExtensions(root, `${first},${second}`, PRE_LOGIN);
    expect(result.stamped).toEqual(['com.acme.sso@1.0.0', 'com.acme.marca@2.1.0']);
    expect(result.warnings).toEqual([]);
  });

  /**
   * A recusa que dá nome ao módulo: um pacote que carrega e não faz nada é pior que um erro, porque
   * quem o carimbou acredita que está no ar.
   */
  it('recusa o pacote que não contribui para nenhum ponto pré-login', async () => {
    const root = await workspace();
    const path = await writePackage(root, 'tela.json', {
      manifest: {
        id: 'com.acme.tela',
        version: '1.0.0',
        contributes: [{ point: 'ui.page', id: 'guia', metadata: { key: 'guia' } }],
      },
    });

    await expect(buildLoginExtensions(root, path, PRE_LOGIN))
      .rejects.toThrow(/contributes nothing that works before sign-in/);
  });

  /** Pacote de kernel antigo não declara a lista: pular a checagem é melhor que inventá-la. */
  it('pula a checagem quando o pacote do kernel não declara os pontos', async () => {
    const root = await workspace();
    const path = await writePackage(root, 'tela.json', {
      manifest: { id: 'com.acme.tela', version: '1.0.0', contributes: [{ point: 'ui.page' }] },
    });
    const result = await buildLoginExtensions(root, path, undefined);
    expect(result.stamped).toEqual(['com.acme.tela@1.0.0']);
  });

  it('diz qual caminho não existe, em vez de carimbar sem ele', async () => {
    const root = await workspace();
    await expect(buildLoginExtensions(root, 'dist/nao-existe.json', PRE_LOGIN))
      .rejects.toThrow(/dist\/nao-existe\.json, which does not exist/);
  });

  it('recusa o que não é pacote de extensão', async () => {
    const root = await workspace();
    const path = await writePackage(root, 'lixo.json', { hello: 'world' });
    await expect(buildLoginExtensions(root, path, PRE_LOGIN)).rejects.toThrow(/no "manifest"/);
  });

  it('recusa JSON quebrado dizendo qual arquivo é', async () => {
    const root = await workspace();
    await writeFile(join(root, 'dist', 'meio.json'), '{ "manifest": ');
    await expect(buildLoginExtensions(root, 'dist/meio.json', PRE_LOGIN))
      .rejects.toThrow(/dist\/meio\.json is not valid JSON/);
  });

  /**
   * O Kernel ignoraria o segundo, então o arquivo diria uma coisa e a instalação faria outra — e é
   * a divergência silenciosa que a recusa evita.
   */
  it('recusa o mesmo pacote declarado duas vezes', async () => {
    const root = await workspace();
    const first = await writePackage(root, 'sso.json', ssoPackage('com.acme.sso', '1.0.0'));
    const second = await writePackage(root, 'sso-again.json', ssoPackage('com.acme.sso', '1.1.0'));
    await expect(buildLoginExtensions(root, `${first},${second}`, PRE_LOGIN))
      .rejects.toThrow(/lists com\.acme\.sso twice/);
  });

  /** Carimbar não é confiar: o código do pacote não roda antes do login, e quem carimba ouve isso. */
  it('avisa que a view carimbada não roda', async () => {
    const root = await workspace();
    const path = await writePackage(root, 'sso.json', {
      ...ssoPackage(),
      views: [{ key: 'Banner', source: 'export const Banner = () => null;' }],
    });
    const result = await buildLoginExtensions(root, path, PRE_LOGIN);
    expect(result.warnings.join(' ')).toMatch(/code does not run before sign-in/);
  });

  it('avisa quando o carimbo engorda, e recusa quando ele passa do limite', async () => {
    const root = await workspace();
    const bulky = (bytes: number) => ({
      manifest: {
        id: 'com.acme.sso',
        version: '1.0.0',
        contributes: [
          { point: 'auth.provider', id: 'acme', metadata: { key: 'acme', filler: 'x'.repeat(bytes) } },
        ],
      },
    });

    const warned = await buildLoginExtensions(
      root,
      await writePackage(root, 'grande.json', bulky(STAMP_WARN_BYTES + 1024)),
      PRE_LOGIN,
    );
    expect(warned.bytes).toBeGreaterThan(STAMP_WARN_BYTES);
    expect(warned.warnings.join(' ')).toMatch(/blocks the page on every visit/);

    await expect(buildLoginExtensions(
      root,
      await writePackage(root, 'enorme.json', bulky(STAMP_MAX_BYTES + 1024)),
      PRE_LOGIN,
    )).rejects.toThrow(/over the/);
  });
});
