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
 *
 * O papel (EV-38) vai no título do vínculo novo que nasce com um, e a troca do papel de um vínculo que
 * já existia é uma linha própria: é mudança de poder, e o escritório pergunta por ela como pergunta
 * pelo convite.
 */
const AUDIT_ACTION = { granted: 'CREATE', revoked: 'DELETE', role: 'UPDATE' } as const;

export const makePortalAccessAudit = (createAuditLog: CreateAuditLogUseCase): PortalAccessAudit =>
  async ({ tenantId, change, email, subjectKey, actor, origin, workflowId, claimName, role }) => {
    const subject = subjectKey ? parsePortalSubjectKey(subjectKey) : null;
    const withRole = !!role && change === 'granted' ? '-role' : '';
    await createAuditLog.execute({
      tenantId,
      title: `@core.tenant/portal.audit.${change}${claimName ? '-identity' : ''}${withRole}`,
      titleParams: { email, ...(claimName ? { claim: claimName } : {}), ...(role ? { role } : {}) },
      userId: actor.userId,
      userName: actor.userName,
      photoURL: '',
      action: AUDIT_ACTION[change],
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
