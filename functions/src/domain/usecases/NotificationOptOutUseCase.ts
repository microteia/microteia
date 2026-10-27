import type { CreateAuditLogUseCase } from './CreateAuditLogUseCase';
import type { INotificationContactLog } from '../repositories/INotificationDelivery';
import type { ContactChannel } from '../schema/notificationContacts';
import { isOptOutTicket, maskContactAddress } from '../schema/notificationContacts';
import { invalidArgument, notFound } from '../errors/DomainError';

export type NotificationOptOutOperation = 'get' | 'opt-out' | 'opt-in';

export interface NotificationOptOutRequest {
  tenantId: string;
  ticket: string;
  op: NotificationOptOutOperation;
}

/** O que a página mostra: o escritório, o canal, o endereço MASCARADO e a decisão atual. */
export interface NotificationOptOutState {
  tenant: string;
  channel: ContactChannel;
  address: string;
  optedOut: boolean;
}

export interface NotificationOptOutDeps {
  contacts: INotificationContactLog;
  audit: CreateAuditLogUseCase;
  tenantName: (tenantId: string) => Promise<string>;
  now: () => Date;
}

export type NotificationOptOutUseCase = {
  execute: (request: NotificationOptOutRequest) => Promise<NotificationOptOutState>;
};

const TENANT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const DECISION_TITLES: Record<ContactChannel, { unsubscribed: string; resubscribed: string }> = {
  email: {
    unsubscribed: '@core.automation/notifications.contacts.audit.email.unsubscribed',
    resubscribed: '@core.automation/notifications.contacts.audit.email.resubscribed',
  },
  sms: {
    unsubscribed: '@core.automation/notifications.contacts.audit.sms.unsubscribed',
    resubscribed: '@core.automation/notifications.contacts.audit.sms.resubscribed',
  },
};

/**
 * O descadastro de quem recebe avisos num ENDEREÇO — sem conta, sem sessão, só com o link que a
 * mensagem trouxe.
 *
 * O link é a credencial, e ele vale exatamente o que diz: aquele endereço, naquele escritório, naquele
 * canal. O bilhete é um HMAC que só o servidor calcula, e um bilhete que nunca foi enviado não existe —
 * por isso não há o que adivinhar, e um bilhete inventado não grava nada.
 *
 * Abrir a página não descadastra: só o botão. Os filtros de e-mail das empresas abrem todo link de uma
 * mensagem para conferi-lo, e um GET que descadastrasse tiraria da lista quem nunca pediu.
 *
 * A decisão vale a partir do próximo envio e fica na Auditoria do escritório, com o endereço inteiro:
 * é o escritório que precisa saber que aquela pessoa não recebe mais o aviso por ali.
 */
export const makeNotificationOptOutUseCase = (deps: NotificationOptOutDeps): NotificationOptOutUseCase => ({
  execute: async ({ tenantId, ticket, op }) => {
    if (!TENANT_ID_PATTERN.test(tenantId) || !isOptOutTicket(ticket)) {
      throw notFound('@core.automation/notifications.opt-out.not-found');
    }
    if (op !== 'get' && op !== 'opt-out' && op !== 'opt-in') {
      throw invalidArgument('@core.automation/notifications.opt-out.op-invalid');
    }
    const contact = await deps.contacts.find(tenantId, ticket);
    if (!contact) throw notFound('@core.automation/notifications.opt-out.not-found');

    const wanted = op === 'get' ? contact.optedOut : op === 'opt-out';
    if (wanted !== contact.optedOut) {
      await deps.contacts.setOptedOut(tenantId, ticket, wanted, deps.now());
      await deps.audit.execute({
        tenantId,
        title: DECISION_TITLES[contact.channel][wanted ? 'unsubscribed' : 'resubscribed'],
        titleParams: { address: contact.address },
        userId: 'system',
        userName: '@core.automation/notifications.contacts.actor',
        photoURL: '',
        action: 'SYSTEM',
        type: 'AUDIT',
        entity: 'notification-contact',
        entityId: ticket,
        text: '@core.automation/notifications.contacts.audit.decision',
        textParams: { address: contact.address },
      }).catch(() => undefined);
    }

    return {
      tenant: await deps.tenantName(tenantId),
      channel: contact.channel,
      address: maskContactAddress(contact.channel, contact.address),
      optedOut: wanted,
    };
  },
});
