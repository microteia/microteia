import { describe, expect, it } from 'vitest';
import { makeReadDocumentStepDefinition } from './ReadDocumentStep';
import type { ReadRecordDocumentRequest, ReadRecordDocumentResult } from '../../../domain/usecases/ReadRecordDocumentUseCase';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';

const logger = { info: () => {}, warn: () => {}, error: () => {} };
const context = { execution: { id: 'x1', workflowDefinitionId: 'w1', tenantId: 't1' }, logger } as unknown as WorkflowContext;

const stepWith = (result: ReadRecordDocumentResult, seen: ReadRecordDocumentRequest[] = []) =>
  makeReadDocumentStepDefinition(() => ({
    execute: async (request) => {
      seen.push(request);
      return result;
    },
  })).createExecutor();

const READ: ReadRecordDocumentResult = {
  ok: true,
  documentId: 'd1',
  name: 'conta.pdf',
  contentType: 'application/pdf',
  size: 10,
  sha256: 'abc',
  text: 'p1\fp2',
  pageCount: 3,
  pagesRead: [1, 2],
  hasText: true,
};

describe('passo "Ler documento"', () => {
  it('leva o tenant da execução, nunca da entrada, e publica o texto e o que o acompanha', async () => {
    const seen: ReadRecordDocumentRequest[] = [];
    const result = await stepWith(READ, seen).execute(
      { collection: 'bills', recordId: 'b1', documentId: 'd1', pages: '1-2', layout: 'lines', tenantId: 'outro' },
      context,
    );
    expect(seen[0]).toEqual({ tenantId: 't1', collection: 'bills', recordId: 'b1', documentId: 'd1', pages: '1-2', layout: 'lines' });
    expect(result).toMatchObject({
      success: true,
      message: '@core.automation/step.read-document.done',
      outputs: { text: 'p1\fp2', hasText: true, pageCount: 3, pagesRead: 2, name: 'conta.pdf', sha256: 'abc' },
    });
  });

  it('disposição desconhecida cai em uma linha; documento sem texto é sucesso com aviso próprio', async () => {
    const seen: ReadRecordDocumentRequest[] = [];
    const result = await stepWith({ ...READ, text: '', hasText: false }, seen)
      .execute({ collection: 'bills', recordId: 'b1', documentId: 'd1', layout: 'colunas' }, context);
    expect(seen[0].layout).toBe('flat');
    expect(result).toMatchObject({ success: true, message: '@core.automation/step.read-document.no-text' });
  });

  it('a recusa do caso de uso vira falha do passo, com a mensagem dele', async () => {
    const result = await stepWith({ ok: false, error: '@core.automation/step.read-document.encrypted', errorParams: { name: 'x.pdf' } })
      .execute({ collection: 'bills', recordId: 'b1', documentId: 'd1' }, context);
    expect(result).toEqual({ success: false, message: '@core.automation/step.read-document.encrypted', messageParams: { name: 'x.pdf' } });
  });
});
