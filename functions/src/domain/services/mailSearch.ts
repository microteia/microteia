import type { IMailReader, MailReadSession } from '../repositories/IMailReader';
import { MailReadError } from '../repositories/IMailReader';
import type { StoredMailbox } from '../repositories/IMailboxRepository';
import {
  MAILBOX_MAX_BACKFILL_DAYS,
  MAIL_SEARCH_BODY_MAX_CHARS,
  MAIL_SEARCH_DEFAULT_DAYS,
  MAIL_SEARCH_MAX_RESULTS,
  MAIL_SEARCH_MAX_RESULTS_WITH_BODY,
  isPolledMailbox,
  mailServerPrefilter,
  matchesMailFilter,
} from '../schema/mailbox';
import type { MailFilter } from '../schema/mailbox';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MailSearchRequest {
  tenantId: string;
  /** A automação que pergunta — é ela que a caixa de um membro precisa ter assinado. */
  workflowId: string;
  mailboxId: string;
  from?: string;
  subject?: string;
  days?: number;
  limit?: number;
  includeBody?: boolean;
}

export interface MailSearchMessage {
  messageId: string;
  from: string;
  fromName: string;
  subject: string;
  date: string | null;
  attachmentCount: number;
  /** Só com `includeBody`: o texto, cortado em `MAIL_SEARCH_BODY_MAX_CHARS`, e os anexos. */
  text?: string;
  attachments?: Array<{ name: string; contentType: string; size: number }>;
}

export type MailSearchResult =
  | { ok: true; mailboxName: string; messages: MailSearchMessage[] }
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface MailSearchDeps {
  getMailbox: (tenantId: string, id: string) => Promise<StoredMailbox | null>;
  password: (tenantId: string, id: string) => Promise<string | null>;
  reader: IMailReader;
  now: () => Date;
}

/**
 * A automação pode consultar esta caixa? A do ESCRITÓRIO, sim. A de um MEMBRO, só se ele a ligou a esta
 * automação — a mesma regra do gatilho: a caixa é da pessoa, e o escritório só vê o que ela escolheu
 * entregar. Uma busca livre na caixa de qualquer membro seria a porta dos fundos dessa regra.
 */
export const mailboxSearchableBy = (mailbox: StoredMailbox, workflowId: string): boolean =>
  mailbox.ownerId === null || mailbox.settings.subscriptions.includes(workflowId);

const clamp = (value: number | undefined, fallback: number, min: number, max: number): number => {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

const failure = (error: string, errorParams?: Record<string, string>): MailSearchResult =>
  errorParams ? { ok: false, error, errorParams } : { ok: false, error };

/**
 * Busca, sob demanda, as mensagens de uma caixa IMAP — as MAIS RECENTES primeiro. A caixa não é marcada nem
 * alterada (`EXAMINE`), e o ponto de leitura do gatilho não se move: buscar não é receber.
 *
 * A caixa que não existe e a que esta automação não pode ver respondem igual — um "não pode" ensinaria quais
 * ids existem.
 */
export const searchMailbox = async (request: MailSearchRequest, deps: MailSearchDeps): Promise<MailSearchResult> => {
  const mailbox = request.mailboxId ? await deps.getMailbox(request.tenantId, request.mailboxId) : null;
  if (!mailbox || !mailboxSearchableBy(mailbox, request.workflowId)) {
    return failure('@core.automation/step.mail-search.unavailable', { mailbox: request.mailboxId });
  }
  if (!isPolledMailbox(mailbox.settings.source)) {
    return failure('@core.automation/step.mail-search.not-imap', { name: mailbox.settings.name });
  }
  const password = await deps.password(mailbox.tenantId, mailbox.id);
  if (!password) return failure('@core.automation/mailbox.failure.auth', { name: mailbox.settings.name, detail: '' });

  const days = clamp(request.days, MAIL_SEARCH_DEFAULT_DAYS, 1, MAILBOX_MAX_BACKFILL_DAYS);
  const ceiling = request.includeBody ? MAIL_SEARCH_MAX_RESULTS_WITH_BODY : MAIL_SEARCH_MAX_RESULTS;
  const limit = clamp(request.limit, ceiling, 1, ceiling);
  const filter: MailFilter = {
    from: request.from?.trim() ? [request.from.trim()] : null,
    subject: request.subject?.trim() ? [request.subject.trim()] : null,
  };

  let session: MailReadSession | null = null;
  try {
    session = await deps.reader.open(mailbox.settings.imap, password);
    const since = new Date(deps.now().getTime() - days * DAY_MS);
    // A peneira do servidor é grossa (trecho do cabeçalho); quem decide é `matchesMailFilter`, como no
    // gatilho. Por isso o servidor pode devolver mais que o pedido, e o teto é aplicado depois.
    const envelopes = (await session.listRecent(since, mailServerPrefilter([filter]), MAIL_SEARCH_MAX_RESULTS * 2))
      .filter((envelope) => matchesMailFilter(filter, envelope))
      .slice(0, limit);

    const messages: MailSearchMessage[] = [];
    for (const envelope of envelopes) {
      const base: MailSearchMessage = {
        messageId: envelope.messageId,
        from: envelope.from,
        fromName: envelope.fromName,
        subject: envelope.subject,
        date: envelope.date ? envelope.date.toISOString() : null,
        attachmentCount: envelope.attachmentCount,
      };
      if (!request.includeBody) {
        messages.push(base);
        continue;
      }
      const { mail } = await session.fetch(envelope.uid);
      messages.push({
        ...base,
        attachmentCount: mail.attachments.length,
        text: mail.text.slice(0, MAIL_SEARCH_BODY_MAX_CHARS),
        attachments: mail.attachments,
      });
    }
    return { ok: true, mailboxName: mailbox.settings.name, messages };
  } catch (error) {
    const reason = error instanceof MailReadError ? error.reason : 'read';
    return failure(`@core.automation/mailbox.failure.${reason}`, {
      name: mailbox.settings.name,
      detail: error instanceof Error ? error.message.slice(0, 300) : '',
    });
  } finally {
    await session?.close().catch(() => undefined);
  }
};
