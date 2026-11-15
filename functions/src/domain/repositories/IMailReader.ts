import type { ImapSettings, MailServerPrefilter, MailboxFailureReason } from '../schema/mailbox';

/** O cabeçalho de uma mensagem — o bastante para decidir se ela interessa ANTES de baixar o corpo. */
export interface MailEnvelope {
  uid: number;
  messageId: string;
  from: string;
  fromName: string;
  subject: string;
  date: Date | null;
  attachmentCount: number;
}

/** Uma mensagem baixada: lida, e a cópia crua (RFC 822) que é guardada para o anexo. */
export interface FetchedMail {
  mail: ParsedMail;
  raw: Buffer;
}

export interface ParsedMail {
  messageId: string;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  replyTo: string;
  subject: string;
  date: Date | null;
  text: string;
  html: string;
  attachments: Array<{ name: string; contentType: string; size: number }>;
}

export interface MailFolderStatus {
  uidValidity: string;
  /** O próximo UID que o servidor vai dar. Tudo abaixo dele já chegou. */
  uidNext: number;
}

export interface MailReadSession {
  readonly status: MailFolderStatus;
  /** Os cabeçalhos com UID acima de `afterUid`, em ordem crescente, até `limit`. */
  listAfter(afterUid: number, prefilter: MailServerPrefilter, limit: number): Promise<MailEnvelope[]>;
  /** Os cabeçalhos chegados desde `since`, em ordem crescente — o reinício quando os UIDs mudaram. */
  listSince(since: Date, prefilter: MailServerPrefilter, limit: number): Promise<MailEnvelope[]>;
  /** Os cabeçalhos chegados desde `since`, os MAIS RECENTES primeiro, até `limit` — a busca sob demanda. */
  listRecent(since: Date, prefilter: MailServerPrefilter, limit: number): Promise<MailEnvelope[]>;
  fetch(uid: number): Promise<FetchedMail>;
  close(): Promise<void>;
}

/** A porta da leitura: o kernel fala IMAP hoje, e a forma é a de qualquer caixa que tenha ponto de leitura. */
export interface IMailReader {
  open(settings: ImapSettings, password: string): Promise<MailReadSession>;
}

/**
 * A falha da leitura, já classificada: a tela diz ao dono da caixa O QUE fazer (trocar a senha, conferir o
 * servidor, escolher a pasta), e não só que deu errado.
 */
export class MailReadError extends Error {
  constructor(readonly reason: MailboxFailureReason, message: string) {
    super(message);
    this.name = 'MailReadError';
  }
}
