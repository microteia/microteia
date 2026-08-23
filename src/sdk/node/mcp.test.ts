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
      implKindsAvailableToThirdParties: string[];
      points: { id: string; allowedImplKinds: string[] }[];
    };
    expect(answer.kernelVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(answer.points.map((point) => point.id)).toContain('ui.page');
    expect(answer.points.map((point) => point.id)).toContain('i18n.messages');
    // `code` NÃO está aqui: um terceiro pode declará-lo, mas ele só roda depois de revisado.
    expect(answer.implKindsAvailableToThirdParties).not.toContain('code');
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
