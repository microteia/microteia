import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { InputMapping, WorkflowParameter, WorkflowStep } from '../../entities/Workflow';
import { documentTemplateContribution } from '../../schema/document/documentTemplate';
import type { DocumentTemplateSpec } from '../../schema/document/documentTemplate';
import { declaredDocumentTemplates, documentTemplateContractOf } from './documentStepIntegrity';
import { workflowStepIssues } from './workflowIntegrity';

const literal = (value: string): InputMapping => ({ kind: 'Literal', value });
const event = (path: string): InputMapping => ({ kind: 'Event', path });

const PARAMETROS: WorkflowParameter[] = [
  { key: 'outorgante', label: 'Outorgante', type: 'EntityReference', entityType: 'pessoas', required: true },
  { key: 'testemunhas', label: 'Testemunhas', type: 'EntityReference', entityType: 'pessoas', list: true },
  { key: 'finalidade', label: 'Finalidade', type: 'String', required: true },
  { key: 'endereco', label: 'Endereço', type: 'Object', fields: [{ key: 'cidade', label: 'Cidade', type: 'String' }] },
];

const procuracao = (extra: Partial<DocumentTemplateSpec> = {}): DocumentTemplateSpec => ({
  key: 'procuracao',
  title: 'Procuração',
  source: 'payload',
  collection: '',
  format: 'markdown',
  body: '{{outorgante.nome}} — {{finalidade}}',
  parameters: PARAMETROS,
  ...extra,
});

const ficha: DocumentTemplateSpec = {
  key: 'ficha',
  title: 'Ficha',
  collection: 'pessoas',
  format: 'markdown',
  body: '{{nome}}',
};

const gerar = (configuration: Record<string, InputMapping>): WorkflowStep => ({
  id: 'gerar',
  stepDefinitionId: 'render-document',
  type: 'Action',
  order: 0,
  enabled: true,
  configuration,
} as WorkflowStep);

const pacote = (step: WorkflowStep, templates: DocumentTemplateSpec[] = [procuracao(), ficha]): MarketplacePlugin =>
  ({
    manifest: {
      id: 'com.example.docs',
      version: '1.0.0',
      kernel: '^2.58.0',
      name: 'Docs',
      contributes: templates.map((spec) => documentTemplateContribution(spec)),
    },
    summary: 'x',
    workflows: [{
      templateId: 'wf', name: 'Gerar', description: 'x', eventName: 'workflow.called', version: 1, steps: [step],
    }],
  } as unknown as MarketplacePlugin);

const recusas = (step: WorkflowStep, templates?: DocumentTemplateSpec[]): string[] =>
  workflowStepIssues(pacote(step, templates))
    .map((issue) => `${issue.message.replace('@core.marketplace/issue.step.document.', '')}:${
      issue.messageParams?.input ?? issue.messageParams?.parameter ?? ''}`);

const CERTO = {
  templateKey: literal('procuracao'),
  'param.outorgante': event('pessoaId'),
  'param.finalidade': literal('ad judicia'),
};

describe('o passo render-document conferido contra o modelo do próprio pacote', () => {
  it('o passo que cumpre o contrato não gera problema nenhum', () => {
    expect(recusas(gerar({ ...CERTO, belongsTo: literal('outorgante'), destination: literal('record') }))).toEqual([]);
  });

  it('recusa o param.<chave> que o modelo não declara — em runtime ele seria ignorado e o campo sairia vazio', () => {
    expect(recusas(gerar({ ...CERTO, 'param.finalidad': literal('x') }))).toEqual(['unknown-parameter:param.finalidad']);
  });

  it('confere só a primeira parte do caminho: param.endereco.cidade preenche o parâmetro endereco', () => {
    expect(recusas(gerar({ ...CERTO, 'param.endereco.cidade': literal('Salvador') }))).toEqual([]);
    expect(recusas(gerar({ ...CERTO, 'param.endereço.cidade': literal('Salvador') })))
      .toEqual(['unknown-parameter:param.endereço.cidade']);
  });

  it('recusa o belongsTo que não é um parâmetro de registro único: texto, lista ou inexistente', () => {
    expect(recusas(gerar({ ...CERTO, belongsTo: literal('finalidade') }))).toEqual(['belongs-to-invalid:finalidade']);
    expect(recusas(gerar({ ...CERTO, belongsTo: literal('testemunhas') }))).toEqual(['belongs-to-invalid:testemunhas']);
    expect(recusas(gerar({ ...CERTO, belongsTo: literal('cliente') }))).toEqual(['belongs-to-invalid:cliente']);
  });

  it('recusa o parâmetro obrigatório sem valor', () => {
    const { 'param.finalidade': _omitido, ...semFinalidade } = CERTO;
    expect(_omitido).toBeDefined();
    expect(recusas(gerar(semFinalidade))).toEqual(['parameter-required:finalidade']);
  });

  it('o payload em bloco pode trazer o obrigatório, e por isso o dispensa', () => {
    expect(recusas(gerar({ templateKey: literal('procuracao'), payload: { kind: 'Output', stepId: 'montar', outputId: 'dados' } }))
      .filter((one) => one.startsWith('parameter-required'))).toEqual([]);
  });

  it('recusa recordId num modelo de dados — a mesma regra de origem que o editor do passo aplica', () => {
    expect(recusas(gerar({ ...CERTO, recordId: event('id') }))).toEqual(['record-only:recordId']);
  });

  it('recusa anexar ao registro sem dizer qual é o dono', () => {
    expect(recusas(gerar({ ...CERTO, destination: literal('record') }))).toEqual(['destination-without-owner:']);
    expect(recusas(gerar({ ...CERTO, destination: literal('downloads') }))).toEqual([]);
  });

  it('num modelo de registro, recusa param.*, payload e belongsTo, e exige recordId', () => {
    expect(recusas(gerar({
      templateKey: literal('ficha'),
      'param.nome': literal('x'),
      payload: { kind: 'Expression', expression: 'event' } as InputMapping,
      belongsTo: literal('x'),
    }))).toEqual(['payload-only:payload', 'payload-only:belongsTo', 'payload-only:param.nome', 'input-required:recordId']);
    expect(recusas(gerar({ templateKey: literal('ficha'), recordId: event('id') }))).toEqual([]);
  });

  it('um modelo de dados sem parâmetros aceita qualquer objeto, e nenhuma chave é conferida', () => {
    const livre = procuracao({ parameters: undefined });
    expect(recusas(gerar({ templateKey: literal('procuracao'), 'param.qualquer': literal('x') }), [livre])).toEqual([]);
  });

  it('não confere o que não enxerga: modelo de fora do pacote, ou chave que só se conhece em runtime', () => {
    expect(recusas(gerar({ templateKey: literal('de-outro-pacote'), 'param.x': literal('x') }))).toEqual([]);
    expect(recusas(gerar({ templateKey: event('modelo'), 'param.x': literal('x') }))).toEqual([]);
  });
});

describe('o contrato de um modelo — a forma, nunca o texto', () => {
  it('leva chave, origem e a forma de cada parâmetro, e nada do conteúdo', () => {
    expect(declaredDocumentTemplates([documentTemplateContribution(procuracao())])).toEqual([{
      key: 'procuracao',
      source: 'payload',
      parameters: [
        { key: 'outorgante', type: 'EntityReference', entityType: 'pessoas', required: true },
        { key: 'testemunhas', type: 'EntityReference', entityType: 'pessoas', list: true },
        { key: 'finalidade', type: 'String', required: true },
        { key: 'endereco', type: 'Object' },
      ],
    }]);
  });

  it('a origem ausente é registro, o comportamento de antes do campo', () => {
    expect(documentTemplateContractOf(ficha)).toEqual({ key: 'ficha', source: 'record', parameters: [] });
  });

  it('o que não tem forma de modelo fica de fora, sem lançar', () => {
    expect(documentTemplateContractOf(null)).toBeNull();
    expect(documentTemplateContractOf({ title: 'sem chave' })).toBeNull();
  });
});
