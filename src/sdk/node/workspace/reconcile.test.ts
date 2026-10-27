import { describe, expect, it } from 'vitest';
import {
  MCP_SERVER,
  MCP_SERVER_NAME,
  REQUIRED_FILES,
  REQUIRED_MODULE_DETECTION,
  REQUIRED_PATHS,
  reconcileGitignore,
  reconcileMcpJson,
  reconcileTsconfig,
  workspaceGitignore,
  workspaceMcpJson,
  workspaceTsconfig,
} from './reconcile';

/**
 * A regra destes quatro arquivos é a que os separa dos documentos: **o autor escreve dentro deles**.
 *
 * Sobrepor um `tsconfig.json` apagaria o `path` que ele acrescentou para uma biblioteca dele; sobrepor
 * um `.mcp.json` apagaria os outros servidores MCP que ele registrou — e registrar outro servidor é a
 * primeira coisa que alguém faz num diretório que tem `.mcp.json`. Daí a regra única: acrescenta o que
 * falta, não altera o que divergir, avisa.
 *
 * Cada caso aqui é uma das três colunas dessa regra, em cada um dos arquivos. O que eles guardam não é
 * cobertura: é a promessa de que uma atualização de plataforma não desfaz trabalho de ninguém.
 */
const parse = (contents: string): Record<string, unknown> =>
  JSON.parse(contents) as Record<string, unknown>;

const pathsOf = (contents: string): Record<string, string[]> =>
  (parse(contents).compilerOptions as { paths: Record<string, string[]> }).paths;

describe('conciliar o tsconfig.json', () => {
  it('nasce completo quando não existe', () => {
    const result = reconcileTsconfig(null);
    expect(result.action).toBe('created');
    expect(result.contents).toBe(workspaceTsconfig());
    expect(result.warnings).toEqual([]);
  });

  it('não toca no que a semente já produz — a segunda passada é silenciosa', () => {
    const result = reconcileTsconfig(workspaceTsconfig());
    expect(result.action).toBe('unchanged');
    expect(result.contents).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  /**
   * O caso que motivou esta mudança: o autor mexeu no arquivo, e o que ele escreveu tem de sobreviver.
   */
  it('PRESERVA tudo o que o autor escreveu, incluindo o que não conhecemos', () => {
    const mine = JSON.stringify({
      compilerOptions: {
        strict: false,
        target: 'es2020',
        paths: {
          '@microteia/sdk': ['./node_modules/@microteia/sdk/lib/sdk/index.d.ts'],
          '@microteia/sdk/node': ['./node_modules/@microteia/sdk/lib/sdk/node/compile.d.ts'],
          'microteia-functions/office': ['./node_modules/@microteia/sdk/types/microteia-office.d.ts'],
          '@microteia/*': ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
          react: ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
          'react/jsx-runtime': ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
          'styled-components': ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
          '@acme/shared': ['./shared/index.ts'],
        },
        jsx: 'react-jsx',
        moduleDetection: 'force',
      },
      files: REQUIRED_FILES,
      include: ['**/*.ts'],
      exclude: ['node_modules'],
    }, null, 2) + '\n';

    const result = reconcileTsconfig(mine);
    expect(result.action).toBe('unchanged');
    expect(result.warnings).toEqual([]);
  });

  it('acrescenta o path que falta e mantém o do autor', () => {
    const mine = JSON.stringify({
      compilerOptions: { paths: { '@acme/shared': ['./shared/index.ts'] }, jsx: 'react-jsx' },
      files: REQUIRED_FILES,
    });

    const result = reconcileTsconfig(mine);
    expect(result.action).toBe('updated');
    const paths = pathsOf(result.contents as string);
    for (const [key, target] of REQUIRED_PATHS) expect(paths[key], key).toEqual([target]);
    expect(paths['@acme/shared']).toEqual(['./shared/index.ts']);
  });

  /**
   * A única coisa que este módulo posiciona sem ser pedido, e só quando ACRESCENTA: o curinga engole
   * `@microteia/sdk` se vier antes dele, então acrescentar no fim não acrescentaria nada.
   */
  it('põe o que acrescenta ANTES do curinga, senão o curinga o engole', () => {
    const mine = JSON.stringify({
      compilerOptions: { paths: { '@microteia/*': ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'] } },
    });

    const keys = Object.keys(pathsOf(reconcileTsconfig(mine).contents as string));
    expect(keys.indexOf('@microteia/sdk')).toBeLessThan(keys.indexOf('@microteia/*'));
    expect(keys.indexOf('@microteia/sdk/node')).toBeLessThan(keys.indexOf('@microteia/*'));
  });

  /**
   * O outro lado da mesma regra: um valor que já está lá NÃO é alterado, nem que esteja errado. Quem
   * decide é quem escreveu, e o aviso diz o que se espera e o que se achou.
   */
  it('não altera um path divergente — avisa, com os dois valores', () => {
    const mine = JSON.stringify({
      compilerOptions: {
        paths: Object.fromEntries([
          ...REQUIRED_PATHS.map(([key, target]) => [key, [target]]),
          ['@microteia/ui', ['./meu/proprio/ui.d.ts']],
        ]),
        jsx: 'react-jsx',
        moduleDetection: 'force',
      },
      files: REQUIRED_FILES,
    });
    // `@microteia/ui` não é requisito nosso — o requisito é o curinga. Este é o caso de verdade:
    const diverged = mine.replace(
      '"@microteia/*":["./node_modules/@microteia/sdk/types/microteia-host.d.ts"]',
      '"@microteia/*":["./outro/lugar.d.ts"]',
    );

    const result = reconcileTsconfig(diverged);
    expect(result.action).toBe('unchanged');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('@microteia/*');
    expect(result.warnings[0]).toContain('./outro/lugar.d.ts');
    expect(result.warnings[0]).toContain('microteia-host.d.ts');
    expect(result.warnings[0]).toMatch(/adjust it by hand/);
  });

  /** Ordem errada que JÁ estava no arquivo é avisada, não corrigida: mexer nela é decisão dele. */
  it('avisa quando a ordem existente deixa o curinga engolir o SDK', () => {
    const mine = JSON.stringify({
      compilerOptions: {
        paths: {
          '@microteia/*': ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
          '@microteia/sdk': ['./node_modules/@microteia/sdk/lib/sdk/index.d.ts'],
          '@microteia/sdk/node': ['./node_modules/@microteia/sdk/lib/sdk/node/compile.d.ts'],
          'microteia-functions/office': ['./node_modules/@microteia/sdk/types/microteia-office.d.ts'],
          react: ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
          'react/jsx-runtime': ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
          'styled-components': ['./node_modules/@microteia/sdk/types/microteia-host.d.ts'],
        },
        jsx: 'react-jsx',
        moduleDetection: 'force',
      },
      files: REQUIRED_FILES,
    });

    const result = reconcileTsconfig(mine);
    expect(result.action).toBe('unchanged');
    expect(result.warnings[0]).toContain('come AFTER');
    expect(result.warnings[0]).toContain('Move them above it');
  });

  /** Sem ela, `import X from './views/Y.tsx?raw'` é erro — e é o import mais importante do arquivo. */
  it('acrescenta a declaração do ?raw a um `files` que o autor já usa', () => {
    const mine = JSON.stringify({
      compilerOptions: { paths: Object.fromEntries(REQUIRED_PATHS.map(([k, t]) => [k, [t]])), jsx: 'react-jsx' },
      files: ['./meus-tipos.d.ts'],
    });

    const files = parse(reconcileTsconfig(mine).contents as string).files as string[];
    expect(files).toEqual(['./meus-tipos.d.ts', ...REQUIRED_FILES]);
  });

  /**
   * O workspace de antes desta declaração existir: ele já tinha a do `?raw`, e só a que falta entra.
   * Sem ela, todo `.script.ts` acusava cada `query`, `upsert` e `input` que usa.
   */
  it('acrescenta só a declaração do sandbox a quem já tinha a do ?raw', () => {
    const [raw, sandbox] = REQUIRED_FILES;
    const before = JSON.stringify({
      compilerOptions: {
        paths: Object.fromEntries(REQUIRED_PATHS.map(([k, t]) => [k, [t]])),
        jsx: 'react-jsx',
        moduleDetection: 'force',
      },
      files: [raw],
    });

    const result = reconcileTsconfig(before);
    expect(result.action).toBe('updated');
    expect(parse(result.contents as string).files).toEqual([raw, sandbox]);
  });

  /**
   * Um script não importa nada, e para o TypeScript isso o faz SCRIPT GLOBAL: dois `main` em dois
   * arquivos colidiam. O workspace semeado antes deste requisito não o tem, e o `sync` o acrescenta.
   */
  it('acrescenta o moduleDetection a quem não o declara', () => {
    const before = JSON.stringify({
      compilerOptions: { paths: Object.fromEntries(REQUIRED_PATHS.map(([k, t]) => [k, [t]])), jsx: 'react-jsx' },
      files: REQUIRED_FILES,
    });

    const result = reconcileTsconfig(before);
    expect(result.action).toBe('updated');
    const options = parse(result.contents as string).compilerOptions as Record<string, unknown>;
    expect(options.moduleDetection).toBe(REQUIRED_MODULE_DETECTION);
  });

  it('não altera um moduleDetection que o autor escolheu — avisa', () => {
    const mine = JSON.stringify({
      compilerOptions: {
        paths: Object.fromEntries(REQUIRED_PATHS.map(([k, t]) => [k, [t]])),
        jsx: 'react-jsx',
        moduleDetection: 'auto',
      },
      files: REQUIRED_FILES,
    });

    const result = reconcileTsconfig(mine);
    expect(result.action).toBe('unchanged');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('compilerOptions.moduleDetection');
    expect(result.warnings[0]).toContain('"auto"');
    expect(result.warnings[0]).toMatch(/adjust it by hand/);
  });

  /**
   * Excluir `examples/` ou os diretórios de function deixa aqueles arquivos FORA de todo projeto — e um
   * arquivo sem projeto não resolve nada no editor, nem `@microteia/data`. Já aconteceu, e o efeito foi
   * pior que o problema. É conselho, não requisito: por isso avisa e não mexe.
   */
  it('avisa sobre exclude alargado, que é o que apaga o editor por dentro', () => {
    const mine = JSON.stringify({
      compilerOptions: {
        paths: Object.fromEntries(REQUIRED_PATHS.map(([k, t]) => [k, [t]])),
        jsx: 'react-jsx',
        moduleDetection: 'force',
      },
      files: REQUIRED_FILES,
      exclude: ['node_modules', 'examples', '**/functions/**'],
    });

    const result = reconcileTsconfig(mine);
    expect(result.action).toBe('unchanged');
    expect(result.warnings[0]).toContain('examples');
    expect(result.warnings[0]).toContain('resolves nothing in the editor');
  });

  /** Um arquivo que não é JSON não pode ser mexido às cegas — nem sobreposto, que apagaria tudo. */
  it('não mexe num arquivo que não consegue ler, e diz o que fazer', () => {
    const result = reconcileTsconfig('{ /* jsonc, com comentário */ }');
    expect(result.action).toBe('unchanged');
    expect(result.contents).toBeNull();
    expect(result.warnings[0]).toContain('could not be read as JSON');
    expect(result.warnings[0]).toContain('left alone');
  });
});

describe('conciliar o .mcp.json', () => {
  it('nasce com o nosso servidor quando não existe', () => {
    expect(reconcileMcpJson(null).contents).toBe(workspaceMcpJson());
  });

  it('não mexe quando já está certo', () => {
    expect(reconcileMcpJson(workspaceMcpJson()).action).toBe('unchanged');
  });

  /**
   * O defeito mais provável da lista, e o que sobrepor este arquivo causaria: registrar outro servidor
   * MCP é a primeira coisa que se faz num diretório que tem um `.mcp.json`.
   */
  it('PRESERVA os outros servidores que o autor registrou', () => {
    const mine = JSON.stringify({
      mcpServers: {
        github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
      },
    });

    const result = reconcileMcpJson(mine);
    expect(result.action).toBe('updated');
    const servers = parse(result.contents as string).mcpServers as Record<string, unknown>;
    expect(Object.keys(servers).sort()).toEqual(['github', MCP_SERVER_NAME]);
    expect(servers.github).toEqual({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] });
    expect(servers[MCP_SERVER_NAME]).toEqual(MCP_SERVER);
  });

  it('não altera a nossa entrada se o autor a mudou — avisa', () => {
    const mine = JSON.stringify({
      mcpServers: { [MCP_SERVER_NAME]: { command: 'npx', args: ['microteia-plugin', 'mcp'] } },
    });

    const result = reconcileMcpJson(mine);
    expect(result.action).toBe('unchanged');
    expect(result.warnings[0]).toContain(MCP_SERVER_NAME);
    expect(result.warnings[0]).toContain('npx microteia-plugin mcp');
  });
});

describe('conciliar o .gitignore', () => {
  it('nasce com as linhas que a configuração exige', () => {
    expect(reconcileGitignore(null).contents).toBe(workspaceGitignore());
  });

  it('não mexe quando já tem todas', () => {
    expect(reconcileGitignore(workspaceGitignore()).action).toBe('unchanged');
  });

  /** Acrescentar é seguro; remover, nunca — e é a linha do autor que uma sobreposição levaria. */
  it('acrescenta o que falta e PRESERVA as linhas do autor', () => {
    const result = reconcileGitignore('# meus\n.env.local\nnode_modules/\n');
    expect(result.action).toBe('updated');
    const lines = (result.contents as string).split('\n');
    expect(lines).toContain('# meus');
    expect(lines).toContain('.env.local');
    expect(lines).toContain('!package.json');
    // `node_modules/` já estava lá: não entra duas vezes.
    expect(lines.filter((line) => line === 'node_modules/')).toHaveLength(1);
  });

  it('não deixa duas linhas colarem quando o arquivo não termina em nova linha', () => {
    const result = reconcileGitignore('.env.local');
    expect((result.contents as string).split('\n')).toContain('.env.local');
    expect(result.contents).not.toContain('.env.localnode_modules/');
  });
});
