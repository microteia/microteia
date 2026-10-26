import type { CreateAuditLogUseCase } from '../../domain/usecases/CreateAuditLogUseCase';
import type { PortalAccessAudit } from '../../domain/usecases/PortalAccessUseCases';
import { parsePortalSubjectKey } from '../../domain/schema/portal';

/**
 * A linha de Auditoria do acesso de alguém de fora. Aponta para o registro-sujeito (o clique o abre) e
 * diz de onde veio o gesto — a tela de Configurações ou uma automação, com o id dela —, porque é a
 * pergunta que o escritório faz quando descobre um convidado que não reconhece.
 */
export const makePortalAccessAudit = (createAuditLog: CreateAuditLogUseCase): PortalAccessAudit =>
  async ({ tenantId, change, email, subjectKey, actor, origin, workflowId }) => {
    const subject = subjectKey ? parsePortalSubjectKey(subjectKey) : null;
    await createAuditLog.execute({
      tenantId,
      title: `@core.tenant/portal.audit.${change}`,
      titleParams: { email },
      userId: actor.userId,
      userName: actor.userName,
      photoURL: '',
      action: change === 'granted' ? 'CREATE' : 'DELETE',
      type: 'AUDIT',
      entity: origin === 'automation' && workflowId ? 'workflow' : 'portal',
      entityId: origin === 'automation' && workflowId ? workflowId : email,
      ...(subject ? { linkCollection: subject.collection, linkRecordId: subject.recordId } : {}),
      text: `@core.tenant/portal.audit.origin.${origin}`,
    });
  };
