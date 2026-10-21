import type { RecordLinkTarget } from '../schema/recordLink';

/**
 * Uma notificação no sino. `title` e `message` são o que o passo `notify` recebeu — referência de
 * mensagem ou texto do escritório — e são resolvidos no ponto de render, no idioma de quem lê.
 */
export interface InboxNotification {
  id: string;
  title: string;
  message: string;
  params: Record<string, string>;
  link: string;
  /** O registro de que o aviso fala — o clique o abre pela tela que descreve a coleção. */
  target: RecordLinkTarget | null;
  /** O tipo (`<plugin>/<chave>`); vazio = aviso geral. */
  category: string;
  read: boolean;
  createdAt: Date;
}

/** O que a página de notificações filtra. */
export interface InboxNotificationFilter {
  unreadOnly: boolean;
  /** `null` = todos os tipos; `''` = só os gerais. */
  category: string | null;
}

export type DevicePushStatus = 'unsupported' | 'denied' | 'available' | 'enabled';
