// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/mailbox.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/mailbox.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NativeFieldSpec } from './entityRegistry';

/**
 * O gatilho "Ao receber e-mail". Quem LÊ a caixa é o kernel, não a automação: o ponto de leitura (o
 * UID do IMAP, o `historyId` do Gmail) é da CAIXA, e duas automações na mesma caixa leriam tudo duas
 * vezes se cada uma guardasse o seu. A automação só declara o que quer receber (`mailFilter`).
 *
 * O nome não colide com evento de coleção: `received` não é ação de registro, e
 * `splitEntityEventName` o devolve como `null`.
 */
export const MAIL_RECEIVED_EVENT = 'mail.received';

/** O kernel a partir do qual o gatilho existe. Num kernel anterior a automação instala e nunca dispara. */
export const MAIL_RECEIVED_SINCE_KERNEL = '2.131.0';

/** O kernel que entende o filtro apontando para uma configuração do escritório (`fromSetting`, `subjectSetting`). */
export const MAIL_FILTER_SETTINGS_SINCE_KERNEL = '2.132.0';

/**
 * As caixas: `tenants/{t}/mailboxes/{id}`. Nenhum cliente lê nem grava — nem o dono: a callable
 * `manageMailbox` é a porta, porque o mesmo documento guarda o ponto de leitura e o prazo da próxima
 * leitura, e um número que decide quando o kernel age não pode vir do navegador.
 */
export const MAILBOXES_COLLECTION = 'mailboxes';

/**
 * As mensagens que alguma automação quis: `tenants/{t}/mail_messages/{hash}`. É a marca de "já
 * entregue" (o id é o hash de caixa + `Message-ID`) e o que permite auditar o que entrou. A mensagem que
 * nenhuma automação assinada quis não é gravada — a caixa é de uma pessoa, e o escritório só recebe o
 * que ela escolheu entregar.
 */
export const MAIL_MESSAGES_COLLECTION = 'mail_messages';

/**
 * Os passos "Buscar e-mails" e "Salvar anexo do e-mail", e o kernel a partir do qual existem. Um pacote que
 * admite kernel anterior instalaria um fluxo que reprova no passo.
 */
export const MAIL_SEARCH_STEP_ID = 'mail-search';
export const SAVE_MAIL_ATTACHMENT_STEP_ID = 'save-mail-attachment';
export const MAIL_STEPS_SINCE_KERNEL = '2.133.0';

/** Até quantas mensagens a busca devolve, e até quantos dias para trás ela olha. */
export const MAIL_SEARCH_MAX_RESULTS = 50;
export const MAIL_SEARCH_DEFAULT_DAYS = 7;

/**
 * Com o corpo, a busca devolve menos e mais curto: as saídas de um passo ficam gravadas na execução, que é um
 * documento de 1 MB, e 50 corpos de e-mail inteiros a estourariam. O HTML não vem — para ler, o texto basta.
 */
export const MAIL_SEARCH_MAX_RESULTS_WITH_BODY = 20;
export const MAIL_SEARCH_BODY_MAX_CHARS = 10_000;

/**
 * A mensagem ENTREGUE guardada inteira (`.eml`), pelo mesmo prazo da marca: é dela que o passo "Salvar anexo
 * do e-mail" tira o arquivo. Guardar é o que faz o passo valer para as duas fontes — a encaminhada não fica em
 * caixa nenhuma, e a lida por IMAP pode ter a senha trocada ou a caixa removida. Só o que alguma automação
 * quis é guardado. A pasta é reservada no `storage.rules`: nenhum cliente a lê.
 */
export const MAIL_RAW_STORAGE_FOLDER = MAIL_MESSAGES_COLLECTION;

export const mailRawStoragePath = (tenantId: string, key: string): string =>
  `tenants/${tenantId}/${MAIL_RAW_STORAGE_FOLDER}/${key}/message.eml`;

/** Quais anexos o passo salva: trecho do nome e tipo, sem diferença de maiúscula. Vazio: todos. */
export const matchesAttachment = (
  attachment: { name: string; contentType: string },
  wanted: { nameContains?: string | null; contentType?: string | null },
): boolean => {
  const name = (wanted.nameContains ?? '').trim().toLowerCase();
  const type = (wanted.contentType ?? '').trim().toLowerCase();
  if (name && !attachment.name.toLowerCase().includes(name)) return false;
  if (type && !attachment.contentType.toLowerCase().startsWith(type)) return false;
  return true;
};

/** A página das caixas — de todo membro com `mailboxes.connect`, e não só de quem monta automação. */
export const MAILBOXES_PAGE_KEY = 'mailboxes';

/** Até quantos dias para trás a leitura busca quando a janela é aberta (`backfillDays`). */
export const MAILBOX_MAX_BACKFILL_DAYS = 30;

/**
 * Por quanto tempo a mensagem entregue fica guardada (TTL em `expiresAt`). É a marca que impede a janela de
 * dias de entregar de novo o que já foi entregue, e por isso dura MAIS que a janela maior: o `SINCE` do IMAP
 * é por dia, sem hora nem fuso, e a janela cheia alcança a mensagem de 30 dias e meio — cuja marca, com a
 * mesma duração, já teria expirado.
 */
export const MAIL_MESSAGE_RETENTION_DAYS = MAILBOX_MAX_BACKFILL_DAYS + 2;

/** O tique da função que lê as caixas; abaixo disso o intervalo seria uma promessa que ninguém cumpre. */
export const MAILBOX_POLL_TICK_MINUTES = 5;
export const MAILBOX_MIN_POLL_MINUTES = MAILBOX_POLL_TICK_MINUTES;
export const MAILBOX_DEFAULT_POLL_MINUTES = 15;
export const MAILBOX_MAX_POLL_MINUTES = 1440;

/**
 * Quantas mensagens uma leitura entrega. O que sobra fica para a volta seguinte, que começa na hora: uma
 * caixa com mil e-mails que casam não pode ocupar a função inteira nem estourar o timeout no meio.
 */
export const MAILBOX_MAX_MESSAGES_PER_POLL = 50;

/** O corpo vai no evento, e o evento é um documento: acima disso o texto é cortado, nunca recusado. */
export const MAIL_TEXT_MAX_CHARS = 100_000;
export const MAIL_HTML_MAX_CHARS = 200_000;

/** Quantos termos cada lista do filtro aceita, e de que tamanho. */
export const MAIL_FILTER_MAX_TERMS = 30;
export const MAIL_FILTER_MAX_TERM_LENGTH = 200;

/**
 * De onde a caixa recebe:
 * - `imap`: o kernel LÊ a caixa, de tempos em tempos, com uma senha de app;
 * - `forward`: a pessoa ENCAMINHA para um endereço da instalação (uma regra no Gmail/Outlook), e o
 *   provedor de recepção entrega a mensagem ao kernel. Nenhuma permissão sobre a caixa, nenhuma senha
 *   guardada, qualquer provedor — e só chega o que a regra da pessoa escolheu encaminhar.
 */
export const MAILBOX_SOURCES = ['imap', 'forward'] as const;
export type MailboxSource = typeof MAILBOX_SOURCES[number];

/** A caixa que o kernel LÊ (e por isso tem prazo, ponto de leitura e senha). */
export const isPolledMailbox = (source: MailboxSource): boolean => source === 'imap';

/**
 * O teto do que o provedor de recepção entrega por mensagem. É o corpo de UMA chamada HTTP, e o limite da
 * plataforma é 32 MB: acima deste, a resposta é 413 e o provedor devolve a mensagem a quem encaminhou.
 */
export const MAIL_INBOUND_MAX_BYTES = 20 * 1024 * 1024;

/**
 * A folga da data ASSINADA pelo provedor. Fora dela a chamada é uma cópia velha e é recusada — a mesma
 * conta do webhook (`WEBHOOK_TIMESTAMP_TOLERANCE_SECONDS`).
 */
export const MAIL_INBOUND_TIMESTAMP_TOLERANCE_SECONDS = 300;

/** Os cabeçalhos que o adaptador do provedor envia junto com a mensagem crua (RFC 822). */
export const MAIL_INBOUND_HEADERS = {
  /** O destinatário do ENVELOPE (`RCPT TO`) — o endereço da caixa. O `To:` da mensagem é o da pessoa. */
  recipient: 'x-microteia-recipient',
  /** Segundos desde 1970, assinados junto. */
  timestamp: 'x-microteia-timestamp',
  /** HMAC-SHA256 em hexadecimal de `<timestamp>.<recipient>.<corpo>`, com o segredo da instalação. */
  signature: 'x-microteia-signature',
} as const;

/** O tamanho do código do endereço de encaminhamento: aleatório, e é ele que prova de qual caixa é a mensagem. */
export const MAIL_INBOUND_TOKEN_LENGTH = 24;
const INBOUND_TOKEN_PATTERN = new RegExp(`^[a-z0-9]{${MAIL_INBOUND_TOKEN_LENGTH}}$`);

export const mailInboundAddress = (token: string, domain: string): string => `${token}@${domain}`;

/**
 * O código da caixa a partir do destinatário do envelope: `<código>@<domínio da instalação>`, com ou sem
 * `+etiqueta`. `null` para qualquer outra coisa — inclusive um domínio que não é o da instalação.
 */
export const mailInboundTokenOf = (recipient: string, domain: string): string | null => {
  const address = mailAddressOf(recipient);
  const at = address.lastIndexOf('@');
  if (at <= 0 || address.slice(at + 1) !== domain.trim().toLowerCase()) return null;
  const token = address.slice(0, at).split('+')[0];
  return INBOUND_TOKEN_PATTERN.test(token) ? token : null;
};

/**
 * O Gmail só passa a encaminhar depois que o endereço de destino CONFIRMA — e quem recebe a confirmação é
 * o próprio endereço da caixa. A mensagem é reconhecida aqui e o código e o link vão para a tela da caixa,
 * em vez de virarem e-mail para automação.
 */
export const GMAIL_FORWARDING_SENDER = 'forwarding-noreply@google.com';

export interface ForwardingConfirmation {
  code: string;
  url: string;
  receivedAt: string;
}

export const forwardingConfirmationOf = (
  message: { from: string; subject: string; text: string },
  receivedAt: Date,
): ForwardingConfirmation | null => {
  if (mailAddressOf(message.from) !== GMAIL_FORWARDING_SENDER) return null;
  const code = /\(#(\d{6,12})\)/.exec(message.subject)?.[1] ?? /\b(\d{8,12})\b/.exec(message.text)?.[1] ?? '';
  const url = /https:\/\/mail(?:-settings)?\.google\.com\/[^\s"<>]+/.exec(message.text)?.[0] ?? '';
  if (!code && !url) return null;
  return { code, url, receivedAt: receivedAt.toISOString() };
};

/**
 * O que a automação quer receber. Entre as listas vale E; dentro de uma lista, OU. Lista vazia ou
 * ausente não restringe.
 *
 * Remetente: o endereço inteiro (`intimacao@tjba.jus.br`), o domínio (`@tjba.jus.br` ou `tjba.jus.br`,
 * que também casa os subdomínios) ou um curinga de subdomínio (`*.jus.br`). Assunto: trecho, sem
 * diferença de maiúscula nem de acento.
 */
export interface MailFilter {
  from?: string[] | null;
  subject?: string[] | null;
  /** `true`: só com anexo. `false`: só sem. Ausente: tanto faz. */
  hasAttachments?: boolean | null;
  /**
   * A chave de uma configuração do ESCRITÓRIO (lista de texto) cujos valores SUBSTITUEM `from` quando
   * preenchida; vazia, vale `from`. É o que deixa o escritório ajustar os remetentes de uma automação que
   * veio numa extensão: a atualização reescreve a automação inteira, e a configuração é do escritório.
   */
  fromSetting?: string | null;
  /** O mesmo, para `subject`. */
  subjectSetting?: string | null;
}

export interface ImapSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  /** A pasta lida. Vazio é a caixa de entrada. */
  folder: string;
}

export const DEFAULT_IMAP_FOLDER = 'INBOX';

export const EMPTY_IMAP_SETTINGS: ImapSettings = { host: '', port: 993, secure: true, username: '', folder: DEFAULT_IMAP_FOLDER };

/** O que quem configura uma caixa escreve. A senha viaja à parte, e nunca volta. */
export interface MailboxSettings {
  name: string;
  source: MailboxSource;
  imap: ImapSettings;
  pollEveryMinutes: number;
  /**
   * Na PRIMEIRA leitura (e depois de trocar a conta, a pasta ou as automações), buscar também os últimos N
   * dias. Zero: só o que chegar daqui em diante. É a virada de outra fonte sem buraco: o que já tinha sido
   * entregue por esta caixa não é entregue de novo.
   */
  backfillDays: number;
  /** As automações (`mail.received`) que recebem o que chega nesta caixa. */
  subscriptions: string[];
  enabled: boolean;
}

export const EMPTY_MAILBOX_SETTINGS: MailboxSettings = {
  name: '',
  source: 'imap',
  imap: EMPTY_IMAP_SETTINGS,
  pollEveryMinutes: MAILBOX_DEFAULT_POLL_MINUTES,
  backfillDays: 0,
  subscriptions: [],
  enabled: true,
};

export const MAILBOX_FAILURE_REASONS = ['auth', 'connection', 'folder', 'read'] as const;
export type MailboxFailureReason = typeof MAILBOX_FAILURE_REASONS[number];

export interface MailboxHealth {
  lastPolledAt: string | null;
  lastDeliveredAt: string | null;
  /** Quantas mensagens a última leitura entregou a alguma automação. */
  lastDelivered: number;
  failure: { reason: MailboxFailureReason; message: string; at: string } | null;
}

/** O que a tela recebe de uma caixa: a configuração, de quem é, e como ela vai. Nunca o segredo. */
export interface MailboxView extends MailboxSettings {
  id: string;
  /** Ausente: a caixa é do ESCRITÓRIO. */
  ownerId: string | null;
  ownerName: string | null;
  hasPassword: boolean;
  nextPollAt: string | null;
  health: MailboxHealth;
  /** O endereço para onde encaminhar — só na caixa `forward`, e só com a recepção configurada. */
  address: string | null;
  /** A confirmação de encaminhamento do Gmail que chegou e ainda não foi substituída por e-mail de verdade. */
  forwardingConfirmation: ForwardingConfirmation | null;
  /**
   * A regra a criar no serviço de e-mail da pessoa — só na caixa `forward`. Calculada no servidor: o membro
   * que configura a própria caixa pode não ter permissão de ler as automações que ela alimenta.
   */
  forwardingRule: ForwardingRule | null;
}

/** O que a tela das caixas recebe: as caixas e se a instalação sabe receber por encaminhamento. */
export interface MailboxListing {
  mailboxes: MailboxView[];
  forwardingAvailable: boolean;
}

const normalizeText = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const cleanTerms = (terms: readonly string[] | null | undefined): string[] =>
  (terms ?? []).map((term) => (typeof term === 'string' ? term.trim() : '')).filter((term) => term !== '');

const SETTING_KEY_PATTERN = /^[a-z][a-zA-Z0-9._-]{0,99}$/;

const settingList = (values: Record<string, unknown>, key: string | null | undefined): string[] => {
  if (!key) return [];
  const value = values[key];
  return Array.isArray(value) ? cleanTerms(value.filter((one): one is string => typeof one === 'string')) : [];
};

/** O filtro cita alguma configuração do escritório. */
export const mailFilterUsesSettings = (filter: MailFilter | null | undefined): boolean =>
  !!filter && (!!filter.fromSetting || !!filter.subjectSetting);

/**
 * O filtro com as configurações do escritório aplicadas: a lista preenchida substitui os termos declarados;
 * vazia, eles valem. `values` são os valores do escritório (`settings/tenant.values`).
 */
export const resolveMailFilter = (filter: MailFilter | null | undefined, values: Record<string, unknown>): MailFilter | null => {
  if (!filter) return null;
  const from = settingList(values, filter.fromSetting);
  const subject = settingList(values, filter.subjectSetting);
  return {
    from: from.length > 0 ? from : filter.from ?? null,
    subject: subject.length > 0 ? subject : filter.subject ?? null,
    hasAttachments: filter.hasAttachments ?? null,
  };
};

/**
 * O filtro SEM as dimensões que dependem de configuração — o que o motor confere de novo, sem ler
 * configuração nenhuma. A leitura da caixa já resolveu o filtro inteiro; aqui não dá para saber qual lista
 * valia, e conferir os termos declarados recusaria o que a configuração deixou passar.
 */
export const mailFilterWithoutSettings = (filter: MailFilter | null | undefined): MailFilter | null => {
  if (!filter) return null;
  return {
    from: filter.fromSetting ? null : filter.from ?? null,
    subject: filter.subjectSetting ? null : filter.subject ?? null,
    hasAttachments: filter.hasAttachments ?? null,
  };
};

/** O filtro declara algo? Ausente e vazio são a mesma resposta: todo e-mail passa. */
export const hasMailFilter = (filter: MailFilter | null | undefined): boolean =>
  !!filter
  && (cleanTerms(filter.from).length > 0 || cleanTerms(filter.subject).length > 0 || typeof filter.hasAttachments === 'boolean'
    || mailFilterUsesSettings(filter));

/**
 * O endereço puro de um remetente: `"Tribunal" <intimacao@tjba.jus.br>` → `intimacao@tjba.jus.br`.
 * O IMAP entrega a lista já separada, mas o filtro também é conferido sobre o que um adaptador de
 * extensão mande, e é ali que o nome de exibição aparece.
 */
export const mailAddressOf = (value: string): string => {
  const bracket = /<([^>]+)>/.exec(value);
  return normalizeText(bracket ? bracket[1] : value);
};

const domainOf = (address: string): string => {
  const at = address.lastIndexOf('@');
  return at >= 0 ? address.slice(at + 1) : address;
};

const isWithinDomain = (domain: string, expected: string): boolean =>
  domain === expected || domain.endsWith(`.${expected}`);

/** O remetente casa com UM termo do filtro? Ver `MailFilter.from`. */
export const matchesSenderTerm = (sender: string, term: string): boolean => {
  const address = mailAddressOf(sender);
  const wanted = normalizeText(term);
  if (!address || !wanted) return false;
  if (wanted.startsWith('*.')) return domainOf(address).endsWith(wanted.slice(1));
  if (wanted.startsWith('@')) return isWithinDomain(domainOf(address), wanted.slice(1));
  if (wanted.includes('@')) return address === wanted;
  return isWithinDomain(domainOf(address), wanted);
};

/** O que o filtro olha numa mensagem — o mínimo, para casar antes de baixar o corpo. */
export interface MailFilterSubject {
  from: string;
  subject: string;
  attachmentCount: number;
}

/**
 * A mensagem passa pelo filtro? A MESMA conta roda na leitura (para decidir o que baixar e a quem
 * entregar) e no motor (a automação cujo filtro mudou entre a leitura e a execução não roda à toa).
 */
export const matchesMailFilter = (filter: MailFilter | null | undefined, message: MailFilterSubject): boolean => {
  if (!filter) return true;
  const senders = cleanTerms(filter.from);
  if (senders.length > 0 && !senders.some((term) => matchesSenderTerm(message.from, term))) return false;
  const subjects = cleanTerms(filter.subject);
  const subject = normalizeText(message.subject ?? '');
  if (subjects.length > 0 && !subjects.some((term) => subject.includes(normalizeText(term)))) return false;
  if (filter.hasAttachments === true && message.attachmentCount === 0) return false;
  if (filter.hasAttachments === false && message.attachmentCount > 0) return false;
  return true;
};

/** O que está errado num filtro, como referência de mensagem. Editor, validação de pacote e callable. */
export const mailFilterIssue = (filter: MailFilter | null | undefined): string | null => {
  if (!filter) return null;
  for (const list of [filter.from, filter.subject]) {
    if (list === undefined || list === null) continue;
    if (!Array.isArray(list)) return '@core.automation/mail.filter.invalid';
    if (list.length > MAIL_FILTER_MAX_TERMS) return '@core.automation/mail.filter.too-many';
    if (list.some((term) => typeof term !== 'string' || term.length > MAIL_FILTER_MAX_TERM_LENGTH)) {
      return '@core.automation/mail.filter.invalid';
    }
  }
  if (cleanTerms(filter.from).some((term) => /\s/.test(term) || term === '*' || term === '*.')) {
    return '@core.automation/mail.filter.sender-invalid';
  }
  for (const key of [filter.fromSetting, filter.subjectSetting]) {
    if (key !== undefined && key !== null && key !== '' && (typeof key !== 'string' || !SETTING_KEY_PATTERN.test(key))) {
      return '@core.automation/mail.filter.setting-invalid';
    }
  }
  return null;
};

/**
 * O pré-filtro que a leitura pede ao SERVIDOR de e-mail, para não listar a caixa inteira: um termo de
 * remetente ou de assunto por consulta, em OU. Só vale quando TODA automação assinada restringe a mesma
 * dimensão — se uma delas aceita qualquer remetente, pedir só os remetentes das outras a deixaria sem
 * nada. É uma peneira grossa (o `SEARCH FROM` do IMAP é trecho do cabeçalho): quem decide é
 * `matchesMailFilter`, depois.
 */
export type MailServerPrefilter =
  | { kind: 'all' }
  | { kind: 'from'; terms: string[] }
  | { kind: 'subject'; terms: string[] };

const serverSenderTerm = (term: string): string => term.trim().replace(/^\*\./, '').replace(/^@/, '');

export const mailServerPrefilter = (filters: ReadonlyArray<MailFilter | null | undefined>): MailServerPrefilter => {
  if (filters.length === 0) return { kind: 'all' };
  const senders = filters.map((filter) => cleanTerms(filter?.from).map(serverSenderTerm).filter((term) => term !== ''));
  if (senders.every((terms) => terms.length > 0)) {
    const terms = [...new Set(senders.flat().map((term) => term.toLowerCase()))];
    if (terms.length <= MAIL_FILTER_MAX_TERMS) return { kind: 'from', terms };
  }
  const subjects = filters.map((filter) => cleanTerms(filter?.subject));
  if (subjects.every((terms) => terms.length > 0)) {
    const terms = [...new Set(subjects.flat())];
    if (terms.length <= MAIL_FILTER_MAX_TERMS) return { kind: 'subject', terms };
  }
  return { kind: 'all' };
};

/**
 * A regra que a pessoa cria no PRÓPRIO serviço de e-mail para encaminhar só o que as automações querem.
 * Sai dos filtros delas, e por isso nenhum termo é escrito aqui. Encaminhar além disso não quebra nada — a
 * automação confere de novo —, mas leva à plataforma e-mail que ninguém pediu.
 */
export interface ForwardingRule {
  /** Trechos do endereço do remetente (`exemplo.com`, `alguem@exemplo.com`). Vazio: qualquer remetente. */
  senders: string[];
  /** Trechos do assunto. Vazio: qualquer assunto. */
  subjects: string[];
  /** A busca do Gmail que acha o que as automações querem; o filtro do Gmail nasce dela. Null: qualquer e-mail. */
  gmailQuery: string | null;
}

const uniqueTerms = (terms: string[]): string[] => {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const key = term.toLowerCase();
    if (term === '' || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const gmailTerm = (term: string): string => (/[\s(){}"]/.test(term) ? `"${term.replace(/"/g, '')}"` : term);

const gmailAny = (operator: string, terms: string[]): string =>
  terms.length === 1 ? `${operator}:${gmailTerm(terms[0])}` : `${operator}:(${terms.map(gmailTerm).join(' OR ')})`;

/** O remetente como trecho de endereço, em minúsculas: o endereço não distingue caixa, e o grupo repetido sai uma vez. */
const ruleSenders = (filter: MailFilter | null | undefined): string[] =>
  cleanTerms(filter?.from).map((term) => serverSenderTerm(term).toLowerCase()).filter((term) => term !== '');

const gmailClause = (filter: MailFilter): string => {
  const senders = uniqueTerms(ruleSenders(filter));
  const subjects = uniqueTerms(cleanTerms(filter.subject));
  return [
    ...(senders.length > 0 ? [gmailAny('from', senders)] : []),
    ...(subjects.length > 0 ? [gmailAny('subject', subjects)] : []),
    ...(filter.hasAttachments === true ? ['has:attachment'] : filter.hasAttachments === false ? ['-has:attachment'] : []),
  ].join(' ');
};

/**
 * `filters` são os filtros JÁ resolvidos (configurações do escritório aplicadas) das automações que a caixa
 * alimenta. Basta UMA aceitar qualquer e-mail para a regra aceitar qualquer e-mail: encaminhar menos que
 * isso esconderia dela o que ela quer.
 *
 * As listas de remetentes e assuntos são para os serviços cuja regra não tem "ou" entre grupos (Outlook):
 * a união das listas, e só quando TODAS as automações restringem aquela dimensão.
 */
export const forwardingRuleOf = (filters: ReadonlyArray<MailFilter | null | undefined>): ForwardingRule => {
  const clauses = filters.map((filter) => (filter ? gmailClause(filter) : ''));
  if (clauses.length === 0 || clauses.some((clause) => clause === '')) return { senders: [], subjects: [], gmailQuery: null };
  const unionOf = (pick: (filter: MailFilter | null | undefined) => string[]): string[] => {
    const lists = filters.map(pick);
    return lists.every((list) => list.length > 0) ? uniqueTerms(lists.flat()) : [];
  };
  const distinct = [...new Set(clauses)];
  return {
    senders: unionOf(ruleSenders),
    subjects: unionOf((filter) => cleanTerms(filter?.subject)),
    gmailQuery: distinct.length === 1 ? distinct[0] : distinct.map((clause) => `(${clause})`).join(' OR '),
  };
};

const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;

/** O que está errado na configuração de uma caixa. A MESMA conferência roda no formulário e na callable. */
export const mailboxSettingsIssue = (settings: MailboxSettings): string | null => {
  if (!settings.name.trim()) return '@core.automation/mailbox.issue.name';
  if (!MAILBOX_SOURCES.includes(settings.source)) return '@core.automation/mailbox.issue.source';
  if (!isPolledMailbox(settings.source)) return null;
  if (!Number.isInteger(settings.backfillDays) || settings.backfillDays < 0 || settings.backfillDays > MAILBOX_MAX_BACKFILL_DAYS) {
    return '@core.automation/mailbox.issue.backfill';
  }
  if (!settings.imap.host.trim() || /\s/.test(settings.imap.host.trim())) return '@core.automation/mailbox.issue.host';
  if (!isPositiveInteger(settings.imap.port) || settings.imap.port > 65535) return '@core.automation/mailbox.issue.port';
  if (!settings.imap.username.trim()) return '@core.automation/mailbox.issue.username';
  if (
    !Number.isInteger(settings.pollEveryMinutes)
    || settings.pollEveryMinutes < MAILBOX_MIN_POLL_MINUTES
    || settings.pollEveryMinutes > MAILBOX_MAX_POLL_MINUTES
  ) {
    return '@core.automation/mailbox.issue.interval';
  }
  return null;
};

/** O payload de `mail.received`: a mensagem, de onde veio, e de quem é a caixa. */
export interface MailEventPayload {
  id: string;
  mailboxId: string;
  /** O dono da caixa; `null` quando ela é do escritório. */
  mailboxOwnerId: string | null;
  messageId: string;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  replyTo: string;
  subject: string;
  date: string;
  text: string;
  html: string;
  /** O texto ou o HTML foi cortado no teto. */
  truncated: boolean;
  attachments: Array<{ name: string; contentType: string; size: number }>;
}

/** A conta lida — o que, se muda, faz os UIDs gravados não dizerem mais nada. */
const mailboxAccountOf = (settings: MailboxSettings): string =>
  JSON.stringify([settings.imap.host.trim().toLowerCase(), settings.imap.port, settings.imap.username.trim().toLowerCase(), settings.imap.folder]);

const sameSubscriptions = (a: readonly string[], b: readonly string[]): boolean => {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((id, index) => id === right[index]);
};

/**
 * Salvar a caixa mantém o ponto de leitura? Não, quando muda a conta (os UIDs gravados não dizem mais nada),
 * quando mudam as automações (a assinatura nova começa do zero) e quando a janela de dias muda para um valor
 * maior que zero — é o pedido de buscar para trás, e sem zerar o ponto ele só valeria na primeira leitura, que
 * já passou: a caixa salva com 3 dias continuava sem ler nada do que tinha chegado antes. Baixar a janela para
 * zero mantém o ponto: zerá-lo marcaria o agora, e o que chegou desde a última leitura se perderia.
 */
export const mailboxKeepsCursor = (previous: MailboxSettings, next: MailboxSettings): boolean =>
  mailboxAccountOf(previous) === mailboxAccountOf(next)
  && sameSubscriptions(previous.subscriptions, next.subscriptions)
  && (next.backfillDays <= 0 || next.backfillDays === previous.backfillDays);

/** O "agora" do evento e a retenção são de quem chama: o módulo é puro. */
export const mailMessageExpiresAt = (receivedAt: Date): Date =>
  new Date(receivedAt.getTime() + MAIL_MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

export const MAIL_EVENT_FIELDS: NativeFieldSpec[] = [
  { key: 'from', label: '@core.automation/event-field.mail-from', type: 'string' },
  { key: 'fromName', label: '@core.automation/event-field.mail-from-name', type: 'string' },
  { key: 'to', label: '@core.automation/event-field.mail-to', type: 'stringArray' },
  { key: 'cc', label: '@core.automation/event-field.mail-cc', type: 'stringArray' },
  { key: 'replyTo', label: '@core.automation/event-field.mail-reply-to', type: 'string' },
  { key: 'subject', label: '@core.automation/event-field.mail-subject', type: 'string' },
  { key: 'date', label: '@core.automation/event-field.mail-date', type: 'date' },
  { key: 'text', label: '@core.automation/event-field.mail-text', type: 'string' },
  { key: 'html', label: '@core.automation/event-field.mail-html', type: 'string' },
  { key: 'truncated', label: '@core.automation/event-field.mail-truncated', type: 'boolean' },
  { key: 'messageId', label: '@core.automation/event-field.mail-message-id', type: 'string' },
  { key: 'mailboxId', label: '@core.automation/event-field.mail-mailbox-id', type: 'string' },
  { key: 'mailboxOwnerId', label: '@core.automation/event-field.mail-mailbox-owner-id', type: 'string' },
  // Um campo só, sem subcampos: cada anexo é `{ name, contentType, size }`, e o editor oferece a lista
  // inteira — para o passo de laço ou para `length` numa condição.
  { key: 'attachments', label: '@core.automation/event-field.mail-attachments', type: 'object', list: true },
];
