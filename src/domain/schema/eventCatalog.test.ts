import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_EVENT_CATALOG,
  WORKFLOW_CALLED_EVENT,
  eventNameToEntityKey,
  eventNameToRoot,
  getWorkflowEventFields,
  workflowParametersToRoot,
  workflowParametersToFieldOptions,
} from './eventCatalog';
import { createSchemaContext, resolvePath, parsePath } from './pathResolver';
import type { WorkflowParameter } from '../entities/Workflow';

const entry = (name: string) => WORKFLOW_EVENT_CATALOG.find((e) => e.name === name);
const paths = (name: string) => (entry(name)?.fields ?? []).map((f) => f.path);

describe('eventCatalog — derivação do registry', () => {
  it('mantém os eventos das entidades com rótulos PT-BR', () => {
    expect(entry('person.saved')?.label).toBe('Ao salvar: Pessoa');
    expect(entry('case.deleted')?.label).toBe('Ao excluir: Processo');
    expect(entry('custom_record.saved')?.label).toBe('Ao salvar: Entidade Customizada');
    expect(entry('lookup.saved')?.label).toBe('Ao salvar: Item de Lista');
  });

  it('deriva os caminhos denormalizados das FKs (fim do hardcode)', () => {
    const casePaths = paths('case.saved');
    expect(casePaths).toEqual(
      expect.arrayContaining(['contract.id', 'contract.number', 'contract.title', 'responsibleLawyer.name', 'contractId']),
    );
    const caseEntry = entry('case.saved');
    expect(caseEntry?.fields.find((f) => f.path === 'contract.number')?.label).toBe('Contrato: Número');
    expect(paths('deadline.saved')).toEqual(expect.arrayContaining(['case.caseNumber', 'case.title', 'case.area']));
    expect(paths('financial.saved')).toEqual(expect.arrayContaining(['person.name', 'contract.number']));
  });

  it('inclui old apenas em eventos saved', () => {
    expect(paths('person.saved')).toContain('old');
    expect(paths('person.deleted')).not.toContain('old');
  });

  it('achata campos de objeto aninhado (address)', () => {
    expect(paths('person.saved')).toContain('address.city');
  });

  it('não oferece eventos de news (nunca publicados pelo backend)', () => {
    expect(entry('news.saved')).toBeUndefined();
  });

  it('gera eventos de nota/documento com pai denormalizado do registry', () => {
    expect(paths('case_note.saved')).toEqual(expect.arrayContaining(['content', 'parent.id', 'parent.caseNumber']));
    expect(paths('financial_document.deleted')).toEqual(expect.arrayContaining(['fileName', 'parent.amount']));
    expect(entry('deadline_document.saved')).toBeUndefined();
  });
});

describe('getWorkflowEventFields', () => {
  it('prefixa campos dinâmicos de entidades fixas com customValues.', () => {
    const fields = getWorkflowEventFields('case.saved', [{ path: 'tarefa', label: 'Tarefa' }]);
    expect(fields.map((f) => f.path)).toContain('customValues.tarefa');
    expect(fields.map((f) => f.path)).not.toContain('customValues');
  });

  it('prefixa campos de tela dinâmica com values. (payload real de customRecords)', () => {
    const fields = getWorkflowEventFields('custom_record.saved', [{ path: 'nome', label: 'Nome' }]);
    expect(fields.map((f) => f.path)).toContain('values.nome');
    expect(fields.map((f) => f.path)).not.toContain('values');
  });
});

describe('eventNameToRoot / eventNameToEntityKey', () => {
  it('resolve raiz de entidade com hasOld por ação', () => {
    expect(eventNameToRoot('case.saved')).toMatchObject({ kind: 'entity', entityKey: 'cases', hasOld: true });
    expect(eventNameToRoot('case.deleted')).toMatchObject({ hasOld: false });
  });

  it('anexa screenKey à raiz de custom_record', () => {
    expect(eventNameToRoot('custom_record.saved', 'tarefas')).toMatchObject({
      kind: 'entity',
      entityKey: 'customRecords',
      screenKey: 'tarefas',
    });
  });

  it('resolve raiz de campos para eventos de sistema e lookup', () => {
    expect(eventNameToRoot('lookup.saved')?.kind).toBe('fields');
    expect(eventNameToRoot('case_note.saved')?.kind).toBe('fields');
    expect(eventNameToRoot('desconhecido.saved')).toBeNull();
  });

  it('mantém o mapeamento legado de entityKey', () => {
    expect(eventNameToEntityKey('case.saved')).toBe('cases');
    expect(eventNameToEntityKey('lookup.saved')).toBe('lookups');
    expect(eventNameToEntityKey('custom_record.saved')).toBeNull();
  });
});

describe('workflow.called — parâmetros dinâmicos', () => {
  const parameters: WorkflowParameter[] = [
    { key: 'titulo', label: 'Título', type: 'String' },
    { key: 'processo', label: 'Processo', type: 'EntityReference', entityType: 'cases' },
  ];

  it('oferece o evento "Chamado por outro workflow" com raiz de campos', () => {
    const entry = WORKFLOW_EVENT_CATALOG.find((e) => e.name === WORKFLOW_CALLED_EVENT);
    expect(entry?.label).toBe('Chamado por outro workflow');
    expect(eventNameToRoot(WORKFLOW_CALLED_EVENT)?.kind).toBe('fields');
  });

  it('constrói a raiz a partir dos parâmetros declarados', () => {
    const root = workflowParametersToRoot(parameters);
    expect(root.kind).toBe('fields');
    if (root.kind !== 'fields') return;
    expect(root.fields.map((f) => f.key)).toEqual(['titulo', 'processo']);
    expect(root.fields.find((f) => f.key === 'processo')).toMatchObject({ refEntity: 'cases' });
  });

  it('hidrata um parâmetro-referência: event.processo.title gera hop para cases', () => {
    const ctx = createSchemaContext();
    const root = workflowParametersToRoot(parameters);
    const resolution = resolvePath(ctx, root, parsePath('processo.title'));
    expect(resolution.valid).toBe(true);
    expect(resolution.node.kind).toBe('scalar');
    expect(resolution.hops).toEqual(
      expect.arrayContaining([expect.objectContaining({ targetCollection: 'cases', materializeAt: 'processo' })]),
    );
  });

  it('lista opções de campo com drill nas referências', () => {
    const options = workflowParametersToFieldOptions(parameters).map((o) => o.path);
    expect(options).toContain('titulo');
    expect(options).toContain('processo');
    expect(options).toContain('processo.id');
  });
});
