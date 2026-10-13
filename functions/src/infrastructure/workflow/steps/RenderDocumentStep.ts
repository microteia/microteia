import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { WorkflowContext, WorkflowResult } from '../../../domain/entities/WorkflowContext';
import type { RenderDocumentUseCase } from '../../../domain/usecases/RenderDocumentUseCase';
import type { RecordDocumentAuthor } from '../../../domain/repositories/IRecordDocumentWriter';
import type { DocumentOutputFormat } from '../../../domain/schema/document/documentTemplate';
import { DOCUMENT_OUTPUT_FORMATS } from '../../../domain/schema/document/documentTemplate';

const WORKFLOW_ACTOR = 'workflow-engine';

const textOf = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

/**
 * O autor do anexo pela regra da gravação de registro: com uma pessoa por trás, ela; sem pessoa, o
 * motor — e sem nome, para a aba não atribuir a ninguém o que a automação fez.
 */
const authorOf = (context: WorkflowContext): RecordDocumentAuthor =>
  context.actor
    ? { uid: context.actor.userId, name: context.actor.name, photoUrl: context.actor.photoURL, via: context.actor.via }
    : { uid: WORKFLOW_ACTOR, name: null, via: 'automation' };

const outputOf = (value: unknown): DocumentOutputFormat | undefined => {
  const text = textOf(value).toLowerCase();
  return (DOCUMENT_OUTPUT_FORMATS as readonly string[]).includes(text) ? (text as DocumentOutputFormat) : undefined;
};

/**
 * O passo `render-document`: gera o documento do registro e o anexa à aba Documentos.
 *
 * Um formato pedido que não é PDF nem DOCX reprova o passo em vez de cair no padrão: o fluxo pediu
 * uma coisa, e entregar outra em silêncio seria pior que dizer que não dá.
 *
 * Expressão do modelo que falha não reprova: o campo sai vazio, o log diz qual foi, e a saída
 * `emptyFields` deixa o fluxo decidir — reenviar, avisar alguém, seguir.
 */
export const makeRenderDocumentStepDefinition = (renderDocument: RenderDocumentUseCase): StepDefinition => ({
  ...coreStepMetadata('render-document'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const requested = textOf(inputs.output);
      const output = outputOf(requested);
      if (requested && !output) {
        return {
          success: false,
          message: '@core.documents/render.output-unsupported',
          messageParams: { format: '', output: requested },
        };
      }

      const fileName = textOf(inputs.fileName);
      const documentType = textOf(inputs.documentType);
      const result = await renderDocument.execute({
        tenantId: context.execution.tenantId,
        templateKey: textOf(inputs.templateKey),
        recordId: textOf(inputs.recordId),
        ...(output ? { output } : {}),
        ...(fileName ? { fileName } : {}),
        ...(documentType ? { documentType } : {}),
        author: authorOf(context),
        ...(context.actor ? { permissions: context.actor.permissions } : {}),
      });

      if (!result.ok) return { success: false, message: result.error, messageParams: result.errorParams };

      for (const issue of result.issues) {
        context.logger.warn('@core.documents/render.field-empty', { expression: issue.expression, detail: issue.detail });
      }

      return {
        success: true,
        message: '@core.automation/step.render-document.done',
        messageParams: { name: result.document.name },
        outputs: {
          documentId: result.document.id,
          name: result.document.name,
          url: result.document.url,
          format: result.output,
          emptyFields: result.issues.length,
        },
      };
    },
  }),
});
