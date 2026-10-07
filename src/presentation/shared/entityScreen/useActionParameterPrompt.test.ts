import { describe, expect, it } from 'vitest';
import { buildPromptInitialValues } from './useActionParameterPrompt';
import type { ActionExprContext } from '../../../domain/schema/actionExpression';
import type { ActionDefinition } from '../../../domain/entities';
import type { WorkflowParameter } from '../../../domain/entities/Workflow';
import type { FieldDefinition } from '../../../domain/entities/entitySchemas';
import { createSchemaContext } from '../../../domain/schema/pathResolver';
import type { ReferenceNavigator } from '../../../domain/schema/referenceScope';

/**
 * O tradutor de teste devolve a chave MAIS os parâmetros. Sem os parâmetros o teste perderia
 * metade do que ele prova: qual ramo foi escolhido (função × campo) E que o nome do símbolo chega
 * até a mensagem.
 */
const echo = (key: string, params?: Record<string, unknown>) =>
  (params ? `${key} ${JSON.stringify(params)}` : key);

const action = (over: Partial<ActionDefinition> = {}): ActionDefinition => ({
  id: 'act-push-gerar-prazo',
  tenantId: 't1',
  key: 'push_gerar_prazo',
  title: 'Gerar prazo',
  icon: 'time',
  workflowId: 'wf-push-gerar-prazo',
  danger: false,
  enabled: true,
  order: 0,
  createdAt: new Date(),
  createdBy: 'u1',
  updatedAt: new Date(),
  ...over,
});

const param = (key: string): WorkflowParameter => ({ key, label: key, type: 'String', required: false });

const context = (values: Record<string, unknown>): ActionExprContext => ({
  values,
  record: values,
  isNew: false,
  isDirty: false,
  permissions: [],
  surface: 'list',
});

describe('buildPromptInitialValues', () => {
  it('o campo de MESMO NOME preenche o parâmetro, sem mapa nenhum', () => {
    const { values } = buildPromptInitialValues(echo, action(), [param('type')], context({ type: 'Petição' }));
    expect(values).toEqual({ type: 'Petição' });
  });

  /** O caso que motivou o mapa: a tela guarda `processNumber`, o fluxo pede `caseNumber`. */
  it('a expressão declarada vence o casamento por nome', () => {
    const { values } = buildPromptInitialValues(
      echo,
      action({ parameterDefaults: { caseNumber: 'processNumber' } }),
      [param('caseNumber')],
      context({ processNumber: '0801234-56.2024.8.05.0001', caseNumber: 'ignorado' }),
    );
    expect(values).toEqual({ caseNumber: '0801234-56.2024.8.05.0001' });
  });

  it('a expressão pode DERIVAR o valor, e não só copiar um campo', () => {
    const { values } = buildPromptInitialValues(
      echo,
      action({ parameterDefaults: { description: 'concat("Gerado a partir do push: ", subject)' } }),
      [param('description')],
      context({ subject: 'Intimação' }),
    );
    expect(values).toEqual({ description: 'Gerado a partir do push: Intimação' });
  });

  /**
   * O formulário abre EM BRANCO no que não souber responder — nunca com `null` ou `undefined`
   * escrito no campo, que é o que o usuário leria como valor.
   */
  it('parâmetro sem expressão e sem campo correspondente não entra', () => {
    const { values } = buildPromptInitialValues(
      echo,
      action({ parameterDefaults: { dueDate: '   ' } }),
      [param('dueDate'), param('priority')],
      context({ subject: 'Intimação', priority: null }),
    );
    expect(values).toEqual({});
  });

  it('expressão em branco cai no casamento por nome', () => {
    const { values } = buildPromptInitialValues(
      echo,
      action({ parameterDefaults: { type: '' } }),
      [param('type')],
      context({ type: 'Recurso' }),
    );
    expect(values).toEqual({ type: 'Recurso' });
  });

  it('calcula datas com addDays — a expressão que só existia no catálogo do Workflow', () => {
    const { values, failures } = buildPromptInitialValues(
      echo,
      action({ parameterDefaults: { dueDate: 'addDays("2026-08-12", if(type == "Embargos de Declaração", 5, 15))' } }),
      [param('dueDate')],
      context({ type: 'Embargos de Declaração' }),
    );
    expect(values).toEqual({ dueDate: '2026-08-17' });
    expect(failures).toEqual([]);
  });

  /**
   * O caso que motivou a mudança: a tela não abria e o erro só existia no console do navegador.
   * Agora o formulário abre, o parâmetro recai no campo de mesmo nome e a falha é relatada.
   */
  it('expressão que estoura vira falha relatada, sem derrubar o formulário', () => {
    const { values, failures } = buildPromptInitialValues(
      echo,
      action({ parameterDefaults: { dueDate: 'naoExisteEssaFuncao(today(), 5)' } }),
      [param('dueDate'), param('type')],
      context({ dueDate: '2026-08-12', type: 'Recurso' }),
    );
    expect(values).toEqual({ dueDate: '2026-08-12', type: 'Recurso' });
    expect(failures).toHaveLength(1);
    expect(failures[0].key).toBe('dueDate');
    expect(failures[0].message).toContain('naoExisteEssaFuncao');
    expect(failures[0].message).toContain('unknown-function-name');
  });

  it('campo inexistente na expressão é relatado como campo, não como função', () => {
    const { failures } = buildPromptInitialValues(
      echo,
      action({ parameterDefaults: { dueDate: 'campoQueNaoExiste + 1' } }),
      [param('dueDate')],
      context({}),
    );
    expect(failures[0].message).toContain('campoQueNaoExiste');
    expect(failures[0].message).toContain('unknown-field');
  });
});

const refField = (key: string, refEntity?: string): FieldDefinition => ({
  key,
  label: key,
  origin: 'design',
  type: refEntity ? 'reference' : 'text',
  ...(refEntity ? { refEntity } : {}),
  required: false,
  order: 0,
});

const schema = createSchemaContext([
  { id: 'pushes', collection: 'pushes', titleSingular: 'Push', titleFieldKey: 'subject', fields: [refField('subject'), refField('caseId', 'cases')] },
  { id: 'cases', collection: 'cases', titleSingular: 'Case', titleFieldKey: 'title', fields: [refField('title'), refField('responsibleLawyerId')] },
]);

const cases: Record<string, Record<string, unknown>> = {
  c1: { title: 'Cobrança', responsibleLawyerId: 'lawyer-ana' },
};

const references = (readable = true): ReferenceNavigator => ({
  schema,
  lookup: (collection, id) => (readable && collection === 'cases' ? (cases[id] ?? null) : null),
});

const generateDeadline = action({
  promptParameters: true,
  parameterDefaults: { responsibleLawyerId: 'caseId.responsibleLawyerId' },
});

describe('buildPromptInitialValues — referência navegada', () => {
  it.each(['detail', 'list'])('pré-preenche com o campo do registro apontado (%s)', (surface) => {
    const { values, failures } = buildPromptInitialValues(
      echo,
      generateDeadline,
      [param('responsibleLawyerId')],
      { ...context({ caseId: 'c1' }), surface, entity: 'pushes', references: references() },
    );
    expect(values).toEqual({ responsibleLawyerId: 'lawyer-ana' });
    expect(failures).toEqual([]);
  });

  it('referência vazia abre o campo vazio, sem falha', () => {
    const { values, failures } = buildPromptInitialValues(
      echo,
      generateDeadline,
      [param('responsibleLawyerId')],
      { ...context({ caseId: null }), entity: 'pushes', references: references() },
    );
    expect(values).toEqual({});
    expect(failures).toEqual([]);
  });

  it('registro de coleção que quem olha não lê abre o campo vazio', () => {
    const { values, failures } = buildPromptInitialValues(
      echo,
      generateDeadline,
      [param('responsibleLawyerId')],
      { ...context({ caseId: 'c1' }), entity: 'pushes', references: references(false) },
    );
    expect(values).toEqual({});
    expect(failures).toEqual([]);
  });

  /** A compatibilidade que justifica hidratar só o que é navegado: copiar a referência copia o id. */
  it('copiar a referência inteira continua copiando o id', () => {
    const { values } = buildPromptInitialValues(
      echo,
      action({ parameterDefaults: { linkedCaseId: 'caseId' } }),
      [param('linkedCaseId'), param('caseId')],
      { ...context({ caseId: 'c1' }), entity: 'pushes', references: references() },
    );
    expect(values).toEqual({ linkedCaseId: 'c1', caseId: 'c1' });
  });
});

describe('buildPromptInitialValues — defaultValue do fluxo como último recurso', () => {
  const withDefault = (key: string, defaultValue: unknown): WorkflowParameter => ({ ...param(key), defaultValue });

  it('sem expressão e sem campo de mesmo nome, abre com o defaultValue', () => {
    const { values } = buildPromptInitialValues(echo, action(), [withDefault('priority', 'NORMAL')], context({}));
    expect(values).toEqual({ priority: 'NORMAL' });
  });

  it('o campo de mesmo nome vence o defaultValue', () => {
    const { values } = buildPromptInitialValues(echo, action(), [withDefault('priority', 'NORMAL')], context({ priority: 'HIGH' }));
    expect(values).toEqual({ priority: 'HIGH' });
  });

  it('a expressão que responde vazio recai no defaultValue, não no campo de mesmo nome', () => {
    const { values } = buildPromptInitialValues(
      echo,
      action({ parameterDefaults: { priority: 'null' } }),
      [withDefault('priority', 'NORMAL')],
      context({ priority: 'HIGH' }),
    );
    expect(values).toEqual({ priority: 'NORMAL' });
  });
});
