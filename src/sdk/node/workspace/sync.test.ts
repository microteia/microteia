import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KERNEL_VERSION } from '../../../domain/schema/plugin/kernelVersion';
import { syncWorkspace } from './sync';

/**
 * O `sync` é a peça que faltava, e o que ele conserta não é um defeito: é uma classe deles.
 *
 * `AGENTS.md`, `AUTHORING.md`, `tsconfig.json` e `.mcp.json` descrevem o que o kernel sabe fazer, e
 * eram escritos UMA vez, pelo `plugin-init` — que se recusa a rodar de novo. A instalação trocava de
 * kernel e aqueles textos continuavam descrevendo o contrato de meses antes, inclusive para a IA que os
 * lê como instrução. Nada reprovava, porque nada comparava.
 *
 * Os casos abaixo guardam as duas propriedades que fazem o `unpack` poder chamá-lo sozinho, sem
 * perguntar nada a ninguém: ele é idempotente, e não toca no que é do escritório.
 */
const HOST_TYPES = `declare module '@microteia/ui' {
  export const Button: unknown;
}

declare module '@microteia/data' {
  export const useEntity: unknown;
}
`;

const workspaces: string[] = [];

/** Um `extensions/` como o `plugin-init` o deixa: a semente, e o SDK já instalado. */
const seed = (options: {
  examples?: string[];
  devDependencies?: Record<string, string>;
  namespace?: string | null;
} = {}): string => {
  const root = mkdtempSync(join(tmpdir(), 'microteia-sync-'));
  workspaces.push(root);

  const types = join(root, 'node_modules/@microteia/sdk/types');
  mkdirSync(types, { recursive: true });
  writeFileSync(join(types, 'microteia-host.d.ts'), HOST_TYPES);

  writeFileSync(join(root, 'package.json'), `${JSON.stringify({
    name: 'acme-extensions',
    version: '0.0.0',
    private: true,
    dependencies: { '@microteia/sdk': 'file:../.microteia/install/sdk/microteia-sdk.tgz' },
    ...(options.devDependencies === undefined ? {} : { devDependencies: options.devDependencies }),
    ...(options.namespace === null ? {} : { microteia: { namespace: options.namespace ?? 'com.acme' } }),
  }, null, 2)}\n`);

  if (options.examples !== undefined) {
    for (const id of options.examples) {
      const dir = join(root, 'install/sdk/examples', id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'plugin.ts'), 'export default {};\n');
    }
  }
  return root;
};

const read = (root: string, name: string): string => readFileSync(join(root, name), 'utf8');

afterEach(() => {
  while (workspaces.length > 0) {
    rmSync(workspaces.pop() as string, { recursive: true, force: true });
  }
});

describe('sincronizar o diretório de autoria', () => {
  /**
   * As três políticas, e a diferença entre elas é DE QUEM é o arquivo: prosa nossa é sobreposta,
   * configuração em que o autor escreve é conciliada, e o que é dele nasce uma vez.
   */
  it('sobrepõe a prosa, concilia a configuração e semeia o que é do escritório', () => {
    const root = seed();
    const report = syncWorkspace({ root, install: null });

    expect(report.rewritten.sort()).toEqual(['AGENTS.md', 'AUTHORING.md']);
    expect(report.reconciled.sort()).toEqual(['.gitignore', '.mcp.json', 'package.json', 'tsconfig.json']);
    // Só as sementes do escritório: a mensagem "nada reescreve isto" não vale para as outras.
    expect(report.seeded.sort()).toEqual(['CLAUDE.md', 'README.md']);
    expect(report.warnings).toEqual([]);
    expect(report.kernelVersion).toBe(KERNEL_VERSION);
  });

  /**
   * A propriedade que permite ao `unpack` chamá-lo em toda troca de kernel: rodar duas vezes produz os
   * mesmos bytes. Sem ela, o comando teria de perguntar — e um upgrade que pergunta é um upgrade que
   * alguém deixa para depois.
   */
  it('é idempotente: a segunda passada produz os mesmos bytes', () => {
    const root = seed();
    syncWorkspace({ root, install: null });
    const first = ['AGENTS.md', 'AUTHORING.md', 'tsconfig.json', '.mcp.json', 'package.json']
      .map((name) => read(root, name));

    const second = syncWorkspace({ root, install: null });
    expect(second.reconciled).toEqual([]);
    expect(second.seeded).toEqual([]);
    expect(second.warnings).toEqual([]);
    expect(['AGENTS.md', 'AUTHORING.md', 'tsconfig.json', '.mcp.json', 'package.json']
      .map((name) => read(root, name))).toEqual(first);
  });

  /**
   * O `CLAUDE.md` era cópia byte a byte do `AGENTS.md`, e o efeito era o pior dos dois mundos: o
   * escritório não tinha onde escrever nada — o `--force` apagaria — e o arquivo não era atualizado
   * por ninguém. Agora um é gerado e o outro é dele.
   */
  it('nunca sobrescreve o que é do escritório', () => {
    const root = seed();
    syncWorkspace({ root, install: null });

    writeFileSync(join(root, 'CLAUDE.md'), '@AGENTS.md\n\nOur ids are br.com.acme.*\n');
    writeFileSync(join(root, 'README.md'), 'Ask Ana about the billing extension.\n');
    mkdirSync(join(root, 'br.com.acme.billing'), { recursive: true });
    writeFileSync(join(root, 'br.com.acme.billing/plugin.ts'), 'export default {};\n');

    const report = syncWorkspace({ root, install: null });

    expect(report.seeded).toEqual([]);
    expect(read(root, 'CLAUDE.md')).toContain('Our ids are br.com.acme.*');
    expect(read(root, 'README.md')).toBe('Ask Ana about the billing extension.\n');
    expect(existsSync(join(root, 'br.com.acme.billing/plugin.ts')).valueOf()).toBe(true);
  });

  /** O que é gerado é gerado: uma edição ali se perde, e é por isso que o arquivo o diz em voz alta. */
  it('reescreve o gerado mesmo que alguém o tenha editado', () => {
    const root = seed();
    syncWorkspace({ root, install: null });
    writeFileSync(join(root, 'AGENTS.md'), 'edited by hand\n');

    syncWorkspace({ root, install: null });
    expect(read(root, 'AGENTS.md')).toContain('Generated by Microteia');
  });

  /**
   * A lista de módulos curados sai do `.d.ts` INSTALADO, não de uma prosa. `hostApiTypeDefs.test.ts`
   * cobra que aquele arquivo concorda com `HOST_MODULES` símbolo por símbolo — então ler o `.d.ts` é
   * ler o kernel com um teste no meio.
   */
  it('a lista de módulos curados vem do .d.ts do SDK instalado', () => {
    const root = seed();
    syncWorkspace({ root, install: null });

    for (const document of ['AGENTS.md', 'AUTHORING.md']) {
      expect(read(root, document), document).toContain('- `@microteia/ui`');
      expect(read(root, document), document).toContain('- `@microteia/data`');
      // O fixture declara dois módulos; um terceiro real não pode aparecer por estar escrito à mão.
      expect(read(root, document), document).not.toContain('- `@microteia/settings`');
    }
  });

  describe('o package.json, que tem dono compartilhado', () => {
    it('carimba o contrato e acrescenta os scripts do SDK', () => {
      const root = seed();
      const report = syncWorkspace({ root, install: null });
      const pkg = JSON.parse(read(root, 'package.json')) as {
        scripts: Record<string, string>;
        microteia: { kernelVersion: string };
      };

      expect(report.reconciled).toContain('package.json');
      expect(pkg.microteia.kernelVersion).toBe(KERNEL_VERSION);
      expect(pkg.scripts.check).toBe('microteia-plugin check');
      expect(pkg.scripts.sync).toBe('microteia-plugin sync');
    });

    /** O caminho do tarball já está na dependência; recebê-lo de novo seria uma segunda verdade. */
    it('monta o sdk:refresh com o caminho que a dependência declara', () => {
      const root = seed();
      syncWorkspace({ root, install: null });
      const pkg = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> };
      expect(pkg.scripts['sdk:refresh']).toContain('../.microteia/install/sdk/microteia-sdk.tgz');
    });

    /**
     * Uma devDependency que já existe NUNCA é rebaixada: ela pode ter sido subida de propósito, e um
     * `sync` que a puxasse para trás transformaria manutenção de documento em quebra de build.
     */
    it('acrescenta o que falta e não rebaixa o que o escritório escolheu', () => {
      const root = seed({ devDependencies: { typescript: '^5.99.0', 'some-lib': '^1.0.0' } });
      syncWorkspace({ root, install: null });
      const pkg = JSON.parse(read(root, 'package.json')) as { devDependencies: Record<string, string> };

      expect(pkg.devDependencies.typescript).toBe('^5.99.0');
      expect(pkg.devDependencies['some-lib']).toBe('^1.0.0');
      expect(pkg.devDependencies.vitest).toBeDefined();
    });

    it('preserva um script do escritório e não o confunde com um nosso', () => {
      const root = seed();
      syncWorkspace({ root, install: null });
      const pkg = JSON.parse(read(root, 'package.json')) as Record<string, unknown>;
      (pkg.scripts as Record<string, string>).deploy = './scripts/ours.sh';
      writeFileSync(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

      syncWorkspace({ root, install: null });
      const after = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> };
      expect(after.scripts.deploy).toBe('./scripts/ours.sh');
      expect(after.scripts.check).toBe('microteia-plugin check');
    });

    /**
     * A tentação de "consertar" um script nosso que mudou de forma é grande e é errada: daqui não há
     * como distinguir "o autor customizou" de "nós escrevemos isto numa versão anterior". Entre
     * desfazer trabalho dele em silêncio e pedir o ajuste com o valor certo na mão, só a segunda não
     * perde nada.
     */
    it('não sobrescreve um script NOSSO que o autor mudou — avisa, com os dois valores', () => {
      const root = seed();
      syncWorkspace({ root, install: null });
      const pkg = JSON.parse(read(root, 'package.json')) as Record<string, unknown>;
      (pkg.scripts as Record<string, string>).test = 'vitest run --coverage';
      writeFileSync(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

      const report = syncWorkspace({ root, install: null });
      const after = JSON.parse(read(root, 'package.json')) as { scripts: Record<string, string> };
      expect(after.scripts.test).toBe('vitest run --coverage');
      expect(report.warnings).toHaveLength(1);
      expect(report.warnings[0]).toContain('"test"');
      expect(report.warnings[0]).toContain('vitest run --coverage');
    });
  });

  /**
   * Os exemplos são NOSSOS, e ficar com a versão de dois pacotes atrás ao lado de uma instalação nova é
   * pior que não os ter — eles são a referência que o autor copia.
   */
  describe('os exemplos de primeira parte', () => {
    it('são copiados do pacote instalado, e a lista sai do disco', () => {
      const root = seed({ examples: ['calendar', 'news'] });
      const report = syncWorkspace({ root, install: join(root, 'install') });

      expect(report.examples).toBe(2);
      expect(existsSync(join(root, 'examples/calendar/plugin.ts'))).toBe(true);
      expect(read(root, 'README.md')).toContain('`examples/calendar/`');
      expect(read(root, 'README.md')).toContain('`examples/news/`');
    });

    it('são substituídos, e o que saiu do pacote desaparece', () => {
      const root = seed({ examples: ['calendar'] });
      syncWorkspace({ root, install: join(root, 'install') });
      mkdirSync(join(root, 'examples/removed'), { recursive: true });

      const report = syncWorkspace({ root, install: join(root, 'install') });
      expect(report.examples).toBe(1);
      expect(existsSync(join(root, 'examples/removed'))).toBe(false);
    });

    it('um pacote sem exemplos não deixa o diretório num estado ruim', () => {
      const root = seed();
      const report = syncWorkspace({ root, install: null });
      expect(report.examples).toBe(0);
      expect(read(root, 'README.md')).toContain('carries no examples');
    });
  });

  /**
   * `firebase-functions` e `firebase-admin` são pesadas, e quem só declara telas não precisa delas. Mas
   * uma `functions/` em `examples/` é compilada pelo mesmo `tsc` do autor, e o `sync` a copiava sem
   * declarar o que ela importa: sete erros num arquivo que não era dele, em todo workspace.
   */
  describe('as dependências de uma Cloud Function', () => {
    type Pkg = { devDependencies: Record<string, string> };

    const withFunctionExample = (root: string): void => {
      const dir = join(root, 'install/sdk/examples/backend-example/functions');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'index.ts'), 'export {};\n');
      mkdirSync(join(root, 'install/functions'), { recursive: true });
      writeFileSync(join(root, 'install/functions/package.json'), JSON.stringify({
        dependencies: { 'firebase-admin': '^12.7.0', 'firebase-functions': '^6.3.0' },
      }));
    };

    it('entram quando um exemplo traz function, nas versões da INSTALAÇÃO', () => {
      const root = seed({ examples: ['calendar'] });
      withFunctionExample(root);
      syncWorkspace({ root, install: join(root, 'install') });

      const pkg = JSON.parse(read(root, 'package.json')) as Pkg;
      expect(pkg.devDependencies['firebase-functions']).toBe('^6.3.0');
      expect(pkg.devDependencies['firebase-admin']).toBe('^12.7.0');
    });

    it('entram quando uma extensão do escritório tem function', () => {
      const root = seed();
      mkdirSync(join(root, 'acme/functions'), { recursive: true });
      writeFileSync(join(root, 'acme/functions/index.ts'), 'export {};\n');
      syncWorkspace({ root, install: null });

      const pkg = JSON.parse(read(root, 'package.json')) as Pkg;
      expect(pkg.devDependencies['firebase-functions']).toBeDefined();
      expect(pkg.devDependencies['firebase-admin']).toBeDefined();
    });

    it('ficam de fora quando não há function nenhuma', () => {
      const root = seed({ examples: ['calendar'] });
      syncWorkspace({ root, install: join(root, 'install') });

      const pkg = JSON.parse(read(root, 'package.json')) as Pkg;
      expect(pkg.devDependencies['firebase-functions']).toBeUndefined();
      expect(pkg.devDependencies['firebase-admin']).toBeUndefined();
    });

    it('não rebaixam uma versão que o escritório já declarou', () => {
      const root = seed({ examples: ['calendar'], devDependencies: { 'firebase-functions': '^6.9.0' } });
      withFunctionExample(root);
      syncWorkspace({ root, install: join(root, 'install') });

      const pkg = JSON.parse(read(root, 'package.json')) as Pkg;
      expect(pkg.devDependencies['firebase-functions']).toBe('^6.9.0');
      expect(pkg.devDependencies['firebase-admin']).toBe('^12.7.0');
    });
  });

  /**
   * Vista de fora: o autor mexeu na configuração, e a atualização de plataforma não desfaz nada. É a
   * propriedade que separa este `sync` de uma sobreposição — e a razão de ele poder rodar sozinho.
   */
  describe('a configuração em que o autor escreve', () => {
    it('mantém o path e o servidor MCP que ele acrescentou', () => {
      const root = seed();
      syncWorkspace({ root, install: null });

      const tsconfig = JSON.parse(read(root, 'tsconfig.json')) as {
        compilerOptions: { paths: Record<string, string[]>; strict: boolean };
      };
      tsconfig.compilerOptions.paths['@acme/shared'] = ['./shared/index.ts'];
      tsconfig.compilerOptions.strict = false;
      writeFileSync(join(root, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);

      const mcp = JSON.parse(read(root, '.mcp.json')) as { mcpServers: Record<string, unknown> };
      mcp.mcpServers.github = { command: 'npx', args: ['-y', 'server-github'] };
      writeFileSync(join(root, '.mcp.json'), `${JSON.stringify(mcp, null, 2)}\n`);

      writeFileSync(join(root, '.gitignore'), `${read(root, '.gitignore')}.env.local\n`);

      const report = syncWorkspace({ root, install: null });

      const after = JSON.parse(read(root, 'tsconfig.json')) as {
        compilerOptions: { paths: Record<string, string[]>; strict: boolean };
      };
      expect(after.compilerOptions.paths['@acme/shared']).toEqual(['./shared/index.ts']);
      expect(after.compilerOptions.strict).toBe(false);
      expect((JSON.parse(read(root, '.mcp.json')) as { mcpServers: Record<string, unknown> })
        .mcpServers.github).toEqual({ command: 'npx', args: ['-y', 'server-github'] });
      expect(read(root, '.gitignore')).toContain('.env.local');
      expect(report.warnings).toEqual([]);
    });

    it('acrescenta o que ele apagou sem querer, e só isso', () => {
      const root = seed();
      syncWorkspace({ root, install: null });

      writeFileSync(join(root, 'tsconfig.json'), `${JSON.stringify({
        compilerOptions: { strict: true, paths: { '@acme/shared': ['./shared/index.ts'] } },
      }, null, 2)}\n`);

      const report = syncWorkspace({ root, install: null });
      expect(report.reconciled).toContain('tsconfig.json');

      const after = JSON.parse(read(root, 'tsconfig.json')) as {
        compilerOptions: { paths: Record<string, string[]>; jsx: string; strict: boolean };
        files: string[];
      };
      expect(after.compilerOptions.paths['@microteia/*']?.[0]).toContain('microteia-host.d.ts');
      expect(after.compilerOptions.paths['@acme/shared']).toEqual(['./shared/index.ts']);
      expect(after.compilerOptions.jsx).toBe('react-jsx');
      expect(after.compilerOptions.strict).toBe(true);
      expect(after.files[0]).toContain('microteia-raw.d.ts');
    });

    it('divergência não é resolvida por nós: fica como está, e o aviso sai no relatório', () => {
      const root = seed();
      syncWorkspace({ root, install: null });

      const tsconfig = JSON.parse(read(root, 'tsconfig.json')) as {
        compilerOptions: { paths: Record<string, string[]> };
      };
      tsconfig.compilerOptions.paths['@microteia/*'] = ['./meu/lugar.d.ts'];
      writeFileSync(join(root, 'tsconfig.json'), `${JSON.stringify(tsconfig, null, 2)}\n`);

      const report = syncWorkspace({ root, install: null });
      expect(report.reconciled).not.toContain('tsconfig.json');
      expect(report.warnings.some((warning) => warning.includes('./meu/lugar.d.ts'))).toBe(true);

      const after = JSON.parse(read(root, 'tsconfig.json')) as {
        compilerOptions: { paths: Record<string, string[]> };
      };
      expect(after.compilerOptions.paths['@microteia/*']).toEqual(['./meu/lugar.d.ts']);
    });
  });

  /** O nome só aparece nas duas sementes, e um `sync` manual não tem como saber — o `package.json` sabe. */
  /**
   * O `CLAUDE.md` já foi cópia byte a byte do `AGENTS.md`. Como ele é semeado, aquelas instalações
   * carregam a cópia até hoje — descrevendo o contrato do kernel de quando nasceram, dentro do arquivo
   * que um assistente lê como instrução. Não é nosso para consertar; é nosso para dizer.
   */
  describe('o CLAUDE.md que ficou sendo cópia de um AGENTS.md antigo', () => {
    it('é apontado no relatório, e continua intacto', () => {
      const root = seed();
      writeFileSync(join(root, 'CLAUDE.md'), '# Extensions\n\nKernel contract: 1.4.0.\n');

      const report = syncWorkspace({ root, install: null });

      expect(report.seeded).not.toContain('CLAUDE.md');
      expect(read(root, 'CLAUDE.md')).toContain('Kernel contract: 1.4.0.');
      expect(report.warnings.join(' ')).toContain('CLAUDE.md');
    });

    it('e o CLAUDE.md atual, que só importa o AGENTS.md, não gera aviso nenhum', () => {
      const root = seed();
      const report = syncWorkspace({ root, install: null });

      expect(report.seeded).toContain('CLAUDE.md');
      expect(syncWorkspace({ root, install: null }).warnings).toEqual([]);
      expect(report.warnings).toEqual([]);
    });
  });

  it('deduz o nome do escritório quando ninguém o informa', () => {
    const root = seed();
    syncWorkspace({ root, install: null });
    expect(read(root, 'CLAUDE.md')).toContain('# Extensions — acme');
  });

  it('e prefere o nome que o Console informa, que é o de verdade', () => {
    const root = seed();
    syncWorkspace({ root, install: null, officeName: 'Acme Advogados' });
    expect(read(root, 'CLAUDE.md')).toContain('Acme Advogados');
  });
});

describe('o namespace do diretório', () => {
  it('sobrevive ao carimbo do contrato — o sync acrescenta, nunca troca a chave inteira', () => {
    const root = seed();
    syncWorkspace({ root, install: null });
    const pkg = JSON.parse(read(root, 'package.json')) as { microteia: Record<string, unknown> };
    expect(pkg.microteia).toEqual({ namespace: 'com.acme', kernelVersion: KERNEL_VERSION });
  });

  /** Diretório anterior ao namespace: o sync não inventa um, porque o id que nasce dele é permanente. */
  it('avisa quando falta, sem gravar nenhum', () => {
    const root = seed({ namespace: null });
    const report = syncWorkspace({ root, install: null });
    expect(report.warnings.join(' ')).toContain('microteia.namespace');
    const pkg = JSON.parse(read(root, 'package.json')) as { microteia: Record<string, unknown> };
    expect(pkg.microteia.namespace).toBeUndefined();
  });

  it('avisa quando está fora do formato', () => {
    const root = seed({ namespace: 'Acme' });
    expect(syncWorkspace({ root, install: null }).warnings.join(' ')).toContain('"Acme" is not a valid namespace');
  });
});
