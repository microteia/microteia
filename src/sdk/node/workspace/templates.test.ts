import { describe, expect, it } from 'vitest';
import { PACKAGE_ADVISORY_BYTES, PACKAGE_MAX_BYTES } from '../../../domain/usecases/plugins/pluginReferences';
import { UI_EXTENSION_POINTS } from '../../../domain/schema/ui/uiExtensionPoints';
import { ACCESS_EXTENSION_POINTS } from '../../../domain/schema/access';
import * as SDK from '../../index';
import * as SDK_NODE from '../compile';
import { CUSTOM_FIELD_TYPES } from '../../../domain/schema/fieldRules';
import { WIDGET_NODE_TYPES } from '../../../domain/schema/ui/widgetSpec';
import { STEP_TYPES } from '../../../domain/entities/Workflow';
import { FIELD_EXPRESSION_FUNCTION_NAMES } from '../../../domain/schema/fieldExpression';
import { CORE_STEP_CATALOG } from '../../../domain/schema/workflowStepCatalog';
import { RECORD_ACTION_COMMANDS } from '../../../domain/schema/ui/recordActionMetadata';
import {
  DOMAIN_ISSUE_CODES,
  EMBEDDED_STRATEGY,
  RULE_LEDGER_FILE,
  SCREEN_IS_NOT_AN_ENTITY_MODEL,
  SCREEN_PLAN_HUMAN_DECISIONS,
  SCREEN_SOURCE_ID_PRECEDENCE,
  SCREEN_PLAN_RULES,
  STORAGE_MECHANISMS,
  coverageGaps,
  coverageSummary,
} from '../../domain';
import { MULTI_FK_MATERIALIZE_LIMIT } from '../../../domain/schema/materialize';
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
  steps: CORE_STEP_CATALOG,
  recordCommands: RECORD_ACTION_COMMANDS,
};

/**
 * A tabela do catálogo de passos é DERIVADA, e este teste é o que a mantém assim.
 *
 * Ela era um parágrafo dizendo que o catálogo "não pode ser enumerado a partir daqui" — a única
 * capacidade grande do kernel sobre a qual o guia escrevia prosa em vez de tabela, e não por acaso a
 * que os autores de extensão mais erravam. Uma tabela derivada sem teste voltaria a ficar incompleta
 * do mesmo jeito: o passo entra no kernel, a linha não entra no guia, e nada acusa.
 */
describe('a tabela do catálogo de passos', () => {
  it('nomeia todos os passos do kernel, e nenhum a mais', () => {
    const guide = authoringGuide(AGENTS);
    for (const step of CORE_STEP_CATALOG) {
      expect(guide, `o passo "${step.id}" não está na tabela do guia`).toContain(`| \`${step.id}\` |`);
    }
  });

  it('cada passo chega com uma linha explicando o que ele faz', () => {
    const guide = authoringGuide(AGENTS);
    for (const step of CORE_STEP_CATALOG) {
      const linha = guide.split('\n').find((one) => one.startsWith(`| \`${step.id}\` |`)) ?? '';
      const [, , descricao] = linha.split('|');
      expect(descricao?.trim(), `o passo "${step.id}" está na tabela sem descrição`).not.toBe('');
    }
  });

  /**
   * `QuerySpec` era publicado pelo SDK e o passo `query` de fato o recebe, então quem aprendia o
   * `query` generalizava para o `upsert` e escrevia `UpsertSpec` — que não é o que o passo lê. O guia
   * tem de dizer os dois nomes, lado a lado.
   */
  it('diz que o input composto NÃO é o `Spec` de nome parecido', () => {
    const guide = authoringGuide(AGENTS);
    expect(guide).toContain('UpsertStepConfig');
    expect(guide).toContain('RemoveStepConfig');
    expect(guide).toContain('MapStepConfig');
    expect(guide).toContain('ValidateStepConfig');
  });

  /** `op: '=='` cai no `switch` do motor sem `default` e a consulta devolve zero linhas, em silêncio. */
  it('dá os operadores de consulta pelo NOME, não pelo símbolo', () => {
    const guide = authoringGuide(AGENTS);
    expect(guide).toMatch(/`eq`, `neq`/);
    expect(guide).not.toMatch(/op: '=='/);
  });

  /** O guia prometia que `Delay` espera. Ele não é registrado no motor, e o fluxo para nele. */
  it('não promete que Delay funciona', () => {
    expect(authoringGuide(AGENTS)).toMatch(/`Delay` \| \*\*Not implemented in this version\.\*\*/);
  });
});

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
     * A escada de custo dizia para NÃO escrever código, e o texto parava aí — então, na hora em que
     * escrever era mesmo a resposta, a instrução calava e o que saía era um `.view.tsx` de oitocentas
     * linhas com `useState`, cor em hexadecimal e regra nenhuma que um teste alcance.
     */
    it('diz a forma do código quando código é o que resta: os três arquivos e a regra fora do componente', () => {
      expect(agents).toContain('`.view.tsx`');
      expect(agents).toContain('`.viewmodel.tsx`');
      expect(agents).toContain('`.styles.tsx`');
      expect(agents).toContain('importing nothing, with a test beside it');
    });

    it('proíbe cor e medida literais, e divide a Cloud Function do mesmo jeito', () => {
      expect(agents).toContain('never from a hex');
      expect(agents).toContain('the handler refuses the unauthenticated call');
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
     * A extensão que precisa de algo que o kernel não tem sempre tem como fingir — e a IA finge, porque
     * fingir destrava a tarefa. Aconteceu com `isNew` na expressão de campo: agnóstico, necessário a
     * qualquer formulário, contornado em silêncio. O contorno some no código de uma extensão e o kernel
     * nunca fica sabendo o que lhe falta.
     */
    describe('a limitação do kernel que vale interromper', () => {
      it('manda parar e pedir autorização antes de contornar', () => {
        expect(agents).toContain('## When the platform is missing something');
        expect(agents).toContain('**Stop and ask.**');
      });

      /** Sem os dois lados, a regra vira "pergunte sempre" — e quem pergunta sempre é ignorado. */
      it('separa a lacuna agnóstica da que é só desta extensão', () => {
        expect(agents).toContain('Work around it and move on');
        expect(agents).toContain('**Agnostic**');
        expect(agents).toContain('is being edited');
      });

      /** Avisar não basta: o valor está em dizer COMO o kernel supriria e por que importa. */
      it('exige dizer o que falta, como o kernel supriria, por que importa e o que o contorno custa', () => {
        expect(agents).toContain('**What is missing**');
        expect(agents).toContain('**How the platform could supply it**');
        expect(agents).toContain('**Why it matters**');
        expect(agents).toContain('**What the workaround costs**');
      });

      it('deixa a decisão com o escritório, não com quem escreve', () => {
        expect(agents).toContain('their decision, not yours');
      });
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

    /**
     * A lista de `sourceFile` estava documentada como MECÂNICA — como os arquivos se fundem — e nunca
     * como padrão: os nomes `.viewmodel.tsx` e `.styles.tsx` apareciam só como exemplo de sintaxe. O
     * autor lia a capacidade e não lia o motivo dela existir.
     */
    it('a §7 dá a divisão dos três arquivos e manda tirar a regra de dentro do componente', () => {
      expect(guide).toContain('Writing the code, once you are sure you need it');
      expect(guide).toContain('Take what can be wrong out of React');
      expect(guide).toContain('views/Summary.rules.ts');
    });

    /**
     * O guia manda ler `examples/` antes de escrever um mecanismo pela primeira vez, e os exemplos
     * declaram a fonte de outra forma que a do autor — por TEXTO, com a fusão na declaração. Sem esta
     * linha, quem lê o exemplo conclui que `mergeViewSources` é o caminho, e ele não é.
     */
    it('a §7 explica por que o exemplo de primeira parte funde a fonte por conta própria', () => {
      expect(guide).toContain('mergeViewSources');
      expect(guide).toContain('only the door differs');
    });

    it('a §7 manda estilizar pelo tema, e não por um literal', () => {
      expect(guide).toContain('Style through the theme, never through a literal');
      expect(guide).toContain('theme.spacing.md');
    });

    /** Uma function é a única parte de uma extensão que não dá para experimentar em um segundo. */
    it('a §12 manda o handler fino, com a decisão numa função que o teste chama', () => {
      expect(guide).toContain('Write the handler thin');
      expect(guide).toContain('imports nothing from firebase-functions, so a test can call it');
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
   * As regras que decidem a TELA são as mesmas que o plano aplica. Escritas à mão aqui, uma regra
   * mudaria no código e o manual continuaria ensinando a antiga — que é o pior dos dois estados,
   * porque o autor confere o plano contra o texto e conclui que o plano está errado.
   */
  it('as regras do plano de telas saem de SCREEN_PLAN_RULES, e o que fica para a pessoa também', () => {
    const guide = authoringGuide(AGENTS);
    for (const rule of SCREEN_PLAN_RULES) {
      expect(guide, rule.subject).toContain(rule.subject);
      expect(guide, rule.decides).toContain(rule.decides);
    }
    for (const decision of SCREEN_PLAN_HUMAN_DECISIONS) expect(guide).toContain(decision);
  });

  /**
   * E a PRECEDÊNCIA da identidade da tela sai do código também. Ela é a instrução que mais custa
   * errar — um `sourceId` recalculado instala uma segunda tela em todo escritório, sem sintoma — e uma
   * cópia em prosa dela envelheceria em silêncio no dia em que a ordem das três fontes mudasse.
   */
  it('a precedência do sourceId da tela sai de SCREEN_SOURCE_ID_PRECEDENCE', () => {
    const guide = authoringGuide(AGENTS);
    for (const step of SCREEN_SOURCE_ID_PRECEDENCE) expect(guide).toContain(step);
    expect(guide).toContain('You do not choose it, and you never change it');
  });

  /**
   * O NÚMERO de lacunas é derivado. Escrito à mão, ele envelheceria na primeira lacuna fechada — e o
   * manual passaria a afirmar uma contagem que nada mais confere, que é exatamente o defeito que o
   * relatório de cobertura existe para não repetir.
   */
  it('a contagem de lacunas de mecanismo sai do relatório, nunca de um número digitado', () => {
    const guide = authoringGuide(AGENTS);
    expect(guide).toContain(`does not reach ${coverageGaps().length}`);
    for (const line of coverageSummary().filter((one) => one.gaps > 0)) {
      expect(guide, line.surface).toContain(`| ${line.surface} | ${line.total} | ${line.gaps} |`);
    }
  });

  /** O gesto e o arquivo que o fecha: sem os dois nomeados, o autor não sabe que eles existem. */
  it('o manual e o AGENTS.md nomeiam o prompt e o livro de rastreabilidade', () => {
    for (const text of [authoringGuide(AGENTS), workspaceAgentsMd(AGENTS)]) {
      expect(text).toContain('model_business_rule');
      expect(text).toContain(RULE_LEDGER_FILE);
      expect(text).toContain('microteia://domain-model/coverage');
    }
  });

  /**
   * A tabela de pontos sai dos MESMOS arrays que o kernel valida contra — é o que o manual não tinha
   * como garantir enquanto morava no Console, que recebia uma cópia deles.
   */
  it('a tabela de pontos de extensão sai dos arrays do kernel', () => {
    const guide = authoringGuide(AGENTS);
    for (const point of [...UI_EXTENSION_POINTS, ...ACCESS_EXTENSION_POINTS]) {
      expect(guide, point.id).toContain(`\`${point.id}\``);
    }
  });

  /**
   * O manual ENSINA a importar do `@microteia/sdk`, e o exemplo que ele mostra é copiado direto pelo
   * autor — humano ou IA. Nada ligava aquele nome ao barril: a §8 ensinava `accessPermission` por
   * versões, um símbolo que o SDK nunca exportou, e quem seguia o manual não compilava. O erro não
   * aparece em teste nenhum do kernel porque o texto é uma string, e não código.
   */
  it('todo símbolo que o manual manda importar do SDK existe no barril', () => {
    const guide = authoringGuide(AGENTS);
    const imported = [...guide.matchAll(/import \{([^}]+)\} from '@microteia\/sdk'/g)]
      .flatMap((match) => match[1].split(','))
      .map((name) => name.trim())
      .filter(Boolean);

    expect(imported.length).toBeGreaterThan(0);
    const exported = new Set(Object.keys(SDK));
    expect(
      imported.filter((name) => !exported.has(name)),
      'símbolos que o manual ensina e o SDK não exporta',
    ).toEqual([]);
  });

  /**
   * O manual ensina DUAS entradas, e a segunda não era conferida por nada. `@microteia/sdk/node` é a
   * ferramenta — é dela que sai o transpilador de script, porque ele arrasta o `sucrase` e o barril
   * isomórfico não arrasta nada além do `expr-eval`.
   */
  it('e o mesmo vale para o que ele manda importar de @microteia/sdk/node', () => {
    const guide = authoringGuide(AGENTS);
    const imported = [...guide.matchAll(/import \{([^}]+)\} from '@microteia\/sdk\/node'/g)]
      .flatMap((match) => match[1].split(','))
      .map((name) => name.trim())
      .filter(Boolean);

    expect(imported.length).toBeGreaterThan(0);
    const exported = new Set(Object.keys(SDK_NODE));
    expect(
      imported.filter((name) => !exported.has(name)),
      'símbolos que o manual ensina e a entrada /node não exporta',
    ).toEqual([]);
  });

  /**
   * O VOCABULÁRIO declarativo é a maior parte de uma extensão, e o `.d.ts` que viaja no SDK é emitido
   * com `removeComments`: este manual é a ÚNICA explicação daquele vocabulário que chega ao escritório.
   *
   * As três primeiras listas são `Record` fechados por tipo no `authoringGuide.ts`, então um tipo novo
   * no kernel nem compila até ganhar a linha dele — estes casos guardam a quarta, que não tem união
   * para fechar, e provam que as três chegaram ao texto.
   */
  it('documenta todo tipo de campo, nó de widget e tipo de passo que o kernel conhece', () => {
    const guide = authoringGuide(AGENTS);
    for (const entry of [...CUSTOM_FIELD_TYPES, ...WIDGET_NODE_TYPES, ...STEP_TYPES]) {
      expect(guide, entry).toContain(`| \`${entry}\` |`);
    }
  });

  it('e toda função de expressão que a instalação resolve', () => {
    const guide = authoringGuide(AGENTS);
    for (const name of FIELD_EXPRESSION_FUNCTION_NAMES) {
      expect(guide, name).toContain(`\`${name}\``);
    }
  });
});

/**
 * A MODELAGEM ANTES DA GERAÇÃO nos dois documentos gerados.
 *
 * O que se guarda aqui é a mesma coisa que o resto deste arquivo guarda: afirmação sobre o kernel em
 * documento gerado é DERIVADA. A tabela de armazenamento e a lista de detectores saem do código do
 * validador — um armazenamento novo, ou um detector a menos, reprova aqui em vez de deixar o texto
 * afirmando o que a instalação já não faz.
 *
 * E o texto não é a defesa: a regra crítica vive no validador, e estes casos só provam que ela CHEGA
 * a quem escreve. Um agente que ignore o parágrafo esbarra em `validate_domain_model` do mesmo jeito.
 */
describe('modelar antes de gerar, nos documentos que o autor lê', () => {
  const agents = workspaceAgentsMd(AGENTS);
  const guide = authoringGuide(AGENTS);

  it('o AGENTS.md nomeia a regra e a põe ANTES da escada de custo', () => {
    expect(agents).toContain(SCREEN_IS_NOT_AN_ENTITY_MODEL);
    expect(agents.indexOf(SCREEN_IS_NOT_AN_ENTITY_MODEL))
      .toBeLessThan(agents.indexOf('Reach for the least powerful thing that works'));
  });

  it('e ensina a sequência inteira, na ordem, com o portão no meio', () => {
    const order = ['microteia://entities', 'validate_domain_model', 'generate_artifact_plan', 'validate_plugin'];
    const positions = order.map((step) => agents.indexOf(step));
    expect(positions.every((one) => one >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toStrictEqual(positions);
  });

  /**
   * A frase que mais custa: a regra NÃO é "nunca duplique". Sem ela, o autor evita o snapshot certo —
   * e o preço da venda passa a seguir o catálogo, reescrevendo o passado sem sintoma nenhum.
   */
  it('diz que duplicar é permitido, e que o que não é permitido é duplicar em silêncio', () => {
    expect(agents).toContain('Duplication is allowed; silent duplication is not.');
    expect(agents).toContain("semanticType: 'snapshot'");
    expect(agents).toContain('reason');
    expect(guide).toContain('Duplication is allowed; silent duplication is not.');
  });

  it('o guia deriva a tabela de armazenamento do validador, sem cópia em prosa', () => {
    for (const mechanism of STORAGE_MECHANISMS) {
      expect(guide).toContain(`| \`${mechanism.storage}\` | ${mechanism.cardinalities.join(', ')} |`);
      expect(guide).toContain(mechanism.storedAs);
    }
  });

  it('e a lista de checagens, código a código', () => {
    for (const code of DOMAIN_ISSUE_CODES) expect(guide).toContain(`\`${code}\``);
  });

  /**
   * O passo que as pessoas pulam, e o único que impede a mesma discussão de voltar toda sessão.
   */
  it('manda guardar o modelo em disco, e diz o que se perde sem isso', () => {
    expect(agents).toContain('domain-model.json');
    expect(agents).toContain('nowhere to live in');
    expect(agents).toContain('one decision instead of one per');
  });

  /**
   * Ferramenta custa esquema de entrada na janela de TODO agente, em toda sessão. A distinção entre
   * as duas superfícies tem de chegar a quem escreve, senão ele procura por tool o que é documento.
   */
  it('separa ferramenta de recurso, e explica por que a distinção existe', () => {
    expect(agents).toContain('a **tool** takes an argument or changes something');
    expect(agents).toContain('input schema in the context window of every agent');
    for (const uri of ['microteia://entities', 'microteia://workflow/steps', 'microteia://domain-model/rules']) {
      expect(agents).toContain(uri);
    }
    // E o que virou recurso não pode continuar sendo pedido como ferramenta.
    for (const gone of ['list_entities', 'list_workflow_steps', 'list_extension_points', 'workspace_info']) {
      expect(agents).not.toContain(`\`${gone}\``);
      expect(guide).not.toContain(`\`${gone}\``);
    }
  });

  it('nomeia a tradução escolhida para objeto aninhado, em vez de deixá-la implícita', () => {
    expect(guide).toContain(EMBEDDED_STRATEGY);
    expect(guide).toContain('No nested object field, and no dotted field key');
  });

  /**
   * As duas coisas que a plataforma NÃO faz e que uma declaração não finge. Estavam só no validador;
   * quem lia o guia e desenhava o modelo antes de chamar a ferramenta não tinha como saber.
   */
  it('avisa que não existe cascata, e diz qual é o caminho que existe', () => {
    expect(guide).toContain('No cascade and no referential restriction');
    expect(guide).toContain('remove');
    expect(guide).toContain('.deleted');
  });

  /**
   * O teto de materialização era um "50" escrito à mão na tabela do guia. Número escrito à mão é uma
   * promessa que ninguém revisa: no dia em que `MULTI_FK_MATERIALIZE_LIMIT` mudar, o autor desenha o
   * modelo contra um limite que não é o da instalação dele — e nada reprova.
   */
  it('o teto de materialização do N:N vem da constante do kernel', () => {
    expect(guide).toContain(`at most ${MULTI_FK_MATERIALIZE_LIMIT} are materialised per read`);
    const association = STORAGE_MECHANISMS.find((one) => one.storage === 'association');
    expect(association?.storedAs).toContain(String(MULTI_FK_MATERIALIZE_LIMIT));
    // E o número não pode estar escrito no texto por fora da constante.
    expect(guide.match(/at most \d+ are materialised/g)).toStrictEqual([`at most ${MULTI_FK_MATERIALIZE_LIMIT} are materialised`]);
  });

  it('separa ferramenta de recurso também no manual, e lista as URIs', () => {
    expect(guide).toContain('changes something, it is a tool');
    for (const uri of ['microteia://entities', 'microteia://workflow/steps', 'microteia://expression-functions']) {
      expect(guide).toContain(uri);
    }
  });

  it('manda guardar o modelo em disco, e diz o que se perde sem isso', () => {
    expect(guide).toContain('domain-model.json');
    expect(guide).toContain('decision instead of one per session');
  });

  it('avisa que agregado não atravessa referência múltipla', () => {
    expect(guide).toContain('an aggregation cannot walk a');
    expect(guide).toContain('it is impossible');
  });

  it('os três recursos MCP estão no guia pelas URIs que o servidor publica', () => {
    for (const uri of ['microteia://domain-model/schema', 'microteia://entities', 'microteia://domain-model/rules']) {
      expect(guide).toContain(uri);
    }
  });

  /** O `CLAUDE.md` é do escritório: nada aqui pode ter encostado nele. */
  it('não escreve uma linha do modelo de domínio no arquivo que é do escritório', () => {
    const claude = workspaceClaudeMd('Acme');
    expect(claude).not.toContain(SCREEN_IS_NOT_AN_ENTITY_MODEL);
    expect(claude).not.toContain('validate_domain_model');
    expect(claude).toContain('@AGENTS.md');
  });
});
