import { describe, expect, it } from 'vitest';
import { PACKAGE_ADVISORY_BYTES, PACKAGE_MAX_BYTES } from '../../../domain/usecases/plugins/pluginReferences';
import { UI_EXTENSION_POINTS } from '../../../domain/schema/ui/uiExtensionPoints';
import { authoringGuide } from './authoringGuide';
import {
  workspaceGitignore,
  workspaceMcpJson,
  workspaceTsconfig,
} from './reconcile';
import {
  workspaceAgentsMd,
  workspaceClaudeMd,
  workspaceReadme,
  workspaceScripts,
} from './templates';

/**
 * O diretório `extensions/` é lido por quem escreve extensão — pessoa ou IA — e um defeito num destes
 * arquivos não aparece na hora: aparece meses depois, quando alguém não consegue compilar uma view ou
 * escreve contra um contrato que a instalação já não tem. Daí cada caso existir por uma armadilha
 * concreta, não por cobertura.
 *
 * O grupo do fim é novo e é o motivo desta mudança: o que estes textos afirmam sobre o kernel tem de
 * VIR do kernel. Três listas eram prosa escrita à mão, e acrescentar um módulo curado ou mexer num
 * limite de tamanho deixava as três desatualizadas sem reprovar em nada.
 */
const AGENTS = {
  kernelVersion: '1.5.0',
  hostModules: ['@microteia/ui', 'react'],
  advisoryBytes: 400 * 1024,
  maxBytes: 800 * 1024,
};

describe('o que é gerado em extensions/', () => {
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
     * O `?raw` é o import mais importante de um `plugin.ts` — é como a fonte de uma view mora num
     * arquivo checado. A declaração dele é AMBIENTE e vive em `node_modules`, que o `exclude` descarta;
     * só entra pelo `files`, que não passa pelo `exclude`.
     */
    it('traz a declaração do ?raw por `files`, senão o import da view é erro', () => {
      const config = JSON.parse(workspaceTsconfig()) as { files?: string[] };
      expect(config.files?.[0]).toContain('microteia-raw.d.ts');
    });

    /**
     * Excluir `examples/` e os diretórios de function deixava aqueles arquivos FORA de todo projeto — e
     * um arquivo sem projeto não resolve nada no editor, nem `@microteia/data`. Tudo sublinhado é pior
     * que um erro honesto num import.
     */
    it('não exclui nada além de node_modules', () => {
      const config = JSON.parse(workspaceTsconfig()) as { exclude: string[] };
      expect(config.exclude).toEqual(['node_modules']);
    });

    /**
     * A fonte de uma view nasce como JavaScript — é avaliada pelo browser, não compilada. Exigir
     * anotação nela reprovaria os exemplos que viajam no pacote.
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

  /**
   * Trocar de kernel e continuar com o SDK anterior é o defeito mais silencioso deste diretório: as
   * extensões seguem compilando, contra um contrato que a instalação não tem mais.
   *
   * A causa é a soma de duas decisões corretas. O caminho do tarball não leva versão, para que um
   * kernel novo não obrigue ninguém a editar o `package.json`; e o `package-lock.json` guarda a VERSÃO
   * e a impressão digital do que foi instalado, para que dois computadores do mesmo escritório
   * instalem o mesmo. Juntas, fazem um tarball NOVO no MESMO caminho parecer "nada mudou" para o npm.
   */
  describe('trazer o SDK novo depois de trocar de kernel', () => {
    const scripts = workspaceScripts('../.microteia/install/sdk/microteia-sdk.tgz');

    it('instala o tarball PELO CAMINHO, forçando a resolução', () => {
      expect(scripts['sdk:refresh']).toContain('npm install ../.microteia/install/sdk/microteia-sdk.tgz');
    });

    /**
     * `--no-save` estava aqui e desfazia o próprio script. Ele extrai o pacote novo e deixa o
     * `package-lock.json` no anterior; o `npm install` seguinte — o deste script, ou um que alguém rode
     * meses depois — reinstala o antigo e reverte tudo em silêncio. Medido, não lido.
     */
    it('e SALVA no lock, senão o npm install seguinte reverte para o SDK antigo', () => {
      expect(scripts['sdk:refresh']).not.toContain('--no-save');
    });

    /** Trazer o SDK novo sem reescrever os guias deixava o diretório meio atualizado — o pior estado. */
    it('e sincroniza em seguida, senão os guias ficam na versão anterior', () => {
      expect(scripts['sdk:refresh']).toContain('microteia-plugin sync');
      expect(scripts.sync).toBe('microteia-plugin sync');
    });
  });

  describe('as instruções para quem escreve — pessoa ou IA', () => {
    const agents = workspaceAgentsMd(AGENTS);

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
     * extensão alterada não é reconhecida como atualização e não chega a quem já a tem instalada.
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

    /**
     * Ele é reescrito a cada troca de kernel, e antes disso era cópia byte a byte do `CLAUDE.md`. Quem
     * escrevesse uma linha ali a perdia — e nem sabia que perderia. O aviso é o que separa os dois.
     */
    it('avisa que é gerado e diz onde as notas do escritório ficam', () => {
      expect(agents).toContain('Generated by Microteia');
      expect(agents).toContain('CLAUDE.md');
    });

    /**
     * Três políticas, e a tabela tem de dizer as três — a confusão custa trabalho de verdade: quem
     * pensa que o `tsconfig.json` é sobreposto não põe um `path` dele ali, e quem pensa que o
     * `AGENTS.md` é editável escreve nele e perde.
     */
    it('distingue as três políticas: dele, reescrito, e dele-mas-completado', () => {
      expect(agents).toMatch(/`CLAUDE\.md`, `README\.md` \| yours/);
      expect(agents).toContain('Rewritten whole on the next platform version');
      expect(agents).toContain('yours to edit');
      expect(agents).toContain('never overwrites your settings');
    });
  });

  /**
   * O `CLAUDE.md` deixou de ser cópia do `AGENTS.md` e passou a ser o arquivo DO ESCRITÓRIO. Os dois
   * imports são o que mantém a regra gerada chegando ao assistente: sem eles, separar os arquivos
   * custaria a instrução em vez de ganhar um lugar para escrever.
   */
  describe('o arquivo do escritório', () => {
    const claude = workspaceClaudeMd('Acme');

    it('importa o gerado, para a regra continuar valendo', () => {
      expect(claude).toContain('@AGENTS.md');
      expect(claude).toContain('@AUTHORING.md');
    });

    it('diz que é do escritório e abre espaço para as notas dele', () => {
      expect(claude).toContain('This file is yours');
      expect(claude).toContain('Acme');
      expect(claude).toContain('## About this organization');
    });
  });

  describe('o manual de autoria', () => {
    const guide = authoringGuide(AGENTS);

    it('carimba a versão do contrato instalado, não uma genérica', () => {
      expect(guide).toContain('**1.5.0**');
      expect(guide).toContain('^1.5.0');
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

  describe('o README que o escritório recebe', () => {
    const readme = (examples: string[]): string =>
      workspaceReadme({ officeName: 'Acme', kernelVersion: '1.5.0', examples });

    it('descreve a pasta de uma extensão COM o VERSIONS.md', () => {
      expect(readme([])).toContain('VERSIONS.md');
      expect(readme([])).toContain('manifest.version');
    });

    /**
     * O texto tem de dizer o que NÃO fazer, e não só o que fazer: `npm install` é o comando que
     * qualquer pessoa tentaria, e é o que não funciona.
     */
    it('manda rodar o script e diz por que "npm install" não serve', () => {
      expect(readme([])).toContain('npm run sdk:refresh');
      expect(readme([])).toMatch(/Not `npm install`/);
    });

    /** O caminho normal deixou de ser manual: quem troca de kernel já sincroniza. */
    it('diz que o unpack já faz isso sozinho', () => {
      expect(readme([])).toContain('microteia unpack');
    });

    it('separa o que é do escritório do que é reescrito', () => {
      expect(readme([])).toContain('## Which files are yours');
      expect(readme([])).toMatch(/`CLAUDE\.md`, `README\.md` \| \*\*yours\.\*\*/);
    });

    /** Sem isto, ninguém sabe que pode acrescentar um `path` ou outro servidor MCP sem perdê-lo. */
    it('convida a editar a configuração e explica por que a divergência só é avisada', () => {
      expect(readme([])).toContain('you are meant to edit them');
      expect(readme([])).toContain('leaves it alone');
      expect(readme([])).toContain('undoing your work');
    });
  });
});

/**
 * O grupo que justifica a mudança: o que estes textos AFIRMAM sobre o kernel tem de vir do kernel.
 *
 * As três listas abaixo eram prosa escrita à mão em três arquivos diferentes (a descrição de
 * `describe_host_module`, a seção "Code" do `AGENTS.md` e a §6 do `AUTHORING.md`), e nada as ligava ao
 * código. Acrescentar um `@microteia/*` passava em tudo e deixava as três incompletas.
 */
describe('o que o texto afirma sobre o kernel vem do kernel', () => {
  it('a lista de módulos curados é a que foi passada, e não uma cópia escrita à mão', () => {
    const agents = workspaceAgentsMd({ ...AGENTS, hostModules: ['@microteia/inventado'] });
    expect(agents).toContain('- `@microteia/inventado`');
    // O que prova a derivação é a AUSÊNCIA: um módulo real que não foi passado não pode aparecer.
    expect(agents).not.toContain('@microteia/data');
  });

  it('o mesmo vale para o manual', () => {
    const guide = authoringGuide({ ...AGENTS, hostModules: ['@microteia/inventado'] });
    expect(guide).toContain('- `@microteia/inventado`');
    expect(guide).not.toContain('- `@microteia/data`');
  });

  /**
   * Os dois limites decidem o desenho de uma extensão antes de qualquer código, e estavam escritos
   * como "400 KiB" e "800 KiB" em dois arquivos. Mexer nas constantes deixava os dois textos mentindo.
   */
  it('os limites de tamanho saem das constantes que o kernel aplica', () => {
    const advisory = `${Math.round(PACKAGE_ADVISORY_BYTES / 1024)} KiB`;
    const max = `${Math.round(PACKAGE_MAX_BYTES / 1024)} KiB`;
    const input = {
      ...AGENTS,
      advisoryBytes: PACKAGE_ADVISORY_BYTES,
      maxBytes: PACKAGE_MAX_BYTES,
    };
    for (const text of [workspaceAgentsMd(input), authoringGuide(input)]) {
      expect(text).toContain(advisory);
      expect(text).toContain(max);
    }
  });

  /** Guarda que não dispara é pior que guarda nenhuma. */
  it('e o número seguiria a constante se ela mudasse', () => {
    const doubled = authoringGuide({ ...AGENTS, maxBytes: 1600 * 1024 });
    expect(doubled).toContain('1600 KiB');
    expect(doubled).not.toContain('| Refused | 800 KiB |');
  });

  /**
   * A tabela de pontos sai dos MESMOS arrays que o kernel valida contra — é o que o manual não tinha
   * como garantir enquanto morava no Console, que recebia uma cópia deles.
   */
  it('a tabela de pontos de extensão sai dos arrays do kernel', () => {
    const guide = authoringGuide(AGENTS);
    for (const point of UI_EXTENSION_POINTS) {
      expect(guide, point.id).toContain(`\`${point.id}\``);
    }
  });
});
