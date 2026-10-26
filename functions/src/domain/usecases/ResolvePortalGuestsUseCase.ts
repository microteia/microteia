import type { IPortalRepository } from '../repositories/IPortalRepository';
import type { PortalGuestContact } from '../repositories/INotificationDelivery';
import type { RecordLinkTarget } from '../schema/recordLink';
import { portalScreenOf, portalTargetScreen, resolvePortalSubjectKeys } from '../schema/portal';

export interface PortalGuestsOfRecord {
  /** O registro está no portal: a tela dele declara portal, ele passa no filtro e chega a um sujeito. */
  inPortal: boolean;
  guests: PortalGuestContact[];
}

export type ResolvePortalGuestsUseCase = {
  execute: (tenantId: string, target: RecordLinkTarget) => Promise<PortalGuestsOfRecord>;
};

/**
 * Quem, de FORA, vê este registro agora.
 *
 * A pergunta é a mesma da projeção — a corrente até o sujeito, com `visibleWhen` em cada elo —, mas
 * feita na hora, sobre o registro como está gravado: o aviso de um registro recém-criado não pode
 * esperar a projeção dele existir. E os convidados vêm dos convites VIVOS (`audienceFor` e o convite de
 * cada um), não do `audience` da projeção, que é refeito segundos depois de uma revogação.
 *
 * Quem recebe é, por construção, quem consegue abrir o link: um registro escondido não leva aviso a
 * ninguém, nem a confirmação de que existe.
 */
export const makeResolvePortalGuestsUseCase = (repo: IPortalRepository): ResolvePortalGuestsUseCase => ({
  execute: async (tenantId, target) => {
    const closed: PortalGuestsOfRecord = { inPortal: false, guests: [] };
    const screens = await repo.getScreens(tenantId);
    const screen = portalScreenOf(screens, target.collection);
    if (!screen) return closed;
    const data = await repo.getRecord(tenantId, screen.collection, target.recordId);
    if (!data) return closed;
    const subjectKeys = await resolvePortalSubjectKeys(screen, target.recordId, data, {
      screenFor: (entityKey) => portalTargetScreen(screens, entityKey),
      getRecord: (collection, id) => repo.getRecord(tenantId, collection, id),
    });
    if (subjectKeys.length === 0) return closed;

    const userIds = await repo.audienceFor(tenantId, subjectKeys);
    const invites = await Promise.all(userIds.map((userId) => repo.getPortalUser(tenantId, userId)));
    const guests = invites.flatMap((invite): PortalGuestContact[] =>
      // O suspenso não abre o portal: avisá-lo seria mandar um link para o que ele não consegue ver.
      invite && invite.email && !invite.suspended && invite.subjectKeys.some((key) => subjectKeys.includes(key))
        ? [{ userId: invite.userId, email: invite.email, ...(invite.locale ? { locale: invite.locale } : {}) }]
        : []);
    return { inPortal: true, guests };
  },
});
