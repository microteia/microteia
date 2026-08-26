import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { mcpToolNames, runMcpTool } from './mcp';
import { CORE_STEP_DEFINITION_IDS } from '../../domain/schema/workflowStepCatalog';

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
      'describe_host_module',
      'describe_sdk_type',
      'describe_workflow_step',
      'list_expression_functions',
      'list_extension_points',
      'list_record_commands',
      'list_workflow_events',
      'list_workflow_steps',
      'list_workspace_plugins',
      'read_authoring_guide',
      'validate_plugin',
      'workspace_info',
    ]);
  });

  /**
   * O catálogo de passos era a única capacidade grande do kernel que o autor não conseguia enumerar: a
   * metadata vivia em `functions/`, o guia dizia "leia na tela de Automações de uma instalação em
   * execução", e o construtor visual dentro do app sabia mais que o agente que escrevia a extensão.
   */
  it('enumera o catálogo de passos, com o que cada um recebe e publica', () => {
    const answer = JSON.parse(runMcpTool('list_workflow_steps', {}, ROOT)) as {
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
    expect(answer.controlStepTypes).toEqual(['Condition', 'Loop']);
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

  it('um id de passo que não existe volta com a lista do que existe', () => {
    const answer = runMcpTool('describe_workflow_step', { stepDefinitionId: 'notificar' }, ROOT);
    expect(answer).toMatch(/is not in the kernel catalog/);
    expect(answer).toMatch(/- notify/);
  });

  it('serve a gramática dos eventos, e a distinção de caminho que mais causa erro', () => {
    const answer = JSON.parse(runMcpTool('list_workflow_events', {}, ROOT)) as {
      forms: { eventName: string }[];
      notes: string[];
    };
    expect(answer.forms.map((form) => form.eventName)).toContain('workflow.called');
    expect(answer.forms.some((form) => form.eventName.includes('<collection>.saved'))).toBe(true);
    expect(answer.notes.join(' ')).toMatch(/ABSOLUTE/);
    expect(answer.notes.join(' ')).toMatch(/RELATIVE/);
  });

  /**
   * A lista de gestos era PROSA no guia de autoria — uma extensão nova de distância de ficar
   * incompleta em silêncio, contra a regra de que afirmação sobre o kernel em documento gerado é
   * derivada.
   */
  it('deriva os gestos de registro do kernel', () => {
    const answer = JSON.parse(runMcpTool('list_record_commands', {}, ROOT)) as {
      commands: { command: string; title: string }[];
    };
    const commands = answer.commands.map((one) => one.command).sort();
    expect(commands).toEqual(['clone', 'copyLink', 'delete', 'manageTags', 'unlink']);
    expect(answer.commands.every((one) => !one.title.startsWith('@'))).toBe(true);
  });

  it('lista os pontos de extensão com a versão do contrato e o que cada um aceita', () => {
    const answer = JSON.parse(runMcpTool('list_extension_points', {}, ROOT)) as {
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
    const answer = JSON.parse(runMcpTool('list_extension_points', {}, ROOT)) as { codeImplNote: string };
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
    const answer = JSON.parse(runMcpTool('list_expression_functions', {}, ROOT)) as {
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

  it('diz a que instalação está ligado, e nunca inventa um projeto', () => {
    const answer = JSON.parse(runMcpTool('workspace_info', {}, ROOT)) as {
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
