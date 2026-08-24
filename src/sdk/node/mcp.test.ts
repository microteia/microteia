import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { mcpToolNames, runMcpTool } from './mcp';

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
      'list_expression_functions',
      'list_extension_points',
      'list_workspace_plugins',
      'read_authoring_guide',
      'validate_plugin',
      'workspace_info',
    ]);
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
