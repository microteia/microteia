import { ImapFlow } from 'imapflow';
import type { FetchMessageObject, ImapFlowError, MessageStructureObject, SearchObject } from 'imapflow';
import { parseMailSource } from './mailParsing';
import type { IMailReader, MailEnvelope, MailReadSession, ParsedMail } from '../../domain/repositories/IMailReader';
import { MailReadError } from '../../domain/repositories/IMailReader';
import { DEFAULT_IMAP_FOLDER } from '../../domain/schema/mailbox';
import type { ImapSettings, MailServerPrefilter, MailboxFailureReason } from '../../domain/schema/mailbox';

const CONNECTION_TIMEOUT_MS = 20_000;
const SOCKET_TIMEOUT_MS = 60_000;

/**
 * O teto do que se baixa de UMA mensagem. A leitura roda dentro de uma function com memória contada, e uma
 * mensagem com anexos de centenas de MB não pode derrubar a leitura das outras caixas do projeto. Acima
 * dele o fim da mensagem (quase sempre anexo) não chega; o texto, que vem antes, chega inteiro.
 */
const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

const classify = (error: unknown, fallback: MailboxFailureReason): MailReadError => {
  if (error instanceof MailReadError) return error;
  const imap = (error ?? {}) as ImapFlowError;
  const message = imap.responseText || (error instanceof Error ? error.message : String(error));
  if (imap.authenticationFailed) return new MailReadError('auth', message);
  if (imap.mailboxMissing || imap.serverResponseCode === 'NONEXISTENT') return new MailReadError('folder', message);
  if (imap.tlsFailed || ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH'].includes(imap.code ?? '')) {
    return new MailReadError('connection', message);
  }
  return new MailReadError(fallback, message);
};

/** O critério do servidor para a peneira. `or` do IMAP exige dois termos ou mais. */
const prefilterQuery = (prefilter: MailServerPrefilter): SearchObject => {
  if (prefilter.kind === 'all') return {};
  const terms: SearchObject[] = prefilter.terms.map((term) => (prefilter.kind === 'from' ? { from: term } : { subject: term }));
  return terms.length === 1 ? terms[0] : { or: terms };
};

/**
 * Quantos anexos o cabeçalho sugere. Conta COM folga — toda parte que tem nome de arquivo, inclusive a imagem
 * da assinatura —, porque é só a primeira peneira: o filtro de anexo é conferido de novo sobre a mensagem
 * baixada, e uma conta curta aqui descartaria a mensagem sem baixá-la.
 */
const countNamedParts = (node: MessageStructureObject | undefined): number => {
  if (!node) return 0;
  if (node.childNodes && node.childNodes.length > 0) {
    return node.childNodes.reduce((total, child) => total + countNamedParts(child), 0);
  }
  const named = !!(node.dispositionParameters?.filename || node.parameters?.name);
  return node.disposition === 'attachment' || named ? 1 : 0;
};

const envelopeOf = (message: FetchMessageObject): MailEnvelope => {
  const sender = message.envelope?.from?.[0];
  return {
    uid: message.uid,
    messageId: message.envelope?.messageId ?? '',
    from: sender?.address ?? '',
    subject: message.envelope?.subject ?? '',
    attachmentCount: countNamedParts(message.bodyStructure),
  };
};

class ImapReadSession implements MailReadSession {
  constructor(
    private readonly client: ImapFlow,
    private readonly release: () => void,
    readonly status: { uidValidity: string; uidNext: number },
  ) {}

  async listAfter(afterUid: number, prefilter: MailServerPrefilter, limit: number): Promise<MailEnvelope[]> {
    // `N:*` com N acima do maior UID devolve a ÚLTIMA mensagem (o `*` é o maior que existe): o filtro
    // por `> afterUid` é o que impede a última de ser lida a cada volta.
    return this.list({ ...prefilterQuery(prefilter), uid: `${afterUid + 1}:*` }, (uid) => uid > afterUid, limit);
  }

  async listSince(since: Date, prefilter: MailServerPrefilter, limit: number): Promise<MailEnvelope[]> {
    return this.list({ ...prefilterQuery(prefilter), since }, () => true, limit);
  }

  private async list(query: SearchObject, keep: (uid: number) => boolean, limit: number): Promise<MailEnvelope[]> {
    let uids: number[];
    try {
      uids = ((await this.client.search(query, { uid: true })) || []).filter(keep).sort((a, b) => a - b).slice(0, limit);
    } catch (error) {
      throw classify(error, 'read');
    }
    if (uids.length === 0) return [];
    try {
      const messages = await this.client.fetchAll(uids.join(','), { uid: true, envelope: true, bodyStructure: true }, { uid: true });
      return messages.map(envelopeOf).sort((a, b) => a.uid - b.uid);
    } catch (error) {
      throw classify(error, 'read');
    }
  }

  async fetch(uid: number): Promise<ParsedMail> {
    let source: Buffer | undefined;
    try {
      const message = await this.client.fetchOne(String(uid), { uid: true, source: { maxLength: MAX_SOURCE_BYTES } }, { uid: true });
      source = message ? message.source : undefined;
    } catch (error) {
      throw classify(error, 'read');
    }
    if (!source) throw new MailReadError('read', `message ${uid} has no content`);

    return parseMailSource(source);
  }

  async close(): Promise<void> {
    this.release();
    await this.client.logout().catch(() => undefined);
  }
}

/**
 * A leitura por IMAP. A pasta é aberta SÓ PARA LEITURA (`EXAMINE`): ler pela Microteia não marca a mensagem
 * como lida na caixa da pessoa, nem mexe em pasta, etiqueta ou sinalizador nenhum.
 */
export class ImapMailReader implements IMailReader {
  async open(settings: ImapSettings, password: string): Promise<MailReadSession> {
    const client = new ImapFlow({
      host: settings.host.trim(),
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.username.trim(), pass: password },
      logger: false,
      disableAutoIdle: true,
      connectionTimeout: CONNECTION_TIMEOUT_MS,
      greetingTimeout: CONNECTION_TIMEOUT_MS,
      socketTimeout: SOCKET_TIMEOUT_MS,
    });
    // Sem ouvinte, o erro do socket depois de conectado derrubaria o processo da function inteira.
    client.on('error', () => undefined);

    try {
      await client.connect();
    } catch (error) {
      throw classify(error, 'connection');
    }

    try {
      const lock = await client.getMailboxLock(settings.folder.trim() || DEFAULT_IMAP_FOLDER, { readOnly: true });
      const mailbox = client.mailbox;
      if (!mailbox) {
        lock.release();
        throw new MailReadError('folder', settings.folder);
      }
      return new ImapReadSession(client, () => lock.release(), {
        uidValidity: String(mailbox.uidValidity),
        uidNext: mailbox.uidNext,
      });
    } catch (error) {
      await client.logout().catch(() => undefined);
      throw classify(error, 'folder');
    }
  }
}
