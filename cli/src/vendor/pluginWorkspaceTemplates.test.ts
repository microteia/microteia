import { describe, expect, it } from 'vitest';
import {
  SDK_TARBALL,
  workspaceAgentsMd,
  workspaceGitignore,
  workspaceMcpJson,
  workspacePackageJson,
  workspaceReadme,
  workspaceTsconfig,
} from './pluginWorkspaceTemplates.js';
import { authoringGuide } from './authoringGuide.js';

/**
 * O diretório `extensions/` é escrito UMA vez e depois versionado pelo escritório. Um defeito num
 * destes arquivos não aparece na hora: aparece meses depois, quando alguém não consegue compilar uma
 * view ou compila contra o SDK de duas versões atrás. Daí cada caso aqui existir por uma armadilha
 * concreta, não por cobertura.
 */
describe('o workspace de autoria de extensões', () => {
  const parsed = (): Record<string, unknown> =>
    JSON.parse(workspacePackageJson('acme', `../.microteia/install/sdk/${SDK_TARBALL}`, '1.3.0')) as Record<string, unknown>;

  it('aponta o SDK por caminho SEM versão — o upgrade não pode exigir edição à mão', () => {
    const dependencies = parsed().dependencies as Record<string, string>;
    expect(dependencies['@microteia/sdk']).toBe(`file:../.microteia/install/sdk/${SDK_TARBALL}`);
    expect(SDK_TARBALL).not.toMatch(/\d/);
  });

  it('registra a versão do contrato, para o autor saber contra o que escreveu', () => {
    expect(parsed().microteia).toEqual({ kernelVersion: '1.3.0' });
  });

  it('é privado: o diretório do escritório não é um pacote a publicar', () => {
    expect(parsed().private).toBe(true);
  });

  /**
   * Sem o `paths`, o `tsc` diz "cannot find module '@microteia/ui'" no import mais importante de uma
   * view — os módulos curados NÃO existem em `node_modules`, são resolvidos pelo runtime do browser.
   * É a armadilha central de autorar view como arquivo em vez de string.
   */
  describe('tsconfig', () => {
    const options = (): Record<string, unknown> =>
      (JSON.parse(workspaceTsconfig()) as { compilerOptions: Record<string, unknown> }).compilerOptions;

    it('mapeia os módulos curados para os tipos do SDK', () => {
      const paths = options().paths as Record<string, string[]>;
      for (const key of ['@microteia/*', 'react', 'styled-components']) {
        expect(paths[key]?.[0], key).toContain('microteia-host.d.ts');
      }
      expect(paths['@microteia/sdk']?.[0]).toContain('lib/sdk/index.d.ts');
    });

    it('os mapeamentos do SDK vêm ANTES do curinga, senão o curinga os engole', () => {
      const keys = Object.keys(options().paths as Record<string, unknown>);
      const wildcard = keys.indexOf('@microteia/*');
      expect(keys.indexOf('@microteia/sdk')).toBeLessThan(wildcard);
      expect(keys.indexOf('@microteia/sdk/node')).toBeLessThan(wildcard);
    });

    /** O compilador é o que o teste de uma extensão importa para validar o `.json` de verdade. */
    it('mapeia @microteia/sdk/node para o compilador', () => {
      const paths = options().paths as Record<string, string[]>;
      expect(paths['@microteia/sdk/node']?.[0]).toContain('node/compile.d.ts');
    });

    /**
     * Os três defeitos de lint que apareceram no workspace de verdade, e a causa de cada um.
     *
     * O `?raw` é o import mais importante de um `plugin.ts` — é como a fonte de uma view mora num arquivo
     * checado. A declaração dele é AMBIENTE e vive em `node_modules`, que o `exclude` descarta; só entra
     * pelo `files`, que não passa pelo `exclude`.
     */
    it('traz a declaração do ?raw por `files`, senão o import da view é erro', () => {
      const config = JSON.parse(workspaceTsconfig()) as { files?: string[] };
      expect(config.files?.[0]).toContain('microteia-raw.d.ts');
    });

    /**
     * Excluir `examples/` e os diretórios de function deixava aqueles arquivos FORA de todo projeto — e um
     * arquivo sem projeto não resolve nada no editor, nem `@microteia/data`. Tudo sublinhado é pior que um
     * erro honesto num import.
     */
    it('não exclui nada além de node_modules', () => {
      const config = JSON.parse(workspaceTsconfig()) as { exclude: string[] };
      expect(config.exclude).toEqual(['node_modules']);
    });

    /**
     * A fonte de uma view nasce como JavaScript — é avaliada pelo browser, não compilada. Exigir anotação
     * nela reprovaria os doze exemplos que viajam no pacote.
     */
    it('afrouxa implicit-any e null-checks, que é o que a fonte de view exige', () => {
      expect(options().noImplicitAny).toBe(false);
      expect(options().strictNullChecks).toBe(false);
      expect(options().strict).toBe(true);
    });

    it('compila JSX e não emite nada — a saída é o .json, não JavaScript', () => {
      expect(options().jsx).toBe('react-jsx');
      expect(options().noEmit).toBe(true);
    });

    it('é estrito: a razão de escrever em TypeScript é o erro aparecer aqui', () => {
      expect(options().strict).toBe(true);
    });
  });

  /**
   * O `.json` gerado é artefato e não deve ser versionado — mas os quatro arquivos de configuração
   * TÊM de ser, senão quem clonar o diretório não consegue compilar.
   */
  it('o .gitignore descarta os .json gerados e preserva a configuração', () => {
    const lines = workspaceGitignore().split('\n');
    expect(lines).toContain('*.json');
    for (const keep of ['!package.json', '!package-lock.json', '!tsconfig.json', '!.mcp.json']) {
      expect(lines).toContain(keep);
    }
  });

  /**
   * Com `npx`, um `node_modules` ainda não instalado manda a chamada ao registry público, que volta com
   * "404 Not Found" — como se a ferramenta nunca tivesse existido.
   */
  it('registra o servidor MCP apontando para o arquivo, nunca para o registry', () => {
    const config = JSON.parse(workspaceMcpJson()) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(config.mcpServers.microteia.command).toBe('node');
    expect(config.mcpServers.microteia.args).toContain('mcp');
    expect(config.mcpServers.microteia.args[0]).toContain('@microteia/sdk');
    expect(config.mcpServers.microteia.args).not.toContain('-y');
  });

  describe('as instruções para quem escreve — pessoa ou IA', () => {
    const agents = workspaceAgentsMd('1.3.0');

    it('nomeia o gate, que é o único jeito de saber se o pacote instala', () => {
      expect(agents).toContain('microteia-plugin check');
      expect(agents).toContain('tsc --noEmit');
    });

    it('proíbe editar o .json gerado e a instalação', () => {
      expect(agents).toContain('Never hand-edit');
      expect(agents).toContain('.microteia/');
    });

    it('diz que o código não roda até alguém confiar nele', () => {
      expect(agents).toMatch(/trust/i);
    });

    it('exige que texto de usuário nasça como referência de mensagem', () => {
      expect(agents).toContain('@com.example.hello/field.title');
    });

    /**
     * A regra que uma IA mais deixa passar: mudar a extensão e não subir a versão. Sem versão nova, a
     * extensão alterada não é reconhecida como atualização e não chega a quem já a tem instalada — o
     * trabalho fica feito no diretório e ausente no escritório.
     */
    it('manda subir a versão e escrever a entrada do VERSIONS.md na mesma alteração', () => {
      expect(agents).toContain('manifest.version');
      expect(agents).toContain('VERSIONS.md');
      expect(agents).toMatch(/semver/i);
    });

    it('diz que a entrada é para quem USA a extensão, e não é a mensagem de commit', () => {
      expect(agents).toContain('not the commit message');
    });

    /** Subir a versão é parte da alteração; a única saída é o próprio autor pedir que não suba. */
    it('deixa a exceção explícita: só não sobe a versão se pedirem que não suba', () => {
      expect(agents).toContain('The only exception is being');
    });

    it('manda escrever teste sempre que der, e nomeia o comando', () => {
      expect(agents).toContain('## Tests');
      expect(agents).toContain('npm test');
      expect(agents).toContain('plugin.test.ts');
    });

    /**
     * "Pronto, só falta um teste" é o relatório que este parágrafo existe para proibir: o gate não é
     * um conselho, e teste vermelho não é ressalva de entrega.
     */
    it('proíbe dar a tarefa por concluída com teste falhando', () => {
      expect(agents).toContain('A failing test means the task is not done.');
      expect(agents).toContain('all three of these pass');
    });
  });

  describe('o manual de autoria', () => {
    const guide = authoringGuide(
      '1.3.0',
      [{ id: 'ui.page', apiVersion: '1.0.0', allowedImplKinds: ['code', 'widget'], multiple: true }],
      ['@microteia/ui', 'react'],
    );

    it('carimba a versão do contrato instalado, não uma genérica', () => {
      expect(guide).toContain('**1.3.0**');
      expect(guide).toContain('^1.3.0');
    });

    it('lista os pontos que o SDK instalado realmente publica', () => {
      expect(guide).toContain('`ui.page`');
      expect(guide).toContain('`code`');
    });

    it('lista exatamente os módulos que o runtime resolve', () => {
      expect(guide).toContain('- `@microteia/ui`');
      expect(guide).toContain('- `react`');
    });

    /**
     * A CLI manda o autor ler `AUTHORING.md, "Code trust"` depois de gerar um pacote com código, e a
     * busca por seção do MCP casa pelo título. Um título que não contenha o termo faz as duas pontas
     * apontarem para o vazio — foi o que aconteceu.
     */
    it('a seção de confiança de código se chama pelo termo que a CLI e o MCP usam', () => {
      expect(guide).toContain('Code trust');
    });

    it('registra a rotina de versão junto da identidade, que é onde se procura por ela', () => {
      expect(guide).toContain('VERSIONS.md');
      expect(guide).toContain('raises `manifest.version`');
    });

    it('explica os limites de tamanho, que decidem o desenho antes de qualquer código', () => {
      expect(guide).toContain('400 KiB');
      expect(guide).toContain('800 KiB');
    });

    /**
     * `AuthoredPlugin` e `MarketplacePlugin` diferem em um ponto só — `sourceFile` — e é o ponto que o
     * autor usa no primeiro minuto. Apontar o tipo errado faz o `tsc` acusar exatamente a linha que o
     * molde ensinou a escrever.
     */
    it('manda escrever contra AuthoredPlugin, que é o tipo que aceita sourceFile', () => {
      expect(guide).toContain('AuthoredPlugin');
      expect(guide).toContain('satisfies AuthoredPlugin');
    });
  });

  it('o README manda rodar npm install depois de cada deploy — é o que casa SDK e instalação', () => {
    expect(workspaceReadme('Acme', '1.3.0')).toContain('npm install');
  });

  it('o README descreve a pasta de uma extensão COM o VERSIONS.md', () => {
    const readme = workspaceReadme('Acme', '1.3.0');
    expect(readme).toContain('VERSIONS.md');
    expect(readme).toContain('manifest.version');
  });
});

/**
 * Trocar de kernel e continuar com o SDK anterior é o defeito mais silencioso deste diretório: as
 * extensões seguem compilando, contra um contrato que a instalação não tem mais.
 *
 * A causa é a soma de duas decisões corretas. O caminho do tarball não leva versão, para que um kernel
 * novo não obrigue ninguém a editar o `package.json`; e o `package-lock.json` guarda a VERSÃO e a
 * impressão digital do que foi instalado, para que dois computadores do mesmo escritório instalem o
 * mesmo. Juntas, elas fazem um tarball NOVO no MESMO caminho parecer "nada mudou" para o npm — que diz
 * "up to date" e mantém o SDK anterior.
 */
describe('trazer o SDK novo depois de trocar de kernel', () => {
  const parsed = (): {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
  } => JSON.parse(workspacePackageJson('acme', '../.microteia/install/sdk/microteia-sdk.tgz', '1.5.0')) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
  };

  it('há um script que instala o tarball PELO CAMINHO, forçando a resolução', () => {
    expect(parsed().scripts['sdk:refresh'])
      .toBe('npm install --no-save ../.microteia/install/sdk/microteia-sdk.tgz');
  });

  /** Sem versão no caminho, um kernel novo não obriga ninguém a editar este arquivo. */
  it('e a dependência continua apontando para o caminho SEM versão', () => {
    expect(parsed().dependencies['@microteia/sdk'])
      .toBe('file:../.microteia/install/sdk/microteia-sdk.tgz');
  });

  /**
   * O texto tem de dizer o que NÃO fazer, e não só o que fazer: `npm install` é o comando que qualquer
   * pessoa tentaria, é o que este README mandava, e é o que não funciona.
   */
  it('o README manda rodar o script e diz por que "npm install" não serve', () => {
    const readme = workspaceReadme('Acme', '1.5.0');
    expect(readme).toContain('npm run sdk:refresh');
    expect(readme).toMatch(/Not `npm install`/);
  });
});
