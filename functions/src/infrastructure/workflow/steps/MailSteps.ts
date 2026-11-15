import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { WorkflowContext, WorkflowResult } from '../../../domain/entities/WorkflowContext';
import type { RecordDocumentAuthor } from '../../../domain/repositories/IRecordDocumentWriter';
import { MAIL_SEARCH_STEP_ID, SAVE_MAIL_ATTACHMENT_STEP_ID } from '../../../domain/schema/mailbox';
import { searchMailbox } from '../../../domain/services/mailSearch';
import type { MailSearchDeps } from '../../../domain/services/mailSearch';
import type { SaveMailAttachmentUseCase } from '../../../domain/usecases/SaveMailAttachmentUseCase';

const WORKFLOW_ACTOR = 'workflow-engine';

const textOf = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

const numberOf = (value: unknown): number | undefined => {
  const text = textOf(value);
  if (text === '') return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** O autor pela regra dos outros passos que anexam: a pessoa do escritório por trás, ou o motor sem nome. */
const authorOf = (context: WorkflowContext): RecordDocumentAuthor =>
  context.actor && context.actor.via !== 'portal'
    ? { uid: context.actor.userId, name: context.actor.name, photoUrl: context.actor.photoURL, via: context.actor.via }
    : { uid: WORKFLOW_ACTOR, name: null, via: 'automation' };

/**
 * O passo `save-mail-attachment`. A mensagem vem pela chave (`event.id` do gatilho "Ao receber e-mail"); sem
 * ela, ou com ela expirada, o passo reprova dizendo por quê.
 */
/** As dependências chegam por função: a fábrica é chamada na carga dos plugins, e o passo só as usa ao executar. */
export const makeSaveMailAttachmentStepDefinition = (saveMailAttachment: () => SaveMailAttachmentUseCase): StepDefinition => ({
  ...coreStepMetadata(SAVE_MAIL_ATTACHMENT_STEP_ID),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const nameContains = textOf(inputs.nameContains);
      const contentType = textOf(inputs.contentType);
      const documentType = textOf(inputs.documentType);
      const result = await saveMailAttachment().execute({
        tenantId: context.execution.tenantId,
        messageKey: textOf(inputs.message),
        collection: textOf(inputs.collection),
        recordId: textOf(inputs.recordId),
        ...(nameContains ? { nameContains } : {}),
        ...(contentType ? { contentType } : {}),
        ...(documentType ? { documentType } : {}),
        author: authorOf(context),
      });
      if (!result.ok) return { success: false, message: result.error, messageParams: result.errorParams };

      for (const name of result.tooLarge) {
        context.logger.warn('@core.automation/step.save-mail-attachment.too-large', { name });
      }
      return {
        success: true,
        message: result.saved.length > 0
          ? '@core.automation/step.save-mail-attachment.done'
          : '@core.automation/step.save-mail-attachment.none',
        messageParams: { count: String(result.saved.length) },
        outputs: {
          count: result.saved.length,
          documents: result.saved.map((document) => ({ id: document.id, name: document.name, url: document.url, size: document.size })),
          tooLarge: result.tooLarge,
        },
      };
    },
  }),
});

/**
 * O passo `mail-search`. A caixa é escolhida pelo id — tipicamente o da mensagem que disparou
 * (`event.mailboxId`); a que esta automação não pode ver responde como inexistente.
 */
export const makeMailSearchStepDefinition = (deps: () => MailSearchDeps): StepDefinition => ({
  ...coreStepMetadata(MAIL_SEARCH_STEP_ID),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const days = numberOf(inputs.days);
      const limit = numberOf(inputs.limit);
      const result = await searchMailbox(
        {
          tenantId: context.execution.tenantId,
          workflowId: context.execution.workflowDefinitionId,
          mailboxId: textOf(inputs.mailbox),
          from: textOf(inputs.from),
          subject: textOf(inputs.subject),
          ...(days !== undefined ? { days } : {}),
          ...(limit !== undefined ? { limit } : {}),
          includeBody: inputs.includeBody === true || textOf(inputs.includeBody).toLowerCase() === 'true',
        },
        deps(),
      );
      if (!result.ok) return { success: false, message: result.error, messageParams: result.errorParams };
      return {
        success: true,
        message: '@core.automation/step.mail-search.done',
        messageParams: { count: String(result.messages.length), name: result.mailboxName },
        outputs: {
          count: result.messages.length,
          messages: result.messages,
          first: result.messages[0] ?? null,
        },
      };
    },
  }),
});
