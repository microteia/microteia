import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { mcpPrompts, mcpResourceUris, mcpToolNames, mcpTools, readMcpPrompt, readMcpResource, runMcpTool } from './mcp';
import { CORE_STEP_DEFINITION_IDS } from '../../domain/schema/workflowStepCatalog';
import { QUERY_MAX_RESULTS, QUERY_MAX_SCAN, QUERY_PAGE_SINCE_KERNEL } from '../../domain/schema/querySpec';
import { CUSTOM_FIELD_TYPES } from '../../domain/schema/fieldRules';
import {
  REPORT_CHART_KINDS,
  REPORT_GRANULARITIES,
  REPORT_SHAPE_KINDS,
} from '../../domain/schema/report/reportSpec';
import {
  PORTAL_VIEWED_ACTION,
  buildWorkflowEventCatalog,
  childRecordEventName,
} from '../../domain/schema/eventCatalog';
import { WORKFLOW_AUDIT_EVENT } from '../../domain/schema/workflowAuditTrigger';
import { createSchemaContext } from '../../domain/schema/pathResolver';
import { DOMAIN_ISSUE_CODES, RULE_LEDGER_FILE, SCREEN_PLAN_RULES, STORAGE_MECHANISMS, coverageGaps } from '../domain';

/**
 * O servidor MCP é o que faz uma IA no editor trabalhar com a VERDADE desta instalação em vez de um
 * retrato da documentação. O que ele serve não é prosa: é o mesmo dado que o kernel usa.
 *
 * A lista de ferramentas é contrato com quem escreve o prompt do outro lado — renomear uma quebra
 * instruções que não estão neste repositório, e é por isso que ela é carimbada aqui.
 */
const ROOT = resolve(__dirname, '../../..');

describe('o servidor MCP de autoria', () => {
  it('publica exatamente as ferramentas declaradas', () => {
    expect(mcpToolNames().sort()).toEqual([
      'build_plugin',
      'describe_extension',
      'describe_host_module',
      'describe_sdk_type',
      'describe_workflow_step',
      'generate_artifact_plan',
      'read_authoring_guide',
      'validate_domain_model',
      'validate_plugin',
    ]);
  });

  /**
   * A regra que separa as duas listas, e ela é verificável: **ferramenta recebe argumento ou muda
   * alguma coisa; leitura pura é recurso.** Oito das dezesseis não recebiam nada e não faziam nada —
   * eram documentos custando um esquema de entrada na janela de todo agente, em toda sessão,
   * inclusive na de quem abriu o editor só para validar um pacote.
   */
  it('nenhuma ferramenta é leitura pura: toda uma recebe argumento ou age', () => {
    const ACTIONS = ['validate_plugin', 'build_plugin', 'validate_domain_model', 'generate_artifact_plan'];
    for (const tool of mcpTools()) {
      const properties = (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
      const takesArgument = Object.keys(properties).length > 0;
      expect(takesArgument || ACTIONS.includes(tool.name), `${tool.name} não recebe argumento e não age`).toBe(true);
    }
  });

  /**
   * Os RECURSOS são contrato do mesmo jeito que as ferramentas, e mais frágeis: uma URI é o que um
   * cliente anexa ao contexto, e renomeá-la quebra o anexo em silêncio, sem erro nenhum.
   */
  it('publica exatamente os recursos declarados', () => {
    expect(mcpResourceUris().sort()).toEqual([
      'microteia://domain-model/coverage',
      'microteia://domain-model/rules',
      'microteia://domain-model/schema',
      'microteia://entities',
      'microteia://example-coverage',
      'microteia://examples',
      'microteia://expression-functions',
      'microteia://extension-points',
      'microteia://icons',
      'microteia://nav-groups',
      'microteia://record-commands',
      'microteia://referenceable',
      'microteia://reports/options',
      'microteia://workflow/events',
      'microteia://workflow/steps',
      'microteia://workspace/info',
      'microteia://workspace/plugins',
    ]);
  });

  /**
   * Um título que sai como chave (`core.auth/point.provider`) é o tradutor do terminal sem o catálogo
   * daquele namespace. O `auth.provider` saiu assim enquanto `CORE_BUNDLES` não trazia `core.auth`.
   */
  it('nenhum ponto de extensão sai com título ou descrição em forma de chave', () => {
    const answer = JSON.parse(readMcpResource('microteia://extension-points', ROOT)) as {
      points: { id: string; title: string; description?: string }[];
    };
    const looksLikeKey = (text: string | undefined): boolean => text !== undefined && /^@?[a-z0-9.-]+\/[a-z0-9.-]+$/i.test(text);
    for (const point of answer.points) {
      expect(looksLikeKey(point.title), `${point.id}: ${point.title}`).toBe(false);
      expect(looksLikeKey(point.description), `${point.id}: ${point.description}`).toBe(false);
    }
  });

  /** Todo recurso publicado tem de responder — uma URI listada e ilegível é pior que ausente. */
  it('todo recurso publicado responde', () => {
    for (const uri of mcpResourceUris()) expect(readMcpResource(uri, ROOT).length).toBeGreaterThan(0);
  });

  /**
   * O catálogo de passos era a única capacidade grande do kernel que o autor não conseguia enumerar: a
   * metadata vivia em `functions/`, o guia dizia "leia na tela de Automações de uma instalação em
   * execução", e o construtor visual dentro do app sabia mais que o agente que escrevia a extensão.
   */
  it('enumera o catálogo de passos, com o que cada um recebe e publica', () => {
    const answer = JSON.parse(readMcpResource('microteia://workflow/steps', ROOT)) as {
      steps: { stepDefinitionId: string; name: string; inputs: string[]; outputs: string[] }[];
      controlStepTypes: string[];
      unimplementedStepTypes: string[];
    };
    const ids = answer.steps.map((step) => step.stepDefinitionId);
    expect(ids).toContain('upsert');
    expect(ids).toContain('notify');
    // Contagem DERIVADA: um passo novo no kernel aparece aqui sem que ninguém precise lembrar de
    // subir um número — e um passo que o MCP deixasse de servir reprova na mesma linha.
    expect([...ids].sort()).toEqual([...CORE_STEP_DEFINITION_IDS].sort());
    expect(answer.controlStepTypes).toEqual(['Condition', 'Loop', 'Switch']);
    expect(answer.unimplementedStepTypes).toContain('Delay');

    // Rótulo RESOLVIDO, não a chave: quem lê é um modelo, e `@core.automation/step.upsert.name` não
    // diz o que o passo faz.
    const upsert = answer.steps.find((step) => step.stepDefinitionId === 'upsert');
    expect(upsert?.name).not.toMatch(/^@/);
    expect(upsert?.outputs).toContain('id: String');
  });

  /**
   * A armadilha que mais custou: `QuerySpec` era publicado pelo SDK e o passo `query` de fato o recebe,
   * então quem aprendia o `query` generalizava para o `upsert` — que lê `UpsertStepConfig`, um tipo que
   * nem estava na superfície. A ferramenta tem de dizer o nome do tipo, não só "Upsert".
   */
  it('descreve um passo dizendo o TIPO que o input composto exige', () => {
    const answer = JSON.parse(runMcpTool('describe_workflow_step', { stepDefinitionId: 'upsert' }, ROOT)) as {
      inputs: { id: string; type: string; shape: string | null; acceptsMappingKinds: string[] }[];
    };
    const input = answer.inputs.find((one) => one.id === 'upsert');
    expect(input?.type).toBe('Upsert');
    expect(input?.shape).toBe('UpsertStepConfig');
    expect(input?.acceptsMappingKinds).toEqual(['Literal']);

    const query = JSON.parse(runMcpTool('describe_workflow_step', { stepDefinitionId: 'query' }, ROOT)) as {
      inputs: { id: string; shape: string | null }[];
    };
    expect(query.inputs.find((one) => one.id === 'query')?.shape).toBe('QuerySpec');
  });

  /**
   * Os tetos da consulta não aparecem em input nenhum — e foi assim que um `limit: 300` devolveu 100 sem
   * ninguém saber. O número é o da constante que o motor aplica, e a saída (a página) vem junto.
   */
  it('descreve os tetos da consulta e a leitura em páginas', () => {
    const query = JSON.parse(runMcpTool('describe_workflow_step', { stepDefinitionId: 'query' }, ROOT)) as {
      ceilings: string[];
      outputs: { id: string }[];
    };
    const text = query.ceilings.join(' ');
    expect(text).toContain(`at most ${QUERY_MAX_SCAN} documents`);
    expect(text).toContain(`returns at most ${QUERY_MAX_RESULTS} records`);
    expect(text).toMatch(/Only `eq`/);
    expect(text).toMatch(/`orderBy` is refused with `page`/);
    expect(text).toContain(QUERY_PAGE_SINCE_KERNEL);
    expect(query.outputs.map((one) => one.id)).toEqual(expect.arrayContaining(['hasMore', 'cursor']));

    const upsert = JSON.parse(runMcpTool('describe_workflow_step', { stepDefinitionId: 'upsert' }, ROOT)) as Record<string, unknown>;
    expect(upsert.ceilings).toBeUndefined();
  });

  it('diz de qual origem de modelo é cada input do passo "Gerar documento"', () => {
    const answer = JSON.parse(runMcpTool('describe_workflow_step', { stepDefinitionId: 'render-document' }, ROOT)) as {
      inputs: { id: string; onlyForTemplateSource?: string; names?: string }[];
    };
    const byId = new Map(answer.inputs.map((one) => [one.id, one]));
    expect(byId.get('recordId')?.onlyForTemplateSource).toBe('record');
    expect(byId.get('payload')?.onlyForTemplateSource).toBe('payload');
    expect(byId.get('belongsTo')?.onlyForTemplateSource).toBe('payload');
    expect(byId.get('belongsTo')?.names).toMatch(/EntityReference/);
    expect(byId.get('output')?.onlyForTemplateSource).toBeUndefined();
  });

  it('um id de passo que não existe volta com a lista do que existe', () => {
    const answer = runMcpTool('describe_workflow_step', { stepDefinitionId: 'notificar' }, ROOT);
    expect(answer).toMatch(/is not in the kernel catalog/);
    expect(answer).toMatch(/- notify/);
  });

  it('serve a gramática dos eventos, e a distinção de caminho que mais causa erro', () => {
    const answer = JSON.parse(readMcpResource('microteia://workflow/events', ROOT)) as {
      forms: { eventName: string }[];
      notes: string[];
    };
    expect(answer.forms.map((form) => form.eventName)).toContain('workflow.called');
    expect(answer.forms.map((form) => form.eventName)).toContain('schedule');
    expect(answer.forms.map((form) => form.eventName)).toContain('<collection>.dateReached');
    expect(answer.notes.join(' ')).toMatch(/schedule: \{ cron \}/);
    expect(answer.forms.some((form) => form.eventName.includes('<collection>.saved'))).toBe(true);
    expect(answer.notes.join(' ')).toMatch(/ABSOLUTE/);
    expect(answer.notes.join(' ')).toMatch(/RELATIVE/);
  });

  /**
   * A gramática servida é DERIVADA do catálogo que o motor usa: monta-se uma tela com tudo o que faz
   * um gatilho existir (data, notas, documentos, portal rastreado) e todo nome que o catálogo oferece
   * tem de ter a sua forma na lista. `portalViewed` e `audit.recorded` existiam no motor e no guia, e
   * faltavam aqui — o agente que confia no recurso nunca os escrevia.
   */
  it('lista toda forma de evento que o catálogo do motor oferece', () => {
    const answer = JSON.parse(readMcpResource('microteia://workflow/events', ROOT)) as { forms: { eventName: string }[] };
    const served = answer.forms.flatMap((form) => form.eventName.split(' | '));
    const ctx = createSchemaContext([{
      id: 'things',
      collection: 'things',
      eventPrefix: 'thing',
      titleSingular: 'Thing',
      titleFieldKey: 'name',
      hasNotes: true,
      hasDocuments: true,
      tracksPortalViews: true,
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: false, order: 0, origin: 'plugin' },
        { key: 'due', label: 'Due', type: 'date', required: false, order: 1, origin: 'plugin' },
      ],
    }]);
    const offered = buildWorkflowEventCatalog(ctx)
      .map((entry) => entry.name.replace(/^thing_/, '<prefix>_').replace(/^thing\./, '<collection>.'));
    expect(offered).toContain(`<collection>.${PORTAL_VIEWED_ACTION}`);
    expect(offered).toContain(WORKFLOW_AUDIT_EVENT);
    expect(offered).toContain(childRecordEventName('<prefix>', 'note', 'saved'));
    for (const name of offered) expect(served, name).toContain(name);
  });

  /**
   * A lista de gestos era PROSA no guia de autoria — uma extensão nova de distância de ficar
   * incompleta em silêncio, contra a regra de que afirmação sobre o kernel em documento gerado é
   * derivada.
   */
  it('deriva os gestos de registro do kernel', () => {
    const answer = JSON.parse(readMcpResource('microteia://record-commands', ROOT)) as {
      commands: { command: string; title: string }[];
    };
    const commands = answer.commands.map((one) => one.command).sort();
    expect(commands).toEqual(['clone', 'copyLink', 'delete', 'generateDocument', 'manageTags', 'unlink']);
    expect(answer.commands.every((one) => !one.title.startsWith('@'))).toBe(true);
  });

  it('lista os pontos de extensão com a versão do contrato e o que cada um aceita', () => {
    const answer = JSON.parse(readMcpResource('microteia://extension-points', ROOT)) as {
      kernelVersion: string;
      implKindsThatRunWithoutReview: string[];
      codeImplNote: string;
      points: { id: string; allowedImplKinds: string[] }[];
    };
    expect(answer.kernelVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(answer.points.map((point) => point.id)).toContain('ui.page');
    expect(answer.points.map((point) => point.id)).toContain('i18n.messages');
    expect(answer.implKindsThatRunWithoutReview).not.toContain('code');
  });

  /**
   * O nome do campo ERA `implKindsAvailableToThirdParties`, e ele afirmava o contrário do contrato: um
   * pacote de terceiro PODE entregar `code` — a validação não o recusa —, o que ele paga é revisão
   * humana antes de executar. Um modelo que lesse o nome antigo concluiria que não pode entregar view
   * nenhuma, e a conclusão bloquearia trabalho legítimo sem nada acusar.
   */
  it('não deixa a lista de kinds sugerir que uma view é proibida a terceiros', () => {
    const answer = JSON.parse(readMcpResource('microteia://extension-points', ROOT)) as { codeImplNote: string };
    expect(answer.codeImplNote).toMatch(/may declare/);
    expect(answer.codeImplNote).toMatch(/trusts it/);
  });

  /**
   * O `.d.ts` do SDK é emitido com `removeComments`: quem escreve extensão recebe a FORMA de
   * `TemplateField` e de `WidgetSpec` sem uma linha de explicação, e sem esta ferramenta não tinha como
   * saber quais propriedades existem a não ser abrindo `node_modules` à mão.
   */
  it('descreve um tipo de autoria a partir do .d.ts que o pacote carrega', () => {
    const answer = runMcpTool('describe_sdk_type', { name: 'WidgetSpec' }, ROOT);
    expect(answer).toContain('export type WidgetSpec');
    expect(answer).toContain("type: 'divider'");
    // O caminho vai junto: é a prova de que a resposta saiu do pacote, e não da memória do modelo.
    expect(answer).toContain('widgetSpec.d.ts');
  });

  /**
   * `TemplateField` é `Omit<FieldDefinition, 'origin'>` e é o tipo mais usado de todos: devolvê-lo
   * sozinho responde à pergunta com outra pergunta. Uma volta de expansão é o que torna a resposta
   * útil em vez de apenas correta.
   */
  it('expande uma volta: quem pede um apelido recebe a forma que ele aponta', () => {
    const answer = runMcpTool('describe_sdk_type', { name: 'TemplateField' }, ROOT);
    expect(answer).toContain("Omit<FieldDefinition, 'origin'>");
    expect(answer).toContain('referenced by it');
    expect(answer).toContain('export interface FieldDefinition');
    expect(answer).toContain('lookupCollection');
  });

  /**
   * O REEXPORTE não pode ser a resposta.
   *
   * `ReportModuleTemplate` mora em `Report.d.ts` e `MarketplacePlugin.d.ts` o reexporta; a varredura
   * alcançava o reexporte primeiro e devolvia `= ReportModuleTemplateType` — um apelido para um
   * símbolo que o barril não publica, e portanto sem expansão nenhuma possível. Quem ia declarar um
   * relatório no pacote ficava sem saber que ele pede `templateId`, `key`, `title` e `origin`.
   */
  it('atravessa o reexporte e devolve a declaração que tem forma', () => {
    const answer = runMcpTool('describe_sdk_type', { name: 'ReportModuleTemplate' }, ROOT);

    expect(answer).not.toContain('= ReportModuleTemplateType;');
    expect(answer).toContain("templateId: string");
    expect(answer).toContain('export interface ReportDefinition');
    expect(answer).toContain('spec: ReportSpec');
  });

  it('lista a superfície publicada quando não se diz o nome', () => {
    const answer = runMcpTool('describe_sdk_type', {}, ROOT);
    expect(answer).toContain('- AuthoredPlugin');
    expect(answer).toContain('- TemplateField');
  });

  it('e aproxima em vez de só falhar quando o nome não existe', () => {
    const answer = runMcpTool('describe_sdk_type', { name: 'Widget' }, ROOT);
    expect(answer).toContain('Did you mean');
    expect(answer).toContain('WidgetSpec');
  });

  /** As funções vêm do motor, não de uma cópia escrita à mão num texto. */
  it('lista as funções de expressão que a instalação de fato resolve', () => {
    const answer = JSON.parse(readMcpResource('microteia://expression-functions', ROOT)) as {
      functions: string[];
      operators: string[];
    };
    expect(answer.functions).toContain('hasPermission');
    expect(answer.functions).toContain('today');
    expect(answer.operators).toContain('and');
  });

  it('descreve um módulo da API curada a partir do .d.ts gerado', () => {
    const answer = runMcpTool('describe_host_module', { name: '@microteia/settings' }, ROOT);
    expect(answer).toContain("declare module '@microteia/settings'");
    expect(answer).toContain('useSettingValue');
  });

  it('recusa um módulo inexistente listando os que existem, em vez de só falhar', () => {
    const answer = runMcpTool('describe_host_module', { name: '@microteia/nada' }, ROOT);
    expect(answer).toContain('is not available to extensions');
    expect(answer).toContain('@microteia/ui');
  });

  it('valida um pacote com o mesmo veredito que a instalação daria', () => {
    const bad = JSON.stringify({
      manifest: { id: 'nope', version: '1.0.0', kernel: '^2.0.0', name: 'X' },
      summary: '',
      workflows: [],
    });
    const answer = runMcpTool('validate_plugin', { json: bad }, ROOT);
    expect(answer).toContain('problem(s)');
    // Texto resolvido, não a referência: quem lê é um modelo, e a chave não o ajuda a corrigir.
    expect(answer).not.toMatch(/@core\.marketplace\//);
  });

  it('reconhece um pacote válido', () => {
    const good = JSON.stringify({
      manifest: { id: 'com.example.ok', version: '1.0.0', kernel: '^2.0.0', name: 'Ok' },
      summary: 'Uma extensão mínima.',
      workflows: [],
    });
    expect(runMcpTool('validate_plugin', { json: good }, ROOT)).toContain('would install');
  });


  /**
   * O MODELO DE DOMÍNIO pelo MCP. A regra que estas três ferramentas existem para impor tem nome — "A
   * screen is not an entity model" — e o que se prova aqui é que ela chega ao agente como REPROVAÇÃO,
   * e não como parágrafo de manual: o modelo achatado é recusado, e o recusado não vira plano.
   */
  describe('a camada de modelo de domínio', () => {
    const flatSale = {
      target: 'screenDefinitions',
      entities: [
        { name: 'Customer', kind: 'entity', collection: 'customers', titleField: 'name', fields: [{ key: 'name', label: 'Name', semanticType: 'scalar', type: 'text' }] },
        {
          name: 'Sale',
          kind: 'entity',
          collection: 'sales',
          titleField: 'code',
          fields: [
            { key: 'code', label: 'Code', semanticType: 'scalar', type: 'text' },
            { key: 'customerName', label: 'Customer name', semanticType: 'scalar', type: 'text' },
            { key: 'customerEmail', label: 'Customer email', semanticType: 'scalar', type: 'text' },
          ],
        },
      ],
      relationships: [],
    };

    const modelled = {
      target: 'screenDefinitions',
      entities: [
        { name: 'Customer', kind: 'entity', collection: 'customers', titleField: 'name', fields: [{ key: 'name', label: 'Name', semanticType: 'scalar', type: 'text' }] },
        {
          name: 'Sale',
          kind: 'entity',
          collection: 'sales',
          titleField: 'code',
          fields: [
            { key: 'code', label: 'Code', semanticType: 'scalar', type: 'text' },
            { key: 'customerId', label: 'Customer', semanticType: 'reference', target: 'Customer' },
          ],
        },
      ],
      relationships: [{
        sourceEntity: 'Sale',
        targetEntity: 'Customer',
        sourceField: 'customerId',
        type: 'many-to-one',
        storage: 'reference',
        ownership: 'association',
      }],
    };

    it('lista as entidades que este workspace conhece, dizendo de onde cada uma veio', () => {
      const answer = JSON.parse(readMcpResource('microteia://entities', ROOT)) as {
        rule: string;
        entities: { collection: string; source: string; labelSingular: string }[];
      };
      expect(answer.rule).toContain('A screen is not an entity model');
      // As duas do kernel, e são só essas: nenhuma entidade de negócio mora aqui.
      expect(answer.entities.map((one) => one.collection).sort()).toEqual(['members', 'tenant']);
      expect(answer.entities.every((one) => one.source === 'kernel')).toBe(true);
      // Rótulo RESOLVIDO: quem lê é um modelo, e `@core.data/member.singular` não diz o que é.
      expect(answer.entities.every((one) => !one.labelSingular.startsWith('@'))).toBe(true);
    });

    it('reprova a venda que carrega o cliente dentro dela', () => {
      const answer = JSON.parse(runMcpTool('validate_domain_model', { model: flatSale }, ROOT)) as {
        ok: boolean;
        blocking: number;
        issues: { code: string; severity: string; howToDeclareException: string }[];
      };
      expect(answer.ok).toBe(false);
      expect(answer.blocking).toBeGreaterThan(0);
      const issue = answer.issues.find((one) => one.code === 'domain.field.prefix-group');
      expect(issue?.severity).toBe('error');
      // Toda regra tem porta de saída, e ela vai escrita no problema.
      expect(issue?.howToDeclareException).toContain('snapshot');
    });

    it('aceita o mesmo pedido modelado como duas entidades e uma relação', () => {
      const answer = JSON.parse(runMcpTool('validate_domain_model', { model: modelled }, ROOT)) as {
        ok: boolean;
        relationships: { storage: string; declaredAs: string }[];
        next: string;
      };
      expect(answer.ok).toBe(true);
      expect(answer.relationships[0].storage).toBe('reference');
      expect(answer.relationships[0].declaredAs).toContain('refEntity');
      expect(answer.next).toContain('generate_artifact_plan');
    });

    it('o modelo com erro NÃO vira plano — é o portão', () => {
      const answer = JSON.parse(runMcpTool('generate_artifact_plan', { model: flatSale }, ROOT)) as {
        ok: boolean;
        screens: unknown[];
        issues: { code: string }[];
      };
      expect(answer.ok).toBe(false);
      expect(answer.screens).toEqual([]);
      expect(answer.issues[0].code).toBe('domain.plan.blocked-by-model');
    });

    it('o plano diz o que deve existir, com a relação já resolvida, e não escreve arquivo nenhum', () => {
      const answer = JSON.parse(runMcpTool('generate_artifact_plan', { model: modelled }, ROOT)) as {
        ok: boolean;
        screens: { operation: string; collection: string; fields: { key: string; refEntity?: string }[] }[];
        howToWriteIt: string[];
      };
      expect(answer.ok).toBe(true);
      expect(answer.screens.map((one) => one.collection).sort()).toEqual(['customers', 'sales']);
      expect(answer.screens.every((one) => one.operation === 'create')).toBe(true);
      expect(answer.screens.find((one) => one.collection === 'sales')?.fields.find((one) => one.key === 'customerId')?.refEntity)
        .toBe('customers');
      expect(answer.howToWriteIt.join(' ')).toContain('validate_plugin');
    });

    it('um modelo malformado volta como problema, nunca como exceção de protocolo', () => {
      const answer = JSON.parse(runMcpTool('validate_domain_model', { model: '{ nope' }, ROOT)) as {
        ok: boolean;
        issues: { code: string }[];
      };
      expect(answer.ok).toBe(false);
      expect(answer.issues[0].code).toBe('domain.model.malformed');
    });

    it('a referência de mensagem do kernel chega RESOLVIDA ao problema', () => {
      const reserved = JSON.parse(JSON.stringify(modelled)) as typeof modelled;
      reserved.entities[1].collection = 'workflow_definitions';
      const answer = JSON.parse(runMcpTool('validate_domain_model', { model: reserved }, ROOT)) as {
        issues: { code: string; message: string }[];
      };
      const issue = answer.issues.find((one) => one.code === 'domain.entity.collection-invalid');
      expect(issue?.message).not.toMatch(/@core\.records\//);
      expect(issue?.message).toMatch(/reserved/i);
    });

    it('o schema do modelo é DERIVADO do kernel, e não uma cópia em prosa', () => {
      const schema = JSON.parse(readMcpResource('microteia://domain-model/schema', ROOT)) as {
        $defs: { field: { properties: { type: { enum: string[] } } } };
      };
      expect(schema.$defs.field.properties.type.enum).toEqual([...CUSTOM_FIELD_TYPES]);
    });

    it('as regras publicadas cobrem todos os detectores, sem lista escrita à mão', () => {
      const rules = readMcpResource('microteia://domain-model/rules', ROOT);
      for (const code of DOMAIN_ISSUE_CODES) expect(rules).toContain(`\`${code}\``);
      for (const mechanism of STORAGE_MECHANISMS) expect(rules).toContain(`\`${mechanism.storage}\``);
      expect(rules).toContain('Duplication is allowed. Silent duplication is not.');
    });

    it('o catálogo de entidades é servido como recurso, e responde', () => {
      const answer = JSON.parse(readMcpResource('microteia://entities', ROOT)) as { entities: unknown[] };
      expect(answer.entities.length).toBeGreaterThan(0);
    });

    /**
     * As regras do plano de TELAS chegam ao agente junto com a decisão que elas produziram. Um plano
     * que dissesse "esta coluna vai na listagem" sem dizer por quê é indistinguível de um chute, e a
     * pessoa que revisa não tem como conferir nada.
     */
    it('o plano diz as regras de tela que o produziram, e o que ele NÃO decidiu', () => {
      const answer = JSON.parse(runMcpTool('generate_artifact_plan', { model: modelled }, ROOT)) as {
        screenPlan: { rules: string[]; humanDecisions: string[]; screens: { collection: string; presence: string }[] };
      };
      for (const rule of SCREEN_PLAN_RULES) {
        expect(answer.screenPlan.rules.some((one) => one.startsWith(rule.subject))).toBe(true);
      }
      expect(answer.screenPlan.humanDecisions.some((one) => one.includes('icon'))).toBe(true);
      expect(answer.screenPlan.humanDecisions.some((one) => one.includes('sidebarOrder'))).toBe(true);
      expect(answer.screenPlan.screens.map((one) => one.presence)).toEqual(['menu-and-detail', 'menu-and-detail']);
    });

    /**
     * A identidade universal de cada tela chega na resposta, com a procedência dela. É o valor que
     * quem escreve o `plugin.ts` copia como está: recalculá-lo instala uma SEGUNDA tela na versão
     * seguinte, em todo escritório, sem sintoma nenhum.
     */
    it('o plano emite o sourceId de cada tela, e diz que ele é para copiar como está', () => {
      const answer = JSON.parse(runMcpTool('generate_artifact_plan', { model: modelled }, ROOT)) as {
        screenPlan: { screens: { collection: string; sourceId: string; sourceIdFrom: string }[] };
        howToWriteIt: string[];
      };
      expect(answer.screenPlan.screens.map((one) => `${one.collection}=${one.sourceId}`)).toEqual([
        'customers=screenDefinitions:customers',
        'sales=screenDefinitions:sales',
      ]);
      expect(answer.screenPlan.screens.every((one) => one.sourceIdFrom === 'derived')).toBe(true);
      expect(answer.howToWriteIt.some((one) => one.includes('verbatim, and never recompute one'))).toBe(true);
    });

    /** A regra vira leva: o plano devolve o arquivo pronto, e não escreve nada. */
    it('com a regra, o plano devolve o vínculo pronto para gravar — e não grava', () => {
      const answer = JSON.parse(runMcpTool('generate_artifact_plan', {
        model: modelled,
        rule: {
          id: 'sale-belongs-to-a-customer',
          statement: 'Every sale belongs to one customer.',
          concepts: ['Sale', 'Customer'],
          acceptance: ['a sale cannot be saved without a customer'],
        },
      }, ROOT)) as {
        trace: { file: string; writeThisTo: string; contents: { rules: { ruleId: string; screens: string[] }[] } };
      };
      expect(answer.trace.file).toBe(RULE_LEDGER_FILE);
      expect(answer.trace.writeThisTo).toBe(RULE_LEDGER_FILE);
      const entry = answer.trace.contents.rules.find((one) => one.ruleId === 'sale-belongs-to-a-customer');
      expect(entry?.screens).toEqual(['customers', 'sales']);
    });

    /**
     * O relatório de cobertura é servido como RECURSO, e o número dele é derivado. Uma lacuna nova
     * aparece nesta resposta sem ninguém reescrever o texto — que é o oposto de uma frase de
     * documentação afirmando que a lista está completa.
     */
    it('publica o que o vocabulário do modelo NÃO alcança, derivado', () => {
      const report = readMcpResource('microteia://domain-model/coverage', ROOT);
      expect(report).toContain(`does NOT reach ${coverageGaps().length}`);
      for (const gap of coverageGaps()) expect(report).toContain(`\`${gap.id}\``);
    });
  });

  /**
   * A CAPABILITY `prompts` — o gesto. O nome do prompt é contrato com o editor: renomeá-lo quebra a
   * escolha do usuário sem erro nenhum, exatamente como uma URI de recurso.
   */
  describe('a capability prompts', () => {
    it('publica exatamente o prompt nomeado, com os argumentos dele', () => {
      expect(mcpPrompts()).toEqual([
        { name: 'model_business_rule', args: ['statement', 'target', 'extensionId'] },
      ]);
    });

    it('conduz as quatro etapas, na ordem, e cita o enunciado que recebeu', () => {
      const text = readMcpPrompt('model_business_rule', {
        statement: 'Only the manager cancels an invoiced sale.',
        target: 'extension',
        extensionId: 'com.example.sales',
      });
      const steps = ['1. Understand', '2. Model', '3. Validate', '4. Plan'];
      const positions = steps.map((step) => text.indexOf(step));
      expect(positions.every((one) => one >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      expect(text).toContain('Only the manager cancels an invoiced sale.');
      expect(text).toContain('com.example.sales');
    });

    /**
     * O texto é DERIVADO. Uma segunda redação das mesmas regras é uma segunda fonte de verdade sobre o
     * que a plataforma sabe fazer, e ela envelhece sozinha: no dia em que um armazenamento novo entra
     * em `STORAGE_MECHANISMS`, a cópia em prosa fica incompleta sem reprovar em nada.
     */
    /**
     * O relatório chega DISFARÇADO de regra: "quanto vendemos por mês" vem na mesma frase que a
     * estrutura, e o modelo não tem campo que o diga. Sem esta linha, o gesto conduzia até as telas e
     * a automação e deixava a pergunta ser traduzida numa tela — que é o defeito que ele existe para
     * impedir, na única superfície em que ele não avisava.
     */
    it('nomeia o relatório entre o que o vocabulário não alcança, com a nota da cobertura', () => {
      const text = readMcpPrompt('model_business_rule', { statement: 'x' });
      const gap = coverageGaps()
        .find((one) => one.surface === 'package-artifact' && one.id === 'reports');

      expect(gap, 'o relatório saiu da cobertura — reveja o prompt').toBeDefined();
      expect(text).toContain('The report is one of them');
      expect(text).toContain('AUTHORING.md');
    });

    it('as tabelas dele saem do kernel, nunca de uma cópia em prosa', () => {
      const text = readMcpPrompt('model_business_rule', { statement: 'x' });
      for (const mechanism of STORAGE_MECHANISMS) expect(text).toContain(`\`${mechanism.storage}\``);
      for (const rule of SCREEN_PLAN_RULES) expect(text).toContain(rule.subject);
      expect(text).toContain(`${coverageGaps().length} are outside the model's vocabulary`);
    });

    /** E ele só manda chamar ferramenta que este servidor publica. */
    it('cita as ferramentas pelo nome REAL, e avisa quando uma não existe', () => {
      const text = readMcpPrompt('model_business_rule', { statement: 'x' });
      expect(text).not.toContain('NOT PUBLISHED');
      for (const name of ['validate_domain_model', 'generate_artifact_plan', 'validate_plugin']) {
        expect(mcpToolNames()).toContain(name);
        expect(text).toContain(`\`${name}\``);
      }
    });

    it('sem enunciado, ele PEDE o enunciado em vez de seguir', () => {
      const text = readMcpPrompt('model_business_rule', {});
      expect(text).toContain('No statement was given');
    });

    it('um prompt que não existe volta como erro, nunca como texto inventado', () => {
      expect(() => readMcpPrompt('nope')).toThrow('Unknown prompt "nope"');
    });
  });

  it('diz a que instalação está ligado, e nunca inventa um projeto', () => {
    const answer = JSON.parse(readMcpResource('microteia://workspace/info', ROOT)) as {
      kernelVersion: string;
      installationConnected: boolean;
      firebaseProjectId: string | null;
    };
    expect(answer.kernelVersion).toMatch(/^\d+\.\d+\.\d+$/);
    // Este repositório não é uma instalação: a resposta honesta é `false`/`null`.
    expect(answer.installationConnected).toBe(false);
    expect(answer.firebaseProjectId).toBeNull();
  });
});

/**
 * O relatório era a única capacidade grande cujo vocabulário o autor não conseguia enumerar: as
 * dobras e os tipos de gráfico viviam no guia, em prosa, e "agrupar" e "mostrar" chegavam ali como a
 * mesma coisa — que foi exatamente o que fez um relatório de dez campos desenhar dez níveis de recuo
 * numa coluna só.
 */
describe('as opções de relatório servidas ao agente', () => {
  const options = (): {
    folds: { kind: string; oneRowIs?: string; levels?: string; otherDimensions?: string }[];
    chartKinds: string[];
    granularities: string[];
    measureOps: string[];
    capabilities: string[];
    note: string;
  } => JSON.parse(readMcpResource('microteia://reports/options', ROOT));

  it('deriva as dobras do kernel, e toda dobra diz o que faz com os níveis', () => {
    const answer = options();

    expect(answer.folds.map((fold) => fold.kind).sort()).toEqual([...REPORT_SHAPE_KINDS].sort());
    for (const fold of answer.folds) {
      expect(fold.oneRowIs, `a dobra "${fold.kind}" não diz o que é uma linha`).toBeDefined();
      expect(fold.levels, `a dobra "${fold.kind}" não diz o que faz com os níveis`).toBeDefined();
      expect(
        fold.otherDimensions,
        `a dobra "${fold.kind}" não diz o que faz com os campos que não agrupam`,
      ).toBeDefined();
    }
  });

  it('a lista agrupada é DITA como a dobra que reúne sem perder as colunas', () => {
    const tabular = options().folds.find((fold) => fold.kind === 'tabular');

    expect(tabular?.oneRowIs).toContain('RECORD');
    expect(tabular?.levels).toContain('groupBy');
    expect(tabular?.otherDimensions).toContain('columns');
  });

  it('serve o vocabulário do kernel, e não uma cópia dele', () => {
    const answer = options();

    expect(answer.chartKinds).toEqual([...REPORT_CHART_KINDS]);
    expect(answer.granularities).toEqual([...REPORT_GRANULARITIES]);
    expect(answer.capabilities).toContain('shape.tabular.group');
  });

  /* O gráfico desenha GRUPOS. Sem isso dito, quem declara um numa lista corrida recebe uma moldura
     vazia ao lado de uma tabela cheia — e nada na tela diz por quê. */
  it('diz que o gráfico precisa de agrupamento para ter o que plotar', () => {
    expect(options().note).toContain('groupBy');
    expect(options().note).toMatch(/chart plots GROUPS/i);
  });
});
