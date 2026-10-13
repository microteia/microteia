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
  read: boolean;
  createdAt: Date;
}

export type DevicePushStatus = 'unsupported' | 'denied' | 'available' | 'enabled';
