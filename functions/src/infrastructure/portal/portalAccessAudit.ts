import type { CreateAuditLogUseCase } from '../../domain/usecases/CreateAuditLogUseCase';
import type { PortalAccessAudit } from '../../domain/usecases/PortalAccessUseCases';
import type { PortalSignInAudit } from '../../domain/repositories/IPortalIdentity';
import { parsePortalSubjectKey } from '../../domain/schema/portal';

/**
 * A linha de Auditoria do acesso de alguém de fora. Aponta para o registro-sujeito (o clique o abre) e
 * diz de onde veio o gesto — a tela de Configurações ou uma automação, com o id dela —, porque é a
 * pergunta que o escritório faz quando descobre um convidado que não reconhece.
 *
 * O convite por identidade diz também QUAL atributo a pessoa terá de provar — o nome, nunca o valor:
 * o valor é dado pessoal, e fica no convite, que só quem administra o portal lê.
 */
export const makePortalAccessAudit = (createAuditLog: CreateAuditLogUseCase): PortalAccessAudit =>
  async ({ tenantId, change, email, subjectKey, actor, origin, workflowId, claimName }) => {
    const subject = subjectKey ? parsePortalSubjectKey(subjectKey) : null;
    await createAuditLog.execute({
      tenantId,
      title: claimName ? `@core.tenant/portal.audit.${change}-identity` : `@core.tenant/portal.audit.${change}`,
      titleParams: { email, ...(claimName ? { claim: claimName } : {}) },
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

/**
 * A linha de Auditoria de cada entrada por um provedor — a prova de QUEM entrou, e com que garantia.
 *
 * A aceita guarda o provedor, a claim provada (com o valor: é ela que responde à contestação de quem
 * praticou o ato) e o nível de confiabilidade. A recusada guarda o motivo e, quando havia um convite em
 * questão, o contato e o NOME da claim — nunca o valor que a pessoa tentou: quem sonda o portal não
 * deixa no escritório uma lista de documentos alheios. A recusa é severidade alta: é tentativa de
 * acesso que não passou.
 */
export const makePortalSignInAudit = (createAuditLog: CreateAuditLogUseCase): PortalSignInAudit =>
  async ({ tenantId, outcome, provider, userId, name, verified, reason, email, claimName }) => {
    const who = name || email || provider;
    await createAuditLog.execute({
      tenantId,
      title: `@core.tenant/portal.audit.signin.${outcome}`,
      titleParams: { name: who, provider },
      userId: userId || 'portal',
      userName: who,
      photoURL: '',
      action: 'SYSTEM',
      severity: outcome === 'refused' ? 'HIGH' : 'LOW',
      type: 'AUDIT',
      entity: 'portal',
      entityId: userId || provider,
      ...(outcome === 'verified'
        ? {
          text: '@core.tenant/portal.audit.signin.verified.detail',
          textParams: {
            provider,
            claim: verified?.claim ? `${verified.claim.name} = ${verified.claim.value}` : '—',
            level: verified?.level ?? '—',
          },
        }
        : {
          text: `@core.tenant/portal.audit.signin.refused.${reason ?? 'token'}`,
          textParams: { provider, email: email ?? '', claim: claimName ?? '' },
        }),
    });
  };
