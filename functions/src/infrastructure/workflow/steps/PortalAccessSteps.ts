import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { WorkflowContext, WorkflowResult } from '../../../domain/entities/WorkflowContext';
import { DomainError } from '../../../domain/errors/DomainError';
import type {
  InvitePortalUserUseCase,
  PortalAccessActor,
  RevokePortalUserUseCase,
} from '../../../domain/usecases/PortalAccessUseCases';
import type { DispatchNotificationUseCase } from '../../../domain/usecases/DispatchNotificationUseCase';
import { portalSubjectKey } from '../../../domain/schema/portal';
import { PORTAL_INVITE_STEP_ID, PORTAL_REVOKE_STEP_ID } from '../../../domain/schema/workflowStepCatalog';

const WORKFLOW_ACTOR: PortalAccessActor = { userId: 'workflow-engine', userName: '@core.automation/run.actor' };

export interface PortalAccessStepServices {
  invite: InvitePortalUserUseCase;
  revoke: RevokePortalUserUseCase;
  dispatchNotification: DispatchNotificationUseCase;
  tenantName: (tenantId: string) => Promise<string>;
  /** O idioma ESCOLHIDO pelo escritório; sem escolha, o convidado fica com o do navegador dele. */
  officeLocale: (tenantId: string) => Promise<string | undefined>;
}

const textOf = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

const booleanOf = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  const text = textOf(value).toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return fallback;
};

/**
 * Quem responde pelo convite, pela regra de `share-documents`: com uma pessoa DO ESCRITÓRIO por trás,
 * ela; sem pessoa — ou com o convidado do portal, que só disparou a automação do escritório —, o motor.
 * A permissão de quem disparou não é cobrada: quem abre a porta é a declaração da tela.
 */
const actorOf = (context: WorkflowContext): PortalAccessActor =>
  context.actor && context.actor.via !== 'portal'
    ? { userId: context.actor.userId, userName: context.actor.name }
    : WORKFLOW_ACTOR;

interface SubjectInputs {
  subjectKey: string;
  collection: string;
  recordId: string;
  email: string;
}

const subjectInputsOf = (inputs: Record<string, unknown>): SubjectInputs | WorkflowResult => {
  const collection = textOf(inputs.subjectCollection);
  const recordId = textOf(inputs.subjectRecordId);
  const email = textOf(inputs.email);
  if (!collection || !recordId) return { success: false, message: '@core.automation/step.portal-access.subject-missing' };
  if (!email) return { success: false, message: '@core.tenant/portal.email.invalid' };
  return { subjectKey: portalSubjectKey(collection, recordId), collection, recordId, email };
};

/**
 * A claim exigida, quando o passo pede uma. O NOME ligado e o valor vazio NÃO viram convite pelo
 * e-mail: o caso de uso recusa o valor vazio, e o passo falha — cair no convite comum abriria a conta
 * do e-mail para quem o escritório quis que provasse quem é.
 */
const requiredClaimOf = (inputs: Record<string, unknown>): Record<string, unknown> | undefined => {
  const name = textOf(inputs.requiredClaimName);
  if (!name) return undefined;
  const normalize = textOf(inputs.requiredClaimNormalize);
  return { name, value: textOf(inputs.requiredClaimValue), ...(normalize ? { normalize } : {}) };
};

/** A recusa prevista volta como resultado do passo, com a frase nomeada; a imprevista sobe ao motor. */
const refusalOf = (error: unknown): WorkflowResult => {
  if (error instanceof DomainError) return { success: false, message: error.message };
  throw error;
};

/**
 * O passo `portal-invite`: o MESMO convite de Configurações › Portal, feito pelo fluxo que validou o
 * registro do representante. O e-mail de boas-vindas sai só quando o vínculo é novo, pela porta única
 * de avisos — o e-mail do escritório, no idioma do convite, com o link do registro no portal —, e só
 * para quem acabou de ser convidado.
 */
export const makePortalInviteStepDefinition = (services: PortalAccessStepServices): StepDefinition => ({
  ...coreStepMetadata(PORTAL_INVITE_STEP_ID),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const subject = subjectInputsOf(inputs);
      if ('success' in subject) return subject;
      const { tenantId, workflowDefinitionId } = context.execution;
      const [tenantName, locale] = await Promise.all([services.tenantName(tenantId), services.officeLocale(tenantId)]);
      const displayName = textOf(inputs.displayName);
      const requiredClaim = requiredClaimOf(inputs);

      let result;
      try {
        result = await services.invite.execute({
          tenantId,
          tenantName,
          email: subject.email,
          subjectKey: subject.subjectKey,
          actor: actorOf(context),
          origin: 'automation',
          workflowId: workflowDefinitionId,
          ...(locale ? { locale } : {}),
          ...(displayName ? { displayName } : {}),
          ...(requiredClaim ? { requiredClaim } : {}),
        });
      } catch (error) {
        return refusalOf(error);
      }

      let emailed = false;
      const wantsEmail = result.granted && booleanOf(inputs.sendEmail, true);
      // O aviso do portal vai para uma CONTA que vê o registro; o convite por identidade só tem conta
      // depois do primeiro acesso. O log diz por que o e-mail não saiu, em vez de calar.
      if (wantsEmail && result.inviteId && !result.userId) {
        context.logger.info('@core.automation/step.portal-invite.identity-no-email', { email: subject.email });
      } else if (wantsEmail) {
        const delivery = await services.dispatchNotification.execute({
          tenantId,
          source: 'workflow',
          workflowId: workflowDefinitionId,
          executionId: context.execution.id,
          title: '@core.tenant/portal.invite.email.title',
          message: '@core.tenant/portal.invite.email.message',
          params: { office: tenantName },
          link: '',
          target: { collection: subject.collection, recordId: subject.recordId },
          audience: 'portal',
          channels: { audit: false, inApp: false, email: true, push: false },
          recipientIds: [result.userId],
          recipientPermissions: [],
        });
        for (const issue of delivery.issues) context.logger.warn(issue.message, issue.params);
        emailed = delivery.delivered.email > 0;
      }

      return {
        success: true,
        message: result.granted ? '@core.automation/step.portal-invite.done' : '@core.automation/step.portal-invite.unchanged',
        messageParams: { email: subject.email },
        outputs: {
          guestId: result.userId,
          created: result.created,
          granted: result.granted,
          emailed,
          inviteId: result.inviteId ?? '',
        },
      };
    },
  }),
});

/** O passo `portal-revoke`: tira o sujeito do convite — ou, com `allSubjects`, o convite inteiro. */
export const makePortalRevokeStepDefinition = (services: PortalAccessStepServices): StepDefinition => ({
  ...coreStepMetadata(PORTAL_REVOKE_STEP_ID),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const subject = subjectInputsOf(inputs);
      if ('success' in subject) return subject;
      let result;
      try {
        result = await services.revoke.execute({
          tenantId: context.execution.tenantId,
          guest: { email: subject.email },
          subjectKey: subject.subjectKey,
          allSubjects: booleanOf(inputs.allSubjects, false),
          actor: actorOf(context),
          origin: 'automation',
          workflowId: context.execution.workflowDefinitionId,
        });
      } catch (error) {
        return refusalOf(error);
      }
      return {
        success: true,
        message: result.revoked ? '@core.automation/step.portal-revoke.done' : '@core.automation/step.portal-revoke.unchanged',
        messageParams: { email: subject.email },
        outputs: { guestId: result.userId ?? '', revoked: result.revoked },
      };
    },
  }),
});
