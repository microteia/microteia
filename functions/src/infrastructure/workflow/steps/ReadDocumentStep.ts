import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
import { READ_DOCUMENT_STEP_ID } from '../../../domain/schema/documentRead';
import type { ReadRecordDocumentUseCase } from '../../../domain/usecases/ReadRecordDocumentUseCase';

const textOf = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

/**
 * O passo `read-document`. Lê, não grava: pode ser reexecutado à vontade, e roda como o escritório, como os
 * outros passos de dados — quem escolheu o registro foi quem escreveu a automação.
 */
export const makeReadDocumentStepDefinition = (readDocument: () => ReadRecordDocumentUseCase): StepDefinition => ({
  ...coreStepMetadata(READ_DOCUMENT_STEP_ID),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const result = await readDocument().execute({
        tenantId: context.execution.tenantId,
        collection: textOf(inputs.collection),
        recordId: textOf(inputs.recordId),
        documentId: textOf(inputs.documentId),
        pages: textOf(inputs.pages),
        layout: textOf(inputs.layout) === 'lines' ? 'lines' : 'flat',
      });
      if (!result.ok) return { success: false, message: result.error, messageParams: result.errorParams };

      return {
        success: true,
        message: result.hasText
          ? '@core.automation/step.read-document.done'
          : '@core.automation/step.read-document.no-text',
        messageParams: {
          name: result.name,
          pages: String(result.pagesRead.length),
          count: String(result.text.length),
        },
        outputs: {
          text: result.text,
          hasText: result.hasText,
          pageCount: result.pageCount,
          pagesRead: result.pagesRead.length,
          name: result.name,
          contentType: result.contentType,
          size: result.size,
          sha256: result.sha256,
        },
      };
    },
  }),
});
