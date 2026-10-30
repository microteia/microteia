/**
 * O PORTAL — o acesso de quem é de FORA do escritório ao que é dele, e só ao que é dele.
 *
 * O convidado do portal não é membro: é outro principal, em `tenants/{t}/portalUsers/{uid}`. Por isso
 * nenhuma regra `isMember` o deixa passar, e o que ele lê é uma PROJEÇÃO (`portalRecords`) que o
 * servidor monta só com os campos que a tela declarou expor, carimbada com quem pode vê-la. A coleção
 * original nunca é lida por ele.
 *
 * O vínculo entre o convidado e os registros é declarado pela TELA, e o kernel não conhece o nome de
 * nenhuma: a tela-sujeito (`subject: 'self'`) é aquela cujos registros recebem convidados — um
 * cliente, uma empresa —; as demais chegam a ela por um campo `reference` ou pelo pai.
 */

import { evaluateFieldBoolean, extractFieldExpressionPaths, fieldExpressionSyntaxError } from './fieldExpression';
import { ACTION_RESERVED_VARIABLES, PORTAL_ACTION_SURFACE, actionFieldContext } from './actionScope';
import { RECORD_CREATED_VIA_FIELD, SYSTEM_MANAGED_KEYS } from './mutationSpec';
import { isSequenceField } from './recordSequence';
import { readPortalTemplate, type PortalTemplate } from './ui/portalTemplate';

export {
  PORTAL_DOCUMENTS_SUBCOLLECTION,
  PORTAL_INVITE_RATES_COLLECTION,
  PORTAL_INVITES_COLLECTION,
  PORTAL_RECORDS_COLLECTION,
  PORTAL_REPROJECTIONS_COLLECTION,
  PORTAL_USERS_COLLECTION,
} from './portalCollections';

/**
 * O kernel a partir do qual `visibleWhen` é lido. Um kernel anterior DESCARTA a chave ao ler a
 * declaração — e projeta todos os registros. Por isso o pacote que a usa tem de exigir este kernel.
 */
export const PORTAL_VISIBLE_WHEN_SINCE_KERNEL = '2.61.0';

/**
 * O kernel a partir do qual o vínculo do portal chega à tela que está NO PORTAL para a coleção
 * apontada (`portalTargetScreen`). Um kernel anterior resolve pela tela de id igual à coleção — a âncora
 * sem portal de uma tela com `dataCollection` — e corta a corrente: o registro não aparece a ninguém.
 */
export const PORTAL_LINK_BY_COLLECTION_SINCE_KERNEL = '2.62.0';

/**
 * O kernel a partir do qual o passo `notify` avisa os convidados do portal (`portalGuests`). Um kernel
 * anterior ignora o input e reprova o passo por falta de destinatário: ninguém de fora é avisado, e
 * ninguém de dentro também — falha FECHADO, por isso não há recusa no empacotamento.
 */
export const PORTAL_GUEST_NOTIFY_SINCE_KERNEL = '2.63.0';

/**
 * O kernel a partir do qual existem os passos `portal-invite` e `portal-revoke` e a chave
 * `portal.invites`. Um kernel anterior reprova o passo por ser desconhecido e descarta a chave — o
 * convite por automação simplesmente não acontece, e por isso o pacote que os usa tem de exigi-lo.
 */
export const PORTAL_AUTOMATION_INVITES_SINCE_KERNEL = '2.73.0';

/**
 * O kernel a partir do qual `documentLinks` é lido. Um kernel anterior DESCARTA a chave e entrega ao
 * convidado o link PERMANENTE do arquivo — o contrário do que a declaração pediu. Por isso o pacote que a
 * usa tem de exigir este kernel.
 */
export const PORTAL_DOCUMENT_LINKS_SINCE_KERNEL = '2.77.0';

/**
 * O kernel a partir do qual `trackViews` é lido e `<prefixo>.portalViewed` é publicado. Um kernel anterior
 * DESCARTA a chave: nada é registrado e a automação que escuta o evento nunca roda, sem erro nenhum. Por
 * isso o pacote que a usa tem de exigir este kernel.
 */
export const PORTAL_TRACK_VIEWS_SINCE_KERNEL = '2.79.0';

/**
 * O kernel a partir do qual `actions` é lido. Um kernel anterior DESCARTA a chave: o botão não aparece, e
 * o gesto que a extensão pôs no portal simplesmente não existe para o convidado. Por isso o pacote que a
 * usa tem de exigir este kernel.
 */
export const PORTAL_ACTIONS_SINCE_KERNEL = '2.81.0';

/**
 * O kernel a partir do qual `@microteia/portal` exporta `usePortalNotify`. Não é declaração: a view que o
 * importa num kernel anterior recebe `undefined` e quebra ao chamá-lo — o pacote que o usa exige este kernel.
 */
export const PORTAL_NOTIFY_SINCE_KERNEL = '2.87.0';

/**
 * O kernel a partir do qual `referenceTitles` é lido. Um kernel anterior DESCARTA a chave: a referência
 * para uma tela fora do portal sai sem rótulo, e o título que é essa referência sai vazio. Falha fechado
 * (mostra menos), mas a extensão que declarou para ter o nome à vista ficaria sem ele, calada — por isso o
 * pacote que a usa tem de exigir este kernel.
 */
export const PORTAL_REFERENCE_TITLES_SINCE_KERNEL = '2.84.0';

/**
 * A mesma abertura — o mesmo convidado, o mesmo registro, o mesmo documento — dentro desta janela não é
 * registrada de novo. A primeira é a que prova; as seguintes seriam ruído na Auditoria e uma execução
 * de automação a cada clique, e um convidado não pode disparar execuções sem limite.
 */
export const PORTAL_VIEW_REPEAT_MINUTES = 30;

/** Validade do link curto quando a declaração não diz outra, e o teto que ela pode pedir. */
export const PORTAL_DOCUMENT_LINK_DEFAULT_MINUTES = 10;
export const PORTAL_DOCUMENT_LINK_MAX_MINUTES = 60;

/**
 * Quantos convites NOVOS as automações de um escritório fazem por hora, somadas. O convite que já
 * existia não conta. É freio de abuso e de laço — uma automação que regrava o próprio registro —, não
 * de uso: o credenciamento em massa passa, em levas.
 */
export const PORTAL_AUTOMATION_INVITES_PER_HOUR = 500;

/** Quantos saltos de referência separam um registro da tela-sujeito, no máximo. */
export const PORTAL_SUBJECT_MAX_DEPTH = 3;

/**
 * A área de ESPERA de um anexo do convidado no Storage — só dele, e só para criar. O arquivo sai dali
 * para o registro pela callable, que confere tudo antes; o convidado não lê, não troca e não apaga.
 */
export const PORTAL_UPLOADS_STORAGE_FOLDER = 'portalUploads';
export const PORTAL_UPLOAD_MAX_BYTES = 20 * 1024 * 1024;

export const portalUploadStagingPath = (tenantId: string, userId: string, uploadId: string): string =>
  `tenants/${tenantId}/${PORTAL_UPLOADS_STORAGE_FOLDER}/${userId}/${uploadId}`;

/**
 * Como os registros de uma tela chegam a quem os vê.
 *
 * - `self`: a tela É o sujeito. Cada registro dela recebe convidados.
 * - `{ field }`: um campo `reference` aponta para o sujeito — ou para outra tela do portal, que leva
 *   até ele.
 * - `parent`: herda do registro-pai (`parentEntity` / `parentFieldKey`).
 */
export type PortalSubject = 'self' | 'parent' | { field: string };

export interface PortalDeclaration {
  subject: PortalSubject;
  /** Os ÚNICOS campos que saem do escritório. O que não está aqui não chega ao portal. */
  fields: string[];
  /**
   * QUAIS registros saem — `type == "revenue"`. Expressão de campo sobre o registro INTEIRO (inclusive
   * o que não sai), avaliada no servidor sempre que a projeção é escrita. Falsa ou inválida, a
   * projeção não existe; e o registro escondido corta a corrente: o filho que só chegava ao sujeito
   * por ele também não aparece. Ausente, todos saem.
   */
  visibleWhen?: string | null;
  /** Expõe os documentos do registro que alguém do escritório marcou como compartilhados. */
  documents?: boolean | null;
  /**
   * O convidado CRIA registros desta tela — e só preenche estes campos. O vínculo com o dono não
   * está entre eles: quem o carimba é o servidor, a partir do que o convidado de fato enxerga. Não
   * vale para a tela-sujeito: o convidado cria PARA a empresa dele, nunca uma empresa nova.
   */
  create?: { fields: string[] } | null;
  /**
   * O convidado ANEXA documentos ao registro — escolhendo o tipo entre os que o escritório já tem (os
   * de `types`, ou qualquer um quando a lista está vazia), e nunca criando um tipo novo. Ver
   * documentos (`documents`) não dá o direito de anexar; anexar exige ver, para o convidado enxergar o
   * que enviou. Excluir não existe para ele, em caso nenhum.
   */
  uploads?: { types: string[] } | null;
  /**
   * O convidado ALTERA registros desta tela — só estes campos, e só os que ele já vê (um campo que não
   * está em `fields` não é editável, porque ele não saberia o que está trocando). O vínculo com o dono
   * nunca está entre eles.
   *
   * - `when`: a condição, sobre o registro INTEIRO, em que a edição está aberta — `status == "draft"`.
   *   Avaliada no servidor a cada pedido; ausente, sempre aberta; inválida, fechada.
   * - `onlyOwn`: só os registros que o próprio convidado criou pelo portal.
   */
  edit?: PortalEditDeclaration | null;
  /**
   * Avisar o escritório do que o convidado faz aqui — criar, alterar, anexar. Ligado por padrão:
   * `false` desliga. Recebe quem pode alterar a coleção E tem `portal.activity`.
   */
  notifyOffice?: boolean;
  /**
   * Quem pode CONVIDAR para os registros desta tela, além de quem tem `portal.manage` em
   * Configurações › Portal. `automation: true` abre a porta para os passos `portal-invite` — o
   * credenciamento que segue um registro validado. Só vale na tela-sujeito.
   *
   * Mora na declaração, e não numa permissão de quem dispara, porque é decisão de EXPOSIÇÃO: a chave
   * `portal` só é gravada por quem tem `portal.manage` (ou instala o pacote), e a regra já cobra isso.
   */
  invites?: { automation: boolean } | null;
  /**
   * O convidado recebe link CURTO de documento — assinado, válido por `expiresInMinutes`, emitido a cada
   * abertura depois de conferir convite, registro e marca —, nunca o link permanente do arquivo. Revogar
   * o convite torna inúteis os links já emitidos assim que vencem. Ausente, vale o link permanente.
   *
   * Ligada, também tira da projeção o valor dos campos `file` expostos: ele É um link permanente.
   */
  documentLinks?: PortalDocumentLinksDeclaration | null;
  /**
   * Registrar no SERVIDOR quando o convidado abre um registro desta tela ou obtém o link de um documento
   * dele: uma linha de Auditoria e o evento `<prefixo>.portalViewed`, com o convidado como ator e o
   * instante do servidor. Não altera o registro. Ausente, nada é registrado — nem gravado.
   *
   * O documento só é entregue DEPOIS de registrado: a URL passa pelo servidor. A abertura do registro é
   * avisada pela casca do portal, porque a projeção é lida direto do Firestore.
   */
  trackViews?: boolean;
  /**
   * As AÇÕES do escritório que o convidado dispara no registro aberto — pela `key` delas, na ordem em que
   * os botões aparecem. Só valem as que a tela já põe no cabeçalho do registro (`viewActionIds`): o
   * portal mostra um SUBCONJUNTO das ações do registro, com o título, o ícone, a confirmação e as
   * condições (`hiddenWhen`/`disabledWhen`) que o escritório deu a elas.
   *
   * O servidor avalia as condições sobre o registro INTEIRO, com `surface == "portal"`, e as cobra de
   * novo ao executar: o convidado não é de confiança, e a condição é a única coisa entre ele e o fluxo.
   * O fluxo roda como o convidado (`via: 'portal'`, permissão nenhuma). Só entram as ações que rodam
   * uma automação e não perguntam nada — um comando de tela ou um formulário de parâmetros não têm
   * onde acontecer no portal.
   */
  actions?: string[] | null;
  /**
   * Os campos `reference` expostos cujo rótulo é o TÍTULO do registro apontado MESMO quando a tela dele
   * não está no portal — o contribuinte no domicílio, sem levar ao portal a tela de contribuintes (CPF,
   * endereço). Só o valor do campo de título do apontado sai; nenhum outro campo dele, e o convidado não
   * abre o registro apontado.
   *
   * Sem esta lista, a referência para uma tela fora do portal sai sem rótulo — o funcionário responsável
   * não leva o nome dele junto —, e é o padrão: levar o nome é decisão de exposição, tomada campo a campo.
   */
  referenceTitles?: string[] | null;
  /**
   * O DESENHO do portal para esta tela — o cartão das listas e o registro aberto —, declarado sem
   * código (`domain/schema/ui/portalTemplate.ts`). É apresentação, não exposição: só arranja o que
   * `fields`, `edit` e `actions` já decidiram, e nada dele entra na projeção. Ausente, o portal de sempre.
   */
  template?: PortalTemplate | null;
}

export interface PortalDocumentLinksDeclaration {
  /** 1 a `PORTAL_DOCUMENT_LINK_MAX_MINUTES`; fora disso, `PORTAL_DOCUMENT_LINK_DEFAULT_MINUTES`. */
  expiresInMinutes: number;
}

export interface PortalEditDeclaration {
  fields: string[];
  when?: string | null;
  onlyOwn?: boolean;
}

/** O mínimo de uma tela que o portal precisa ler. */
export interface PortalScreenLike {
  id: string;
  /** A coleção onde os registros vivem — `dataCollection` ou o próprio id. */
  collection: string;
  titleFieldKey?: string | null;
  fields: ReadonlyArray<{
    key: string;
    type?: string;
    refEntity?: string | null;
    multi?: boolean;
    required?: boolean;
    defaultValue?: unknown;
    autoValue?: unknown;
    logic?: { derive?: string | null } | null;
  }>;
  parentEntity?: string | null;
  parentFieldKey?: string | null;
  /** As ações do cabeçalho do registro no escritório — de onde saem as do portal (`portal.actions`). */
  viewActionIds?: readonly string[] | null;
  portal?: PortalDeclaration | null;
}

export const portalSubjectKey = (collection: string, recordId: string): string => `${collection}/${recordId}`;

export const parsePortalSubjectKey = (key: string): { collection: string; recordId: string } | null => {
  const slash = key.indexOf('/');
  if (slash <= 0 || slash === key.length - 1 || key.indexOf('/', slash + 1) !== -1) return null;
  return { collection: key.slice(0, slash), recordId: key.slice(slash + 1) };
};

export const portalRecordDocId = (collection: string, recordId: string): string => `${collection}__${recordId}`;

/** O inverso de `portalRecordDocId`: o id do REGISTRO, a partir da projeção dele. */
export const portalRecordIdOf = (collection: string, projectionId: string): string => {
  const prefix = `${collection}__`;
  return projectionId.startsWith(prefix) ? projectionId.slice(prefix.length) : projectionId;
};

/** O endereço do portal — fora do espaço de trabalho do escritório, e da pilha de stores dele. */
export const PORTAL_BASE_PATH = '/portal';

/** O parâmetro do endereço que abre um registro no portal. */
export const PORTAL_RECORD_PARAM = 'record';

/**
 * O endereço de UM registro no portal: `/portal/<escritório>/<coleção>?record=<id>`. É o link dos
 * avisos ao convidado — no e-mail e no sino —, e nunca o do escritório, que ele não abre. A coleção
 * ocupa o lugar do item do menu (o item de uma tela é o nome da coleção dela): a tela de topo abre
 * dentro do próprio item, e a filha abre sozinha.
 */
export const portalRecordPath = (tenantId: string, collection: string, recordId: string): string =>
  `${PORTAL_BASE_PATH}/${encodeURIComponent(tenantId)}/${encodeURIComponent(collection)}`
  + `?${PORTAL_RECORD_PARAM}=${encodeURIComponent(recordId)}`;

export const normalizePortalEmail = (email: string): string => email.trim().toLowerCase();

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * A declaração solta, lida com desconfiança. Malformada é AUSENTE: um portal que não sabe a quem
 * entregar não entrega a ninguém.
 */
export const asPortalDeclaration = (value: unknown): PortalDeclaration | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  let subject: PortalSubject | null = null;
  if (raw.subject === 'self' || raw.subject === 'parent') subject = raw.subject;
  else if (raw.subject && typeof raw.subject === 'object' && isNonEmptyString((raw.subject as Record<string, unknown>).field)) {
    subject = { field: ((raw.subject as Record<string, unknown>).field as string).trim() };
  }
  if (!subject) return null;

  const fields = Array.isArray(raw.fields)
    ? [...new Set(raw.fields.filter(isNonEmptyString).map((key) => key.trim()))]
    : [];

  const rawCreate = raw.create as Record<string, unknown> | null | undefined;
  const create = subject !== 'self' && rawCreate && typeof rawCreate === 'object' && Array.isArray(rawCreate.fields)
    ? { fields: [...new Set(rawCreate.fields.filter(isNonEmptyString).map((key) => key.trim()))] }
    : null;

  const rawUploads = raw.uploads as Record<string, unknown> | null | undefined;
  const uploads = rawUploads && typeof rawUploads === 'object'
    ? { types: Array.isArray(rawUploads.types) ? [...new Set(rawUploads.types.filter(isNonEmptyString))] : [] }
    : null;

  const rawInvites = raw.invites as Record<string, unknown> | null | undefined;
  const invites = rawInvites && typeof rawInvites === 'object' && rawInvites.automation === true
    ? { automation: true }
    : null;

  const rawEdit = raw.edit as Record<string, unknown> | null | undefined;
  const edit: PortalEditDeclaration | null = rawEdit && typeof rawEdit === 'object' && Array.isArray(rawEdit.fields)
    ? {
      fields: [...new Set(rawEdit.fields.filter(isNonEmptyString).map((key) => key.trim()))],
      ...(isNonEmptyString(rawEdit.when) ? { when: rawEdit.when.trim() } : {}),
      ...(rawEdit.onlyOwn === true ? { onlyOwn: true } : {}),
    }
    : null;

  const rawLinks = raw.documentLinks as Record<string, unknown> | null | undefined;
  const documentLinks = rawLinks && typeof rawLinks === 'object' && !Array.isArray(rawLinks)
    ? {
      expiresInMinutes: typeof rawLinks.expiresInMinutes === 'number'
        ? rawLinks.expiresInMinutes
        : PORTAL_DOCUMENT_LINK_DEFAULT_MINUTES,
    }
    : null;

  const actions = Array.isArray(raw.actions)
    ? [...new Set(raw.actions.filter(isNonEmptyString).map((key) => key.trim()))]
    : [];

  const referenceTitles = Array.isArray(raw.referenceTitles)
    ? [...new Set(raw.referenceTitles.filter(isNonEmptyString).map((key) => key.trim()))]
    : [];

  const template = readPortalTemplate(raw.template);

  return {
    subject,
    fields,
    ...(isNonEmptyString(raw.visibleWhen) ? { visibleWhen: raw.visibleWhen.trim() } : {}),
    documents: raw.documents === true,
    ...(create ? { create } : {}),
    ...(uploads ? { uploads } : {}),
    ...(edit ? { edit } : {}),
    ...(raw.notifyOffice === false ? { notifyOffice: false } : {}),
    ...(invites ? { invites } : {}),
    ...(documentLinks ? { documentLinks } : {}),
    ...(raw.trackViews === true ? { trackViews: true } : {}),
    ...(actions.length > 0 ? { actions } : {}),
    ...(referenceTitles.length > 0 ? { referenceTitles } : {}),
    ...(template ? { template } : {}),
  };
};

/** A tela registra as aberturas do convidado (`trackViews`). */
export const portalTracksViews = (screen: Pick<PortalScreenLike, 'portal'>): boolean => screen.portal?.trackViews === true;

/** O mínimo de uma Action (`ActionDefinition`) que o portal precisa ler. */
export interface PortalActionLike {
  id: string;
  key: string;
  workflowId?: string | null;
  command?: string | null;
  promptParameters?: boolean | null;
  enabled?: boolean;
  hiddenWhen?: string | null;
  disabledWhen?: string | null;
}

/** Por que uma ação que a tela põe no registro não serve ao portal — `null` quando serve. */
type PortalActionProblem = 'disabled' | 'not-runnable' | 'prompts';

const portalActionProblem = (action: PortalActionLike): PortalActionProblem | null => {
  if (action.enabled === false) return 'disabled';
  if (isNonEmptyString(action.command) || !isNonEmptyString(action.workflowId)) return 'not-runnable';
  if (action.promptParameters === true) return 'prompts';
  return null;
};

/**
 * As ações do cabeçalho do registro (`viewActionIds`), na ordem dele, indexadas pela `key`. Duas com a
 * mesma chave: vale a primeira, como no cabeçalho do escritório, que as desenha nessa ordem.
 */
const attachedActionsByKey = <T extends PortalActionLike>(
  screen: PortalScreenLike,
  actions: readonly T[],
): Map<string, T> => {
  const byId = new Map(actions.map((action) => [action.id, action]));
  const byKey = new Map<string, T>();
  for (const id of screen.viewActionIds ?? []) {
    const action = byId.get(id);
    if (action && !byKey.has(action.key)) byKey.set(action.key, action);
  }
  return byKey;
};

/**
 * As ações que a tela PODE oferecer no portal — as do cabeçalho do registro, na ordem dele, que estão
 * ligadas, rodam uma automação e não perguntam nada. É a lista de onde o escritório escolhe.
 */
export const portalOfferableActions = <T extends PortalActionLike>(screen: PortalScreenLike, actions: readonly T[]): T[] =>
  [...attachedActionsByKey(screen, actions).values()].filter((action) => !portalActionProblem(action));

/**
 * As ações que o convidado pode ver no registro aberto, na ordem da declaração: das que a tela põe no
 * cabeçalho do registro, as de chave declarada que estão ligadas, rodam uma automação e não perguntam
 * nada. A declaração que ficou para trás — a ação saiu da tela, virou comando — simplesmente some.
 */
export const portalRecordActions = <T extends PortalActionLike>(screen: PortalScreenLike, actions: readonly T[]): T[] => {
  const attached = attachedActionsByKey(screen, actions);
  return (screen.portal?.actions ?? []).flatMap((key) => {
    const action = attached.get(key);
    return action && !portalActionProblem(action) ? [action] : [];
  });
};

/** O que o convidado vê de uma ação neste registro: o botão, o botão apagado, ou nada. */
export type PortalActionState = 'enabled' | 'disabled' | 'hidden';

export interface PortalActionScope {
  /** O registro INTEIRO, como está gravado — inclusive o que não sai do escritório. */
  record: Record<string, unknown>;
  /** A coleção do registro: o que `<entity>` vira em `hasPermission`. */
  collection: string;
  /** O convidado: `user.id` e `user.name` nas expressões. Permissão, nenhuma. */
  guest: { id: string; name: string };
  timeZone?: string;
}

/**
 * Uma condição da ação, como o SERVIDOR a avalia para o convidado. Fecha na dúvida: a expressão que
 * estoura esconde ou desabilita — o contrário do escritório, onde ela é só desenho e o membro tem as
 * regras do Firestore atrás dele. O campo citado que o registro não tem vale `null`, pela razão de
 * `evaluatePortalCondition`: `accepted != true` sobre o registro sem `accepted` responde sobre o vazio.
 */
const portalActionCondition = (expression: string | null | undefined, scope: PortalActionScope): boolean => {
  if (!expression?.trim()) return false;
  const reserved = new Set<string>(ACTION_RESERVED_VARIABLES);
  const absent = extractFieldExpressionPaths(expression)
    .map((path) => path.split('.')[0])
    .filter((root) => !reserved.has(root))
    .map((root) => [root, null] as const);
  const context = actionFieldContext({
    values: { ...Object.fromEntries(absent), ...scope.record },
    record: scope.record,
    isNew: false,
    isDirty: false,
    permissions: [],
    surface: PORTAL_ACTION_SURFACE,
    relation: 'none',
    user: { id: scope.guest.id, name: scope.guest.name, permissions: [] },
    entity: scope.collection,
    ...(scope.timeZone ? { timeZone: scope.timeZone } : {}),
  });
  return evaluateFieldBoolean(expression, context, true);
};

/**
 * O estado da ação para o convidado, neste registro e agora. É o que desenha o botão E o que a execução
 * cobra: oculta ou desabilitada, ela não roda.
 */
export const portalActionState = (action: PortalActionLike, scope: PortalActionScope): PortalActionState => {
  if (portalActionCondition(action.hiddenWhen, scope)) return 'hidden';
  if (portalActionCondition(action.disabledWhen, scope)) return 'disabled';
  return 'enabled';
};

const PORTAL_ACTION_PROBLEM_MESSAGES: Record<PortalActionProblem, string> = {
  disabled: '@core.records/portal.issue.action.disabled',
  'not-runnable': '@core.records/portal.issue.action.not-runnable',
  prompts: '@core.records/portal.issue.action.prompts',
};

/**
 * As ações declaradas que não chegariam ao convidado, cada uma com o motivo: não está no cabeçalho do
 * registro (ou a chave mudou), está desligada, é um comando de tela, ou pergunta parâmetros. O servidor,
 * diante delas, só não desenha o botão — calado; aqui o escritório fica sabendo antes de gravar.
 */
export const portalActionIssues = (
  screen: PortalScreenLike,
  actions: readonly PortalActionLike[],
): PortalDeclarationIssue[] => {
  const attached = attachedActionsByKey(screen, actions);
  return (screen.portal?.actions ?? []).flatMap((key): PortalDeclarationIssue[] => {
    const action = attached.get(key);
    if (!action) return [{ message: '@core.records/portal.issue.action.unknown', messageParams: { action: key } }];
    const problem = portalActionProblem(action);
    return problem ? [{ message: PORTAL_ACTION_PROBLEM_MESSAGES[problem], messageParams: { action: key } }] : [];
  });
};

/**
 * A marca de "já registrado" de uma abertura: o escritório, o convidado, a projeção e — no documento —
 * o documento. Os ids não têm `/` (são chave de documento do Firestore), e por isso a junção é única.
 */
export const portalViewMarkId = (
  tenantId: string,
  userId: string,
  projectionId: string,
  documentId: string | null,
): string => [tenantId, userId, projectionId, documentId ?? ''].join('__');

/** A abertura anterior, registrada em `lastAt`, ainda cobre a de agora. */
export const isRepeatedPortalView = (lastAt: Date | null, now: Date): boolean =>
  !!lastAt && now.getTime() - lastAt.getTime() < PORTAL_VIEW_REPEAT_MINUTES * 60_000;

const isValidDocumentLinkMinutes = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= PORTAL_DOCUMENT_LINK_MAX_MINUTES;

/**
 * A validade pedida, ou a padrão. A validade inválida NÃO desliga o link curto: quem escreveu a chave
 * pediu que nada permanente saísse, e errar o número não pode entregar o contrário.
 */
const documentLinkMinutesOf = (value: unknown): number =>
  isValidDocumentLinkMinutes(value) ? value : PORTAL_DOCUMENT_LINK_DEFAULT_MINUTES;

/** Os minutos de validade do link de documento desta tela — `null` quando ela entrega o link permanente. */
export const portalDocumentLinkMinutes = (screen: PortalScreenLike): number | null => {
  const links = screen.portal?.documentLinks;
  return links ? documentLinkMinutesOf(links.expiresInMinutes) : null;
};

/**
 * Os tipos que o convidado pode escolher ao anexar: os que a tela restringiu, entre os que o
 * escritório TEM — um tipo apagado do escritório sai daqui junto. Sem restrição, todos os dele. Nunca
 * um tipo que não esteja na lista do escritório: o convidado escolhe, não cria.
 */
export const portalUploadTypes = <T extends { key: string }>(
  screen: PortalScreenLike,
  available: readonly T[],
): T[] => {
  const declared = screen.portal?.uploads?.types ?? [];
  return declared.length === 0 ? [...available] : available.filter((option) => declared.includes(option.key));
};

/**
 * O campo que liga um registro ao dono dele, e a tela para onde aponta: o campo de referência, ou o
 * do pai. `null` para a tela-sujeito — ela não aponta para ninguém.
 */
export const portalLinkOf = (
  screen: PortalScreenLike,
): { fieldKey: string; targetEntity: string; multi: boolean } | null => {
  const subject = screen.portal?.subject;
  if (!subject || subject === 'self') return null;
  if (subject === 'parent') {
    return screen.parentEntity && screen.parentFieldKey
      ? { fieldKey: screen.parentFieldKey, targetEntity: screen.parentEntity, multi: false }
      : null;
  }
  const field = screen.fields.find((one) => one.key === subject.field);
  return field?.type === 'reference' && field.refEntity
    ? { fieldKey: field.key, targetEntity: field.refEntity, multi: field.multi === true }
    : null;
};

/** A tela que declara `portal` para os registros desta coleção. */
export const portalScreenOf = <T extends PortalScreenLike>(screens: readonly T[], collection: string): T | undefined =>
  screens.find((screen) => screen.collection === collection && !!screen.portal);

/**
 * A tela do portal para onde um vínculo (`refEntity`, `parentEntity`) aponta.
 *
 * O vínculo aponta para REGISTROS, e registro é da coleção: a chave pode ser o nome dela (`cases`) ou
 * a chave de uma tela (`processos`), e as duas levam à tela que está no portal para aquela coleção.
 * Uma coleção costuma ter mais de uma tela — a de extensão com `dataCollection` e a âncora das rules
 * que a instalação grava com o nome da coleção, sem portal —, e procurar pelo id primeiro achava a
 * âncora e cortava a corrente em silêncio.
 */
export const portalTargetScreen = <T extends PortalScreenLike>(screens: readonly T[], entityKey: string): T | undefined =>
  portalScreenOf(screens, entityKey)
  ?? portalScreenOf(screens, screens.find((screen) => screen.id === entityKey)?.collection ?? entityKey);

/**
 * Os campos que o convidado preenche ao criar — os declarados que existem, sem o vínculo e sem o
 * número que o sistema atribui (`autoValue.sequence`): esse não é de quem preenche, nem do escritório.
 */
export const portalCreateFieldKeys = (screen: PortalScreenLike): string[] => {
  const declared = new Set(screen.fields.filter((field) => !isSequenceField(field)).map((field) => field.key));
  const link = portalLinkOf(screen)?.fieldKey;
  return (screen.portal?.create?.fields ?? []).filter((key) => declared.has(key) && key !== link);
};

/**
 * O que o convidado manda vira o que se grava: só os campos que a tela deixa ele preencher, mais o
 * vínculo carimbado pelo servidor. Qualquer outra chave — inclusive o próprio vínculo, se ele o
 * mandar — é descartada, e é isso que impede um convidado de criar um registro para outra empresa.
 */
export const buildPortalSubmission = (
  screen: PortalScreenLike,
  data: Record<string, unknown>,
  linkRecordId: string,
): Record<string, unknown> | null => {
  const link = portalLinkOf(screen);
  if (!link) return null;
  const submission: Record<string, unknown> = {};
  for (const key of portalCreateFieldKeys(screen)) {
    if (data[key] !== undefined) submission[key] = data[key];
  }
  submission[link.fieldKey] = link.multi ? [linkRecordId] : linkRecordId;
  return submission;
};

/**
 * Os campos que o convidado altera — os declarados que ele VÊ, sem o vínculo. Um campo editável fora
 * dos expostos não entra: alterar às cegas o que não se enxerga não é edição, é sobrescrita.
 */
export const portalEditFieldKeys = (screen: PortalScreenLike): string[] => {
  const exposed = new Set(portalFieldKeys(screen));
  const numbered = new Set(screen.fields.filter(isSequenceField).map((field) => field.key));
  const link = portalLinkOf(screen)?.fieldKey;
  return (screen.portal?.edit?.fields ?? [])
    .filter((key) => exposed.has(key) && key !== link && !numbered.has(key));
};

/**
 * A edição está aberta para ESTE registro, independentemente de quem pede: a condição do escritório
 * vale. Expressão que estoura fecha — na dúvida, o convidado não altera.
 */
export const isPortalEditOpen = (
  screen: PortalScreenLike,
  data: Record<string, unknown>,
  evaluate: (expression: string, data: Record<string, unknown>) => boolean,
): boolean => {
  const edit = screen.portal?.edit;
  if (!edit || portalEditFieldKeys(screen).length === 0) return false;
  return !edit.when || evaluate(edit.when, data);
};

/**
 * A condição do escritório sobre o registro, como o servidor a avalia: estourou, é `false`.
 *
 * O campo citado que o registro não tem vale `null`, e não estoura: o Firestore não grava o campo
 * vazio, e `officeOnly != true` sobre o pedido que o convidado criou — sem `officeOnly` — tem de
 * responder sobre o vazio, e não fechar por um nome que o avaliador não encontrou.
 */
export const evaluatePortalCondition = (expression: string, data: Record<string, unknown>, timeZone?: string): boolean => {
  const absent = extractFieldExpressionPaths(expression).map((path) => [path.split('.')[0], null] as const);
  const scope = { ...Object.fromEntries(absent), ...data };
  return evaluateFieldBoolean(expression, { value: undefined, data: scope, ...(timeZone ? { timeZone } : {}) }, false);
};

/**
 * O registro passa pelo filtro da tela — e só então pode haver projeção dele. Sem `visibleWhen`, todos
 * passam; expressão que estoura esconde: na dúvida, o registro não sai do escritório.
 */
export const isPortalRecordVisible = (
  screen: PortalScreenLike,
  data: Record<string, unknown>,
  evaluate: (expression: string, data: Record<string, unknown>) => boolean = evaluatePortalCondition,
): boolean => {
  const visibleWhen = screen.portal?.visibleWhen;
  return !visibleWhen || evaluate(visibleWhen, data);
};

/** O convidado que criou o registro pelo portal — o "dono" de `onlyOwn`. Criado no escritório, ninguém. */
export const portalOwnerOf = (data: Record<string, unknown>): string | null =>
  data[RECORD_CREATED_VIA_FIELD] === 'portal' && isNonEmptyString(data.createdBy) ? data.createdBy : null;

/** Quem, entre os que veem, pode alterar: todos, ou só o dono quando a tela pede `onlyOwn`. */
export const canPortalUserEdit = (
  screen: PortalScreenLike,
  userId: string,
  projection: { editable?: boolean; portalOwner?: string | null },
): boolean =>
  projection.editable === true
  && (screen.portal?.edit?.onlyOwn !== true || projection.portalOwner === userId);

/** O que o convidado manda numa edição vira o que se grava: só os campos editáveis. Nada mais passa. */
export const buildPortalEdit = (
  screen: PortalScreenLike,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const changes: Record<string, unknown> = {};
  for (const key of portalEditFieldKeys(screen)) {
    if (data[key] !== undefined) changes[key] = data[key];
  }
  return changes;
};

export const isPortalSubjectScreen = (screen: PortalScreenLike): boolean => screen.portal?.subject === 'self';

/** A tela-sujeito que aceita convite feito por automação (`portal.invites.automation`). */
export const acceptsAutomationInvites = (screen: PortalScreenLike): boolean =>
  isPortalSubjectScreen(screen) && screen.portal?.invites?.automation === true;

/** Os campos expostos que a tela de fato declara — a declaração que ficou para trás não vaza nada. */
export const portalFieldKeys = (screen: PortalScreenLike): string[] => {
  const declared = new Set(screen.fields.map((field) => field.key));
  return (screen.portal?.fields ?? []).filter((key) => declared.has(key));
};

/**
 * Os campos `file` expostos de uma tela com link curto. O valor deles é a URL permanente do arquivo, e
 * com `documentLinks` ela não sai: o convidado que a guardasse continuaria abrindo o arquivo depois de
 * ter o convite revogado.
 */
export const portalWithheldFileFields = (screen: PortalScreenLike): string[] => {
  if (portalDocumentLinkMinutes(screen) === null) return [];
  const exposed = new Set(portalFieldKeys(screen));
  return screen.fields.filter((field) => field.type === 'file' && exposed.has(field.key)).map((field) => field.key);
};

/**
 * Os campos DERIVADOS (`logic.derive`) que a declaração leva ao portal — expostos ou preenchíveis. O
 * derivado é calculado na leitura e nunca gravado, e a projeção copia o gravado: ele chegaria sempre
 * vazio. Avaliá-lo na projeção congelaria o valor do instante da gravação, que é o que o `derive` existe
 * para evitar.
 */
export const portalDerivedFieldKeys = (screen: PortalScreenLike): string[] => {
  const derived = new Set(screen.fields.filter((field) => field.logic?.derive?.trim()).map((field) => field.key));
  return [...new Set([...(screen.portal?.fields ?? []), ...(screen.portal?.create?.fields ?? [])])]
    .filter((key) => derived.has(key));
};

/** Só os campos expostos. É a única porta por onde dado do registro sai para o portal. */
export const projectPortalData = (
  screen: PortalScreenLike,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const withheld = new Set(portalWithheldFileFields(screen));
  const projected: Record<string, unknown> = {};
  for (const key of portalFieldKeys(screen)) {
    if (data[key] !== undefined && !withheld.has(key)) projected[key] = data[key];
  }
  return projected;
};

/** O id gravado num campo `reference` — um só, ou a lista dos marcados. */
export const referencedIds = (value: unknown): string[] => {
  if (isNonEmptyString(value)) return [value];
  if (Array.isArray(value)) return value.filter(isNonEmptyString);
  return [];
};

export interface PortalSubjectDeps {
  /** A tela do portal para onde esta chave de entidade (`refEntity`, `parentEntity`) aponta — `portalTargetScreen`. */
  screenFor: (entityKey: string) => PortalScreenLike | undefined;
  getRecord: (collection: string, recordId: string) => Promise<Record<string, unknown> | undefined>;
}

/**
 * As chaves de sujeito (`colecao/id`) a que um registro pertence.
 *
 * Segue a corrente declarada até a tela-sujeito: a nota aponta para a empresa (`self`); o prazo
 * aponta para o processo, que aponta para o cliente. Uma tela no caminho que não declare portal
 * corta a corrente — e o registro fica sem sujeito, que é a resposta fechada. Um registro que não
 * passa no `visibleWhen` da tela dele corta do mesmo jeito, seja ele o próprio, um elo do meio ou o
 * sujeito: o que está escondido não leva ninguém a lugar nenhum.
 */
export const resolvePortalSubjectKeys = async (
  screen: PortalScreenLike,
  recordId: string,
  data: Record<string, unknown>,
  deps: PortalSubjectDeps,
  depth = 0,
): Promise<string[]> => {
  const subject = screen.portal?.subject;
  if (!subject || !isPortalRecordVisible(screen, data)) return [];
  if (subject === 'self') return [portalSubjectKey(screen.collection, recordId)];
  if (depth >= PORTAL_SUBJECT_MAX_DEPTH) return [];

  let entityKey: string | null | undefined;
  let ids: string[];
  if (subject === 'parent') {
    entityKey = screen.parentEntity;
    ids = screen.parentFieldKey ? referencedIds(data[screen.parentFieldKey]) : [];
  } else {
    const field = screen.fields.find((one) => one.key === subject.field);
    entityKey = field?.type === 'reference' ? field.refEntity : null;
    ids = field ? referencedIds(data[field.key]) : [];
  }
  if (!entityKey || ids.length === 0) return [];

  const target = deps.screenFor(entityKey);
  if (!target?.portal) return [];
  // A tela-sujeito sem filtro dispensa a leitura: o id já é a chave. Com filtro, o sujeito é lido
  // como qualquer elo, para saber se ele mesmo está no portal.
  if (target.portal.subject === 'self' && !target.portal.visibleWhen) {
    return ids.map((id) => portalSubjectKey(target.collection, id));
  }

  const keys = new Set<string>();
  for (const id of ids) {
    const parent = await deps.getRecord(target.collection, id);
    if (!parent) continue;
    for (const key of await resolvePortalSubjectKeys(target, id, parent, deps, depth + 1)) keys.add(key);
  }
  return [...keys];
};

/** O campo de título da tela, quando ele é uma referência — o título é então o do registro apontado. */
const referenceTitleField = (screen: PortalScreenLike) => {
  const field = screen.titleFieldKey ? screen.fields.find((one) => one.key === screen.titleFieldKey) : undefined;
  return field?.type === 'reference' ? field : undefined;
};

/**
 * O campo de título do registro, como texto. O título que é REFERÊNCIA não tem texto aqui: o valor
 * gravado é o id do apontado, que não diz nada a quem lê — e quem sabe o nome dele é quem resolve a
 * referência (`portalExposedTitle` com os rótulos, `officeRecordTitle`).
 */
export const portalRecordTitle = (screen: PortalScreenLike, data: Record<string, unknown>): string => {
  if (referenceTitleField(screen)) return '';
  const value = screen.titleFieldKey ? data[screen.titleFieldKey] : undefined;
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
};

/**
 * O título que a lista do PORTAL mostra — só quando o campo de título está entre os expostos. O
 * título é um campo como outro qualquer: mostrá-lo sem a tela ter escolhido seria a porta lateral por
 * onde sai o que a declaração não deixou sair.
 *
 * O título que é referência é o RÓTULO dela (`labels`, montado por `portalReferenceLabels`): sem rótulo,
 * vazio — nunca o id gravado.
 */
export const portalExposedTitle = (
  screen: PortalScreenLike,
  data: Record<string, unknown>,
  labels: Readonly<Record<string, string>> = {},
): string => {
  if (!screen.titleFieldKey || !portalFieldKeys(screen).includes(screen.titleFieldKey)) return '';
  return referenceTitleField(screen) ? labels[screen.titleFieldKey] ?? '' : portalRecordTitle(screen, data);
};

/**
 * A tela que dá NOME aos registros da coleção apontada por `entityKey`, esteja ela no portal ou não.
 * Uma coleção costuma ter mais de uma tela — a de extensão com `dataCollection` e a âncora das rules —,
 * e as duas carregam o `titleFieldKey`; vale a que DECLARA o campo de título, porque é ela que sabe se
 * ele é texto ou outra referência.
 */
export const referenceTitleScreen = <T extends PortalScreenLike>(screens: readonly T[], entityKey: string): T | undefined => {
  const collection = portalTargetScreen(screens, entityKey)?.collection
    ?? screens.find((screen) => screen.id === entityKey)?.collection
    ?? entityKey;
  const naming = screens.filter((screen) => screen.collection === collection && !!screen.titleFieldKey);
  return naming.find((screen) => screen.fields.some((field) => field.key === screen.titleFieldKey)) ?? naming[0];
};

/** As chaves de `referenceTitles` que de fato servem: campos `reference` com alvo, e expostos. */
export const portalReferenceTitleKeys = (screen: PortalScreenLike): string[] => {
  const exposed = new Set(portalFieldKeys(screen));
  return (screen.portal?.referenceTitles ?? []).filter((key) => {
    const field = screen.fields.find((one) => one.key === key);
    return exposed.has(key) && field?.type === 'reference' && !!field.refEntity;
  });
};

/** De onde sai o rótulo de uma referência exposta. */
export interface PortalReferenceLabel<T extends PortalScreenLike> {
  fieldKey: string;
  multi: boolean;
  /** A tela cujo título é o rótulo. */
  target: T;
  /**
   * `referenceTitles`: o título sai mesmo com a tela apontada fora do portal. Senão, só sai o título que
   * a tela apontada, no portal, já expõe.
   */
  declared: boolean;
}

/**
 * As referências expostas que ganham rótulo, e a tela de onde cada uma tira o título. A referência
 * fora daqui — tela apontada fora do portal, sem `referenceTitles` — sai sem rótulo: apontar para uma
 * tela interna (o funcionário responsável) não leva o nome dele junto.
 */
export const portalReferenceLabels = <T extends PortalScreenLike>(
  screens: readonly T[],
  screen: PortalScreenLike,
): PortalReferenceLabel<T>[] => {
  const declared = new Set(portalReferenceTitleKeys(screen));
  return portalFieldKeys(screen).flatMap((fieldKey): PortalReferenceLabel<T>[] => {
    const field = screen.fields.find((one) => one.key === fieldKey);
    if (field?.type !== 'reference' || !field.refEntity) return [];
    const isDeclared = declared.has(fieldKey);
    const target = isDeclared ? referenceTitleScreen(screens, field.refEntity) : portalTargetScreen(screens, field.refEntity);
    return target ? [{ fieldKey, multi: field.multi === true, target, declared: isDeclared }] : [];
  });
};

/**
 * O título do registro apontado, como o rótulo o mostra. Um salto só: o apontado cujo título é outra
 * referência não tem texto aqui, e o rótulo fica vazio em vez de virar o id.
 */
export const portalReferenceTitle = (
  label: PortalReferenceLabel<PortalScreenLike>,
  referenced: Record<string, unknown>,
): string => (label.declared ? portalRecordTitle(label.target, referenced) : portalExposedTitle(label.target, referenced));

/**
 * As telas do portal cuja projeção mostra o título de um registro desta coleção — no rótulo de uma
 * referência exposta, ou no próprio título quando ele é essa referência. É quem precisa ser refeito
 * quando esse título muda.
 */
export const portalLabelReferrers = <T extends PortalScreenLike>(
  screens: readonly T[],
  collection: string,
): Array<{ screen: T; label: PortalReferenceLabel<T> }> =>
  screens
    .filter((screen) => !!screen.portal)
    .flatMap((screen) => portalReferenceLabels(screens, screen)
      .filter((label) => label.target.collection === collection)
      .map((label) => ({ screen, label })));

/**
 * O título de um registro como o ESCRITÓRIO o lê — no aviso do que o convidado fez. Quem está dentro
 * vê tudo, e o título que é referência é o título do registro apontado, nunca o id dele. Um salto só.
 */
export const officeRecordTitle = async (
  screens: readonly PortalScreenLike[],
  screen: PortalScreenLike,
  data: Record<string, unknown>,
  getRecord: (collection: string, recordId: string) => Promise<Record<string, unknown> | undefined>,
): Promise<string> => {
  const field = referenceTitleField(screen);
  if (!field) return portalRecordTitle(screen, data);
  const target = field.refEntity ? referenceTitleScreen(screens, field.refEntity) : undefined;
  if (!target) return '';
  const titles = await Promise.all(referencedIds(data[field.key]).map(async (id) => {
    const referenced = await getRecord(target.collection, id);
    return referenced ? portalRecordTitle(target, referenced) : '';
  }));
  return titles.filter((title) => title !== '').join(', ');
};

/** Um problema da declaração, como CHAVE de `core.records` — quem exibe traduz. */
export interface PortalDeclarationIssue {
  message: string;
  messageParams?: Record<string, string>;
}

/**
 * Uma condição da declaração (`visibleWhen`, `edit.when`): a sintaxe e os campos que ela cita. Campo
 * que a tela não tem é sempre vazio — a condição nunca vale, ou vale sempre —, e o escritório só
 * descobriria vendo o portal de um convidado. Os campos de sistema (`createdVia`, `createdAt`…) são do
 * registro inteiro, e valem. Do caminho `cliente.cidade` conta o primeiro segmento.
 */
const portalConditionIssues = (
  screen: PortalScreenLike,
  expression: string | null | undefined,
  messages: { invalid: string; unknownField: string },
): PortalDeclarationIssue[] => {
  if (!expression) return [];
  if (fieldExpressionSyntaxError(expression)) return [{ message: messages.invalid }];
  const declared = new Set(screen.fields.map((field) => field.key));
  const cited = [...new Set(extractFieldExpressionPaths(expression).map((path) => path.split('.')[0]))];
  return cited
    .filter((key) => !declared.has(key) && !SYSTEM_MANAGED_KEYS.has(key))
    .map((field) => ({ message: messages.unknownField, messageParams: { field } }));
};

/** Os problemas do `visibleWhen` sozinho — o que o empacotamento consegue conferir sem as outras telas. */
export const portalVisibilityIssues = (screen: PortalScreenLike): PortalDeclarationIssue[] =>
  portalConditionIssues(screen, screen.portal?.visibleWhen, {
    invalid: '@core.records/portal.issue.visible-when.invalid',
    unknownField: '@core.records/portal.issue.visible-when.field.unknown',
  });

/**
 * Os problemas de `documentLinks`. Nenhum deles abre o que a declaração fechou — no servidor, a validade
 * inválida cai na padrão, e o campo `file` simplesmente não sai —, mas o escritório não deveria
 * descobri-los pelo portal: a aba os mostra antes de gravar.
 */
export const portalDocumentLinkIssues = (screen: PortalScreenLike): PortalDeclarationIssue[] => {
  const links = screen.portal?.documentLinks;
  if (!links) return [];
  const issues: PortalDeclarationIssue[] = [];
  if (!isValidDocumentLinkMinutes(links.expiresInMinutes)) {
    issues.push({
      message: '@core.records/portal.issue.document-links.minutes',
      messageParams: { maximum: String(PORTAL_DOCUMENT_LINK_MAX_MINUTES) },
    });
  }
  for (const field of portalWithheldFileFields(screen)) {
    issues.push({ message: '@core.records/portal.issue.document-links.file-field', messageParams: { field } });
  }
  return issues;
};

/**
 * Os problemas de `referenceTitles` que a própria tela responde — o que o empacotamento confere sem as
 * outras telas. Nenhum deles abre nada: o servidor só leva o título de referência exposta.
 */
export const portalReferenceTitleIssues = (screen: PortalScreenLike): PortalDeclarationIssue[] => {
  const exposed = new Set(portalFieldKeys(screen));
  return (screen.portal?.referenceTitles ?? []).flatMap((key): PortalDeclarationIssue[] => {
    const field = screen.fields.find((one) => one.key === key);
    if (field?.type !== 'reference' || !field.refEntity) {
      return [{ message: '@core.records/portal.issue.reference-title.not-reference', messageParams: { field: key } }];
    }
    return exposed.has(key)
      ? []
      : [{ message: '@core.records/portal.issue.reference-title.hidden', messageParams: { field: key } }];
  });
};

/**
 * O que impede a declaração de entregar algo a alguém — conferido ANTES de gravar, para que o
 * escritório saiba na hora. O servidor, diante da mesma declaração, simplesmente não projeta nada: é
 * a resposta fechada, e calada. Aqui ela ganha voz.
 */
export const portalDeclarationIssues = (
  screen: PortalScreenLike,
  screens: readonly PortalScreenLike[],
  /** As ações do escritório. Ausentes, as de `portal.actions` não são conferidas. */
  actions?: readonly PortalActionLike[],
): PortalDeclarationIssue[] => {
  const portal = screen.portal;
  if (!portal) return [];
  const issues: PortalDeclarationIssue[] = [];
  if (actions) issues.push(...portalActionIssues(screen, actions));
  const declared = new Set(screen.fields.map((field) => field.key));

  if (portal.fields.length === 0) issues.push({ message: '@core.records/portal.issue.no-fields' });
  for (const key of portal.fields) {
    if (!declared.has(key)) issues.push({ message: '@core.records/portal.issue.field.unknown', messageParams: { field: key } });
  }

  for (const field of portalDerivedFieldKeys(screen)) {
    issues.push({ message: '@core.records/portal.issue.field.derived', messageParams: { field } });
  }

  issues.push(...portalVisibilityIssues(screen));

  if (portal.uploads && portal.documents !== true) {
    issues.push({ message: '@core.records/portal.issue.uploads.documents' });
  }

  issues.push(...portalDocumentLinkIssues(screen));

  issues.push(...portalReferenceTitleIssues(screen));
  for (const key of portalReferenceTitleKeys(screen)) {
    const refEntity = screen.fields.find((one) => one.key === key)?.refEntity as string;
    if (!referenceTitleScreen(screens, refEntity)) {
      issues.push({ message: '@core.records/portal.issue.reference-title.no-title', messageParams: { field: key, screen: refEntity } });
    }
  }

  if (portal.invites?.automation && portal.subject !== 'self') {
    issues.push({ message: '@core.records/portal.issue.invites.not-subject' });
  }

  if (portal.edit) {
    const exposed = new Set(portal.fields);
    const link = portalLinkOf(screen)?.fieldKey;
    if (portalEditFieldKeys(screen).length === 0) issues.push({ message: '@core.records/portal.issue.edit.no-fields' });
    for (const key of portal.edit.fields) {
      if (!exposed.has(key) || key === link) {
        issues.push({ message: '@core.records/portal.issue.edit.field.hidden', messageParams: { field: key } });
      }
    }
    issues.push(...portalConditionIssues(screen, portal.edit.when, {
      invalid: '@core.records/portal.issue.edit.when-invalid',
      unknownField: '@core.records/portal.issue.edit.when.field.unknown',
    }));
  }

  if (portal.create) {
    if (portal.subject === 'self') {
      issues.push({ message: '@core.records/portal.issue.create.self' });
    } else if (portalCreateFieldKeys(screen).length === 0) {
      issues.push({ message: '@core.records/portal.issue.create.no-fields' });
    } else {
      const fillable = new Set([...portalCreateFieldKeys(screen), portalLinkOf(screen)?.fieldKey]);
      for (const field of screen.fields) {
        const hasDefault = (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '')
          || isSequenceField(field);
        if (field.required && !hasDefault && !fillable.has(field.key)) {
          issues.push({ message: '@core.records/portal.issue.create.required-missing', messageParams: { field: field.key } });
        }
      }
    }
  }

  const subject = portal.subject;
  if (subject === 'self') return issues;

  let targetKey: string | null | undefined;
  if (subject === 'parent') {
    if (!screen.parentEntity || !screen.parentFieldKey) {
      issues.push({ message: '@core.records/portal.issue.parent.missing' });
      return issues;
    }
    targetKey = screen.parentEntity;
  } else {
    const field = screen.fields.find((one) => one.key === subject.field);
    if (!field || field.type !== 'reference' || !field.refEntity) {
      issues.push({ message: '@core.records/portal.issue.subject.not-reference', messageParams: { field: subject.field } });
      return issues;
    }
    targetKey = field.refEntity;
  }

  const visited = new Set<string>([screen.id]);
  for (let depth = 0; depth < PORTAL_SUBJECT_MAX_DEPTH && targetKey; depth += 1) {
    const target: PortalScreenLike | undefined = portalTargetScreen(screens, targetKey);
    if (!target?.portal) {
      issues.push({ message: '@core.records/portal.issue.target.no-portal', messageParams: { screen: targetKey } });
      return issues;
    }
    if (target.portal.subject === 'self') return issues;
    if (visited.has(target.id)) break;
    visited.add(target.id);
    const next = target.portal.subject;
    if (next === 'parent') targetKey = target.parentEntity;
    else targetKey = target.fields.find((one) => one.key === next.field)?.refEntity;
    if (!targetKey) {
      issues.push({ message: '@core.records/portal.issue.target.no-portal', messageParams: { screen: target.id } });
      return issues;
    }
  }
  issues.push({ message: '@core.records/portal.issue.too-deep' });
  return issues;
};

/**
 * O PERFIL que o convidado mantém neste escritório — `portalUsers/{uid}.profile`. Mora no convite, e
 * não na conta: cada escritório lê só o que o convidado informou a ELE, e o dado novo entra aqui sem
 * tocar na autenticação. O e-mail não está no perfil: é com ele que a pessoa entra.
 *
 * A lista é FECHADA, e as Security Rules a repetem (`profile.keys().hasOnly(...)`): o convidado grava o
 * próprio convite direto, sem callable, e só o que estiver aqui.
 */
export const PORTAL_PROFILE_FIELD = 'profile';
export const PORTAL_PROFILE_KEYS = ['name'] as const;
export const PORTAL_PROFILE_VALUE_MAX = 120;

export type PortalProfileKey = (typeof PORTAL_PROFILE_KEYS)[number];
export type PortalProfile = Partial<Record<PortalProfileKey, string>>;

/** Só as chaves conhecidas, com texto aparado e dentro do limite; o valor vazio sai. */
export const asPortalProfile = (value: unknown): PortalProfile => {
  if (!value || typeof value !== 'object') return {};
  const raw = value as Record<string, unknown>;
  const profile: PortalProfile = {};
  for (const key of PORTAL_PROFILE_KEYS) {
    const text = typeof raw[key] === 'string' ? raw[key].trim().slice(0, PORTAL_PROFILE_VALUE_MAX) : '';
    if (text) profile[key] = text;
  }
  return profile;
};

/** O nome do convidado: o que ele informou no perfil, senão o da conta com que entrou. */
export const portalGuestName = (profile: PortalProfile, accountName: string): string =>
  profile.name || accountName;
