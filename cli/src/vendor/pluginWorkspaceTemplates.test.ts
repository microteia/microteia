import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../shared/paths.js';
import { isValidPluginId } from '../../../src/domain/schema/plugin/artifactRef';
import { SDK_TARBALL, isValidNamespace, workspacePackageJson } from './pluginWorkspaceTemplates.js';

/**
 * O que sobrou do Console em `extensions/` é a SEMENTE, e só ela. A documentação, os scripts e o
 * `tsconfig.json` passaram para `src/sdk/node/workspace/` — os casos deles estão em
 * `templates.test.ts` e `sync.test.ts`, ao lado do código.
 *
 * A mudança não foi de organização. O Console é versionado (`CLI_VERSION`) e distribuído SEPARADAMENTE
 * do kernel: enquanto o texto que descreve o que o kernel sabe fazer saía daqui, um Console de duas
 * versões atrás escrevia, em silêncio, a documentação de outro contrato — e nada comparava as duas.
 */
describe('a semente do workspace de autoria', () => {
  const parsed = (): Record<string, unknown> =>
    JSON.parse(workspacePackageJson('acme', `../.microteia/install/sdk/${SDK_TARBALL}`, 'com.acme')) as Record<string, unknown>;

  it('aponta o SDK por caminho SEM versão — o upgrade não pode exigir edição à mão', () => {
    const dependencies = parsed().dependencies as Record<string, string>;
    expect(dependencies['@microteia/sdk']).toBe(`file:../.microteia/install/sdk/${SDK_TARBALL}`);
    expect(SDK_TARBALL).not.toMatch(/\d/);
  });

  it('é privado: o diretório do escritório não é um pacote a publicar', () => {
    expect(parsed().private).toBe(true);
  });

  /**
   * A semente é mínima de propósito. Scripts e devDependencies são nomes de comando e versões de
   * ferramenta DO SDK; duplicá-los aqui era exatamente o defeito — o Console dizia uma coisa e o SDK
   * instalado sabia outra. Quem os escreve é o `sync`, e o segundo `npm install` os instala.
   */
  it('não declara scripts nem devDependencies — quem os conhece é o SDK', () => {
    expect(parsed().scripts).toBeUndefined();
    expect(parsed().devDependencies).toBeUndefined();
  });

  /** Nem a versão do contrato: ela é do SDK que de fato ficou instalado, e o `sync` a carimba. */
  it('não carimba o contrato: quem o conhece é o SDK que o npm acabou de instalar', () => {
    expect((parsed().microteia as Record<string, unknown>).kernelVersion).toBeUndefined();
  });

  /**
   * O namespace é a única coisa que só quem roda o `plugin-init` sabe. Sem ele, o id de cada extensão
   * era o que alguém digitasse na hora — e um agente copiava o `com.microteia` dos exemplos.
   */
  it('grava o namespace do escritório, de onde nasce o id de toda extensão do diretório', () => {
    expect(parsed().microteia).toEqual({ namespace: 'com.acme' });
  });

  it('confere o namespace com o MESMO formato do id de extensão do domínio', () => {
    for (const value of ['com.acme', 'br.com.acme', 'com.acme-legal', 'acme', 'Com.Acme', 'com.', '.com', 'com.acme/x', '1com.acme', 'com.1acme']) {
      expect(isValidNamespace(value), value).toBe(isValidPluginId(value));
    }
  });
});

/**
 * O Console não escreve mais documento nenhum em `extensions/`, e este é o teste que impede a volta
 * disso por distração — um template novo aqui reabriria a divergência silenciosa entre as duas
 * ferramentas.
 */
describe('a fronteira entre o Console e o SDK', () => {
  const source = (relative: string): string => readFileSync(join(repoRoot, relative), 'utf8');

  it('nenhum documento de autoria é escrito pelo Console', async () => {
    // A saída, não o texto do módulo: o cabeçalho dele NOMEIA os documentos, justamente para dizer
    // que saíram daqui. O que não pode voltar é um template que os produza.
    const written = workspacePackageJson('acme', `../${SDK_TARBALL}`, 'com.acme');
    for (const document of ['AGENTS.md', 'AUTHORING.md', 'CLAUDE.md', '.mcp.json', 'tsconfig.json']) {
      expect(written, document).not.toContain(document);
    }
    const exported = Object.keys(await import('./pluginWorkspaceTemplates.js')).sort();
    expect(exported).toEqual(['SDK_TARBALL', 'isValidNamespace', 'workspacePackageJson']);
  });

  it('o guia de autoria não mora mais no Console', () => {
    const workspace = source('cli/src/console/pluginWorkspace.ts');
    expect(workspace).not.toContain('authoringGuide');
    expect(workspace).toContain("'sync'");
  });

  /**
   * `plugin-init` e `unpack` passam pelo MESMO caminho. Enquanto eram dois, existia um "init" que
   * escrevia tudo e um upgrade que não escrevia nada — e a diferença entre eles era invisível.
   */
  it('init e upgrade compartilham o caminho que sincroniza o diretório', () => {
    const workspace = source('cli/src/console/pluginWorkspace.ts');
    expect(workspace).toContain('export const syncAuthoringWorkspace');
    expect(workspace).toContain('export const refreshAuthoringWorkspace');
    expect(source('cli/src/console/unpack.ts')).toContain('refreshAuthoringWorkspace(root');
  });

  /**
   * O `unpack` traz o SDK pelo CAMINHO do tarball, não por `npm install`. O caminho não leva versão e o
   * lock guarda a impressão digital do anterior: um `npm install` diria "up to date" e manteria o SDK
   * de antes — em silêncio, que é o modo de falha que este trabalho inteiro existe para fechar.
   */
  it('o refresh instala o tarball pelo caminho, e só depois sincroniza', () => {
    const workspace = source('cli/src/console/pluginWorkspace.ts');
    const install = workspace.indexOf("'install', '--no-audit', '--no-fund', tarball");
    const sync = workspace.indexOf("'sync', '--install'");
    expect(install).toBeGreaterThan(-1);
    expect(sync).toBeGreaterThan(install);
  });

  /**
   * Duas propriedades medidas contra o npm de verdade, e sem qualquer uma delas o movimento se desfaz:
   *
   * Com `--no-save`, o pacote novo é extraído e o lock fica no anterior — e o terceiro passo, que
   * existe para instalar uma devDependency nova, reinstala o SDK antigo e reverte o primeiro.
   *
   * Com caminho ABSOLUTO, o npm reescreve a dependência com ele. O caminho é relativo justamente para a
   * instalação poder ser movida ou versionada, e um absoluto no `package.json` desfaz isso.
   */
  it('salva no lock e usa caminho relativo — sem os dois, o refresh se desfaz', () => {
    const workspace = source('cli/src/console/pluginWorkspace.ts');
    const sync = workspace.slice(
      workspace.indexOf('export const syncAuthoringWorkspace'),
      workspace.indexOf('export const refreshAuthoringWorkspace'),
    );
    expect(sync).not.toContain('--no-save');
    expect(sync).toContain('const tarball = relative(directory, sdkPath)');
  });

  /**
   * Trocar de kernel é a operação principal. Um `npm` sem rede não pode derrubá-la por causa da
   * documentação de um diretório opcional — o resultado seria uma instalação pela metade.
   */
  it('a falha ao sincronizar avisa, e não derruba a troca de kernel', () => {
    const workspace = source('cli/src/console/pluginWorkspace.ts');
    const refresh = workspace.slice(workspace.indexOf('export const refreshAuthoringWorkspace'));
    expect(refresh).toContain('catch');
    expect(refresh).toContain('warn(');
  });
});
