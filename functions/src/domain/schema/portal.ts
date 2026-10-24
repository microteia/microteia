// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/portal.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

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
import { RECORD_CREATED_VIA_FIELD, SYSTEM_MANAGED_KEYS } from './mutationSpec';

export {
  PORTAL_DOCUMENTS_SUBCOLLECTION,
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
  }>;
  parentEntity?: string | null;
  parentFieldKey?: string | null;
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

  const rawEdit = raw.edit as Record<string, unknown> | null | undefined;
  const edit: PortalEditDeclaration | null = rawEdit && typeof rawEdit === 'object' && Array.isArray(rawEdit.fields)
    ? {
      fields: [...new Set(rawEdit.fields.filter(isNonEmptyString).map((key) => key.trim()))],
      ...(isNonEmptyString(rawEdit.when) ? { when: rawEdit.when.trim() } : {}),
      ...(rawEdit.onlyOwn === true ? { onlyOwn: true } : {}),
    }
    : null;

  return {
    subject,
    fields,
    ...(isNonEmptyString(raw.visibleWhen) ? { visibleWhen: raw.visibleWhen.trim() } : {}),
    documents: raw.documents === true,
    ...(create ? { create } : {}),
    ...(uploads ? { uploads } : {}),
    ...(edit ? { edit } : {}),
    ...(raw.notifyOffice === false ? { notifyOffice: false } : {}),
  };
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

/** Os campos que o convidado preenche ao criar — os declarados que existem, sem o vínculo. */
export const portalCreateFieldKeys = (screen: PortalScreenLike): string[] => {
  const declared = new Set(screen.fields.map((field) => field.key));
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
  const link = portalLinkOf(screen)?.fieldKey;
  return (screen.portal?.edit?.fields ?? []).filter((key) => exposed.has(key) && key !== link);
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

/** Os campos expostos que a tela de fato declara — a declaração que ficou para trás não vaza nada. */
export const portalFieldKeys = (screen: PortalScreenLike): string[] => {
  const declared = new Set(screen.fields.map((field) => field.key));
  return (screen.portal?.fields ?? []).filter((key) => declared.has(key));
};

/** Só os campos expostos. É a única porta por onde dado do registro sai para o portal. */
export const projectPortalData = (
  screen: PortalScreenLike,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const projected: Record<string, unknown> = {};
  for (const key of portalFieldKeys(screen)) {
    if (data[key] !== undefined) projected[key] = data[key];
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

/** O campo de título do registro, como texto. */
export const portalRecordTitle = (screen: PortalScreenLike, data: Record<string, unknown>): string => {
  const value = screen.titleFieldKey ? data[screen.titleFieldKey] : undefined;
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
};

/**
 * O título que a lista do PORTAL mostra — só quando o campo de título está entre os expostos. O
 * título é um campo como outro qualquer: mostrá-lo sem a tela ter escolhido seria a porta lateral por
 * onde sai o que a declaração não deixou sair.
 */
export const portalExposedTitle = (screen: PortalScreenLike, data: Record<string, unknown>): string =>
  screen.titleFieldKey && portalFieldKeys(screen).includes(screen.titleFieldKey)
    ? portalRecordTitle(screen, data)
    : '';

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
 * O que impede a declaração de entregar algo a alguém — conferido ANTES de gravar, para que o
 * escritório saiba na hora. O servidor, diante da mesma declaração, simplesmente não projeta nada: é
 * a resposta fechada, e calada. Aqui ela ganha voz.
 */
export const portalDeclarationIssues = (
  screen: PortalScreenLike,
  screens: readonly PortalScreenLike[],
): PortalDeclarationIssue[] => {
  const portal = screen.portal;
  if (!portal) return [];
  const issues: PortalDeclarationIssue[] = [];
  const declared = new Set(screen.fields.map((field) => field.key));

  if (portal.fields.length === 0) issues.push({ message: '@core.records/portal.issue.no-fields' });
  for (const key of portal.fields) {
    if (!declared.has(key)) issues.push({ message: '@core.records/portal.issue.field.unknown', messageParams: { field: key } });
  }

  issues.push(...portalVisibilityIssues(screen));

  if (portal.uploads && portal.documents !== true) {
    issues.push({ message: '@core.records/portal.issue.uploads.documents' });
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
        const hasDefault = field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '';
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
