import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { WorkflowContext, WorkflowResult } from '../../../domain/entities/WorkflowContext';
import type { ShareRecordDocumentsUseCase } from '../../../domain/usecases/ShareRecordDocumentsUseCase';

const WORKFLOW_ACTOR = 'workflow-engine';

const textOf = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

const booleanOf = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  const text = textOf(value).toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return fallback;
};

/**
 * Quem responde pela troca, pela regra de `render-document`: com uma pessoa DO ESCRITÓRIO por trás,
 * ela; sem pessoa — ou com o convidado do portal, que só disparou a automação do escritório —, o motor.
 */
const actorOf = (context: WorkflowContext): string =>
  context.actor && context.actor.via !== 'portal' ? context.actor.userId : WORKFLOW_ACTOR;

/**
 * O passo `share-documents`: compartilha com o portal (ou deixa de compartilhar) os documentos que um
 * registro já tem. A permissão não é cobrada de quem disparou, como em toda gravação do motor: a
 * automação é do escritório, e quem a escreveu já podia editar a tela.
 */
export const makeShareDocumentsStepDefinition = (shareDocuments: ShareRecordDocumentsUseCase): StepDefinition => ({
  ...coreStepMetadata('share-documents'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const documentId = textOf(inputs.documentId);
      const documentType = textOf(inputs.documentType);
      const result = await shareDocuments.execute({
        tenantId: context.execution.tenantId,
        collection: textOf(inputs.collection),
        recordId: textOf(inputs.recordId),
        shared: booleanOf(inputs.shared, true),
        ...(documentId ? { documentId } : {}),
        ...(documentType ? { documentType } : {}),
        actorUid: actorOf(context),
      });

      if (!result.ok) return { success: false, message: result.error, messageParams: result.errorParams };
      return {
        success: true,
        message: '@core.automation/step.share-documents.done',
        messageParams: { changed: String(result.changed), matched: String(result.matched) },
        outputs: { matched: result.matched, changed: result.changed, shared: result.shared },
      };
    },
  }),
});
