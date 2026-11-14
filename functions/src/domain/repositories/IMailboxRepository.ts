import type { ForwardingConfirmation, MailEventPayload, MailboxHealth, MailboxSettings } from '../schema/mailbox';

/**
 * Onde a leitura parou. `uidValidity` é o que o IMAP promete manter enquanto os UIDs valem: mudou, os
 * números de antes não dizem mais nada, e a leitura recomeça pela data (ver `pollMailbox`).
 */
export interface MailboxCursor {
  uidValidity: string;
  lastUid: number;
}

export interface MailboxRef {
  tenantId: string;
  id: string;
}

export interface StoredMailbox extends MailboxRef {
  /** `null`: a caixa é do escritório. */
  ownerId: string | null;
  settings: MailboxSettings;
  hasPassword: boolean;
  cursor: MailboxCursor | null;
  nextPollAt: Date | null;
  health: MailboxHealth;
  /** O código do endereço de encaminhamento — só na caixa `forward`. */
  inboundToken: string | null;
  forwardingConfirmation: ForwardingConfirmation | null;
}

/** O que uma leitura deixa gravado: onde parou, quando ler de novo, e como foi. */
export interface MailboxPollOutcome {
  cursor: MailboxCursor | null;
  /** `null`: a caixa sai da fila de leitura (deixou de ser lida — virou de encaminhamento). */
  nextPollAt: Date | null;
  health: MailboxHealth;
}

/** Uma mensagem entregue: o registro dela e um evento por automação que a quis. */
export interface MailDelivery {
  /** O id de `mail_messages`: o hash de caixa + `Message-ID`. É ele que torna a entrega única. */
  key: string;
  record: Record<string, unknown>;
  events: Array<{ id: string; target: string; payload: MailEventPayload }>;
}

export interface IMailboxRepository {
  listForTenant(tenantId: string): Promise<StoredMailbox[]>;
  get(tenantId: string, id: string): Promise<StoredMailbox | null>;
  /**
   * Cria (sem `id`) ou altera a configuração. `password` ausente MANTÉM a gravada. Mudar a conta, a pasta ou
   * as assinaturas zera o ponto de leitura: os UIDs de outra pasta não são os desta, e a automação recém-ligada
   * não recebe o que chegou antes de ela existir.
   */
  save(input: {
    tenantId: string;
    id: string | null;
    ownerId: string | null;
    settings: MailboxSettings;
    password: string | null;
    actorId: string;
    now: Date;
  }): Promise<string>;
  remove(tenantId: string, id: string): Promise<void>;
  /** A caixa de encaminhamento dona do código, em qualquer escritório. */
  findByInboundToken(token: string): Promise<MailboxRef | null>;
  /** O que o encaminhamento deixa na caixa: como foi a última entrega, ou a confirmação do Gmail. */
  recordInbound(ref: MailboxRef, update: { health?: MailboxHealth; forwardingConfirmation?: ForwardingConfirmation | null }): Promise<void>;
  password(tenantId: string, id: string): Promise<string | null>;
  /** As caixas vencidas de TODOS os escritórios — uma consulta de grupo de coleção. */
  listDue(now: Date, limit: number): Promise<MailboxRef[]>;
  /**
   * Toma a caixa para ler, numa transação: só se ainda estiver vencida e ninguém a estiver lendo. Duas
   * execuções simultâneas da função: uma lê, a outra recebe `null`.
   */
  claim(ref: MailboxRef, now: Date, leaseUntil: Date): Promise<StoredMailbox | null>;
  release(ref: MailboxRef, outcome: MailboxPollOutcome): Promise<void>;
  /**
   * Grava a mensagem e os eventos numa transação. `duplicate`: a mensagem já tinha sido entregue (outra
   * leitura, ou o reinício pela data depois de o servidor trocar os UIDs) — nenhum evento é publicado.
   */
  deliver(tenantId: string, delivery: MailDelivery): Promise<'delivered' | 'duplicate'>;
}
