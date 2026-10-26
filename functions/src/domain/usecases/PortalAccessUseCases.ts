import type {
  IPortalAccountService,
  IPortalInviteQuota,
  IPortalRepository,
  PortalFieldOption,
  PortalScreen,
} from '../repositories/IPortalRepository';
import { isLookupCollection } from '../schema/lookupRegistry';
import { RESERVED_COLLECTIONS } from '../schema/screenEntity';
import { failedPrecondition, invalidArgument, permissionDenied } from '../errors/DomainError';
import type { QualifiedContribution } from '../schema/plugin/contribution';
import {
  applyPortalPreference,
  DEFAULT_PORTAL_LAYOUT,
  isBuiltinPortalLayout,
  portalLayoutId,
  portalPageEntryId,
  portalScreenEntryId,
  portalWidgetEntryId,
  type PortalViewDescriptor,
} from '../schema/portalExtensionPoints';
import {
  acceptsAutomationInvites,
  buildPortalSubmission,
  normalizePortalEmail,
  PORTAL_AUTOMATION_INVITES_PER_HOUR,
  buildPortalEdit,
  canPortalUserEdit,
  evaluatePortalCondition,
  isPortalEditOpen,
  isPortalRecordVisible,
  portalCreateFieldKeys,
  portalEditFieldKeys,
  portalLinkOf,
  portalOwnerOf,
  portalUploadTypes,
  PORTAL_UPLOAD_MAX_BYTES,
  parsePortalSubjectKey,
  portalFieldKeys,
  portalRecordDocId,
  portalSubjectKey,
  portalTargetScreen,
} from '../schema/portal';
import { isValidPortalSubject } from './PortalProjectionUseCases';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * O convidado enxerga a projeção AGORA: está no `audience` dela E ainda tem, no convite, um dos
 * sujeitos dela. O `audience` é refeito por um gatilho, segundos depois de uma revogação — e para
 * sempre atrasado se o gatilho falhar —; o convite é lido aqui, e vale no instante.
 */
const guestSees = (
  guest: { userId: string; subjectKeys: string[] },
  projection: { audience: string[]; subjectKeys: string[] } | null | undefined,
): boolean =>
  !!projection
  && projection.audience.includes(guest.userId)
  && projection.subjectKeys.some((key) => guest.subjectKeys.includes(key));

/**
 * De onde veio o convite ou a revogação: a tela de Configurações › Portal, ou um passo de automação.
 * É a ÚNICA diferença entre os dois caminhos — o convite gravado é o mesmo —, e é por isso que a
 * automação tem as conferências a mais: a declaração da tela e o limite por hora.
 */
export type PortalAccessOrigin = 'settings' | 'automation';

/** Quem responde pelo gesto na Auditoria: a pessoa, ou o motor (`userName` é então uma referência). */
export interface PortalAccessActor {
  userId: string;
  userName: string;
}

/** Uma linha de Auditoria do acesso de alguém de fora — o rastro do que saiu do escritório, e de quando parou de sair. */
export interface PortalAccessAuditEntry {
  tenantId: string;
  change: 'granted' | 'revoked';
  email: string;
  /** O sujeito; `null` quando o convite inteiro foi revogado. */
  subjectKey: string | null;
  actor: PortalAccessActor;
  origin: PortalAccessOrigin;
  workflowId?: string;
}

export type PortalAccessAudit = (entry: PortalAccessAuditEntry) => Promise<void>;

export interface PortalAccessDeps {
  repo: IPortalRepository;
  accounts: IPortalAccountService;
  audit: PortalAccessAudit;
  quota: IPortalInviteQuota;
  now: () => Date;
}

export interface InvitePortalUserInput {
  tenantId: string;
  tenantName: string;
  email: string;
  subjectKey: string;
  actor: PortalAccessActor;
  /** Ausente, `settings`. */
  origin?: PortalAccessOrigin;
  workflowId?: string;
  /** O idioma em que quem convidou usa o produto. */
  locale?: string;
  /** O nome que o escritório lista enquanto o convidado não informa o dele; sem ele, o da conta, ou o e-mail. */
  displayName?: string;
}

export interface InvitePortalUserResult {
  userId: string;
  /** A conta de login nasceu agora. */
  created: boolean;
  /** O vínculo com o sujeito é NOVO — `false` é o convite que já existia. */
  granted: boolean;
}

export type InvitePortalUserUseCase = {
  execute: (input: InvitePortalUserInput) => Promise<InvitePortalUserResult>;
};

/** A auditoria é rastro, não condição: o acesso já foi dado (ou tirado), e isso não se desfaz. */
const auditQuietly = async (audit: PortalAccessAudit, entry: PortalAccessAuditEntry): Promise<void> => {
  try {
    await audit(entry);
  } catch {
    // Ver acima.
  }
};

/**
 * Vincula alguém de fora a um registro-sujeito — pela tela e pela automação, a MESMA porta.
 *
 * A ordem é o desenho inteiro. A conta, quando não existe, é criada AQUI — e criar a conta dispara o
 * bootstrap, que dá um escritório a todo usuário novo. Por isso a marca do convite é gravada ANTES:
 * é o que o bootstrap lê para saber que esta pessoa chegou pelo portal, e não para abrir um
 * escritório. Gravada depois, a marca perderia a corrida para o gatilho.
 *
 * A automação passa por duas portas a mais, ambas ANTES de qualquer escrita: a tela-sujeito tem de
 * declarar `portal.invites.automation` (decisão de exposição, de quem tem `portal.manage`), e o
 * convite novo consome uma vaga da hora (`PORTAL_AUTOMATION_INVITES_PER_HOUR`). O convite que já
 * existe volta sem escrever nada — nem conta, nem vaga, nem auditoria: rodar duas vezes é rodar uma.
 */
export const makeInvitePortalUserUseCase = (deps: PortalAccessDeps): InvitePortalUserUseCase => ({
  execute: async ({ tenantId, tenantName, email, subjectKey, actor, origin = 'settings', workflowId, locale, displayName }) => {
    const { repo, accounts } = deps;
    const normalized = normalizePortalEmail(email);
    if (!EMAIL_PATTERN.test(normalized)) throw invalidArgument('@core.tenant/portal.email.invalid');

    const screens = await repo.getScreens(tenantId);
    const subject = parsePortalSubjectKey(subjectKey);
    const screen = subject ? isValidPortalSubject(screens, subjectKey) : undefined;
    if (!subject || !screen) throw invalidArgument('@core.tenant/portal.subject.invalid');
    if (origin === 'automation' && !acceptsAutomationInvites(screen)) {
      throw permissionDenied('@core.tenant/portal.invite.automation-closed');
    }
    if (!(await repo.getRecord(tenantId, subject.collection, subject.recordId))) {
      throw invalidArgument('@core.tenant/portal.subject.invalid');
    }

    const key = portalSubjectKey(subject.collection, subject.recordId);
    let account = await accounts.findUserIdByEmail(normalized);
    if (origin === 'automation') {
      const holder = account ? await repo.getPortalUser(tenantId, account.userId) : null;
      if (account && holder?.subjectKeys.includes(key)) return { userId: account.userId, created: false, granted: false };
      if (!(await deps.quota.consume(tenantId, PORTAL_AUTOMATION_INVITES_PER_HOUR, deps.now()))) {
        throw failedPrecondition('@core.tenant/portal.invite.rate-limited');
      }
    }

    let created = false;
    if (!account) {
      await repo.markInvite(normalized, tenantId);
      account = { userId: await accounts.createAccount(normalized), displayName: null };
      created = true;
    }

    const granted = await repo.grantSubject(tenantId, {
      userId: account.userId,
      email: normalized,
      displayName: displayName?.trim() || account.displayName || normalized,
      tenantName,
      invitedBy: actor.userId,
      ...(locale ? { locale } : {}),
    }, key);

    if (granted) {
      await auditQuietly(deps.audit, {
        tenantId, change: 'granted', email: normalized, subjectKey: key, actor, origin, ...(workflowId ? { workflowId } : {}),
      });
    }
    return { userId: account.userId, created, granted };
  },
});

export interface RevokePortalUserInput {
  tenantId: string;
  /** O convidado, pelo uid (a tela, que o lista) ou pelo e-mail (a automação, que lê um registro). */
  guest: { userId: string } | { email: string };
  /**
   * O sujeito revogado. `null`, o convite inteiro. Com `allSubjects`, o convite inteiro TAMBÉM — mas
   * só se o convidado tiver este sujeito: a automação de um registro só alcança quem é dele.
   */
  subjectKey: string | null;
  allSubjects?: boolean;
  actor: PortalAccessActor;
  origin?: PortalAccessOrigin;
  workflowId?: string;
}

export type RevokePortalUserUseCase = {
  execute: (input: RevokePortalUserInput) => Promise<{ userId: string | null; revoked: boolean }>;
};

/**
 * Tira o acesso. Não pede a declaração `portal.invites`: recolher nunca expõe nada. Quem não é
 * convidado, ou não tinha aquele sujeito, volta `revoked: false` sem escrever — e sem dizer mais:
 * a automação não é um jeito de descobrir quem tem acesso a quê.
 */
export const makeRevokePortalUserUseCase = (deps: Pick<PortalAccessDeps, 'repo' | 'accounts' | 'audit'>): RevokePortalUserUseCase => ({
  execute: async ({ tenantId, guest, subjectKey, allSubjects = false, actor, origin = 'settings', workflowId }) => {
    const { repo } = deps;
    let userId: string;
    if ('userId' in guest) {
      userId = guest.userId;
    } else {
      const normalized = normalizePortalEmail(guest.email);
      if (!EMAIL_PATTERN.test(normalized)) throw invalidArgument('@core.tenant/portal.email.invalid');
      const account = await deps.accounts.findUserIdByEmail(normalized);
      if (!account) return { userId: null, revoked: false };
      userId = account.userId;
    }
    if (subjectKey !== null && !parsePortalSubjectKey(subjectKey)) throw invalidArgument('@core.tenant/portal.subject.invalid');

    const current = await repo.getPortalUser(tenantId, userId);
    if (!current) return { userId, revoked: false };
    if (allSubjects && subjectKey !== null && !current.subjectKeys.includes(subjectKey)) return { userId, revoked: false };

    const target = allSubjects ? null : subjectKey;
    const revoked = await repo.revokeSubject(tenantId, userId, target);
    if (revoked) {
      await auditQuietly(deps.audit, {
        tenantId, change: 'revoked', email: current.email, subjectKey: target, actor, origin, ...(workflowId ? { workflowId } : {}),
      });
    }
    return { userId, revoked };
  },
});

export type GetPortalDocumentUrlUseCase = {
  execute: (input: { tenantId: string; userId: string; projectionId: string; documentId: string }) => Promise<string>;
};

/**
 * A URL de um documento compartilhado, entregue só depois de conferir as três coisas que a regra
 * do portal confere: a pessoa é convidada, o registro está no `audience` dela, e o documento está
 * marcado como compartilhado. A URL nunca é gravada na projeção — ela é a chave do arquivo, e só sai
 * daqui para quem passou pelas três.
 *
 * Toda recusa é a mesma: dizer qual das três faltou ajudaria a descobrir o que existe no escritório.
 */
export const makeGetPortalDocumentUrlUseCase = (repo: IPortalRepository): GetPortalDocumentUrlUseCase => ({
  execute: async ({ tenantId, userId, projectionId, documentId }) => {
    const denied = permissionDenied('@core.tenant/portal.document.unavailable');
    const guest = await repo.getPortalUser(tenantId, userId);
    if (!guest) throw denied;

    const projection = await repo.getProjection(tenantId, projectionId);
    if (!projection || !guestSees(guest, projection)) throw denied;
    if (portalRecordDocId(projection.collection, projection.recordId) !== projectionId) throw denied;

    const screens = await repo.getScreens(tenantId);
    const screen = screens.find((one) => one.collection === projection.collection && one.portal);
    if (screen?.portal?.documents !== true) throw denied;

    const document = await repo.getRecordDocument(tenantId, projection.collection, projection.recordId, documentId);
    if (!document || !document.portalShared || !document.url) throw denied;
    return document.url;
  },
});

export interface PortalContextScreen {
  id: string;
  /** O convidado anexa documentos aqui — escolhendo o tipo entre estes, nunca criando um. */
  uploads: { types: Array<{ key: string; label: string }> } | null;
  /** A tela-PAI no portal — a do registro a que os desta apontam. Os desta aparecem dentro dele. */
  parent: { collection: string } | null;
  /** O que o convidado preenche ao criar, e a que tipo de registro o novo se vincula. */
  create: {
    fields: Array<{ key: string; label: string; type?: string; required: boolean; options?: PortalFieldOption[] }>;
    link: { collection: string; label: string };
  } | null;
  /** O que o convidado altera, e se só no que ele mesmo criou. */
  edit: {
    fields: Array<{ key: string; label: string; type?: string; required: boolean; options?: PortalFieldOption[] }>;
    onlyOwn: boolean;
  } | null;
  collection: string;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  documents: boolean;
  fields: PortalScreen['fields'];
}

/** Uma view de portal de extensão, entregue ao convidado. */
export type PortalContextView = PortalViewDescriptor;

/** Uma entrada do MENU do portal: uma tela de topo, ou uma página de extensão. */
export interface PortalMenuEntry {
  id: string;
  kind: 'screen' | 'page';
  title: string;
  icon: string;
  /** `screen`: a coleção da tela. */
  collection?: string;
  /** `page`: a view que desenha a página. */
  pluginId?: string;
  viewKey?: string;
}

/** Um cartão da home. */
export interface PortalWidgetEntry {
  id: string;
  title: string;
  pluginId: string;
  viewKey: string;
}

export interface PortalHome {
  /** As boas-vindas que o escritório escreveu — vazio = a frase padrão do produto. */
  welcome: string;
  /** O menu, já na ordem do escritório e sem o que ele escondeu. */
  menu: PortalMenuEntry[];
  widgets: PortalWidgetEntry[];
  /** A home inteira de uma extensão, quando há uma. */
  view: { pluginId: string; viewKey: string } | null;
  /**
   * A casca: um layout do kernel (`sidebar`, `top`) ou o de uma extensão (`pluginId` + `viewKey`).
   * Escolha do escritório; o de uma extensão que saiu, ou cujo código deixou de ser confiável, volta
   * ao padrão.
   */
  layout: { id: string; pluginId?: string; viewKey?: string };
}

export interface PortalContext {
  /** O idioma ESCOLHIDO para este convidado (dele ou do escritório); vazio quando ninguém escolheu. */
  locale: string;
  /** O fuso em que o portal diz que dia é — o mesmo que o escritório e as automações usam. */
  timeZone?: string;
  tenantName: string;
  logoURL: string | null;
  screens: PortalContextScreen[];
  /** As views das extensões para ESTE portal — de coleção, só as de coleção exposta. */
  views: PortalContextView[];
  /** Os textos dessas extensões, em todos os idiomas que elas trazem. */
  bundles: Array<{ locale: string; namespace: string; messages: Record<string, string> }>;
  /** Os temas das extensões ligadas — o convidado não lê as extensões instaladas. */
  themes: QualifiedContribution[];
  home: PortalHome;
}

export type GetPortalContextUseCase = {
  execute: (input: {
    tenantId: string;
    userId: string;
    tenant: { name: string; logoURL: string | null };
    locale: string;
    timeZone?: string;
    resolve: (value: string) => string;
    extensionViews?: { views: PortalContextView[]; bundles: PortalContext['bundles'] };
    themes?: QualifiedContribution[];
    /** Os tipos de documento do escritório — os fixos mais os cadastrados, já com rótulo. */
    documentTypes?: Array<{ key: string; label: string }>;
  }) => Promise<PortalContext>;
};

type PortalField = PortalScreen['fields'][number];

/**
 * Uma lista só sai se for LISTA: a do kernel, ou uma coleção que nenhuma tela usa como registro e que
 * não é do sistema. Sem isso, um `lookupCollection` apontado (por engano ou não) para a coleção de uma
 * tela entregaria ao convidado o rótulo de registros que o portal não expõe.
 */
const isPortalLookupList = (collection: string, screens: PortalScreen[]): boolean =>
  isLookupCollection(collection)
  || (!RESERVED_COLLECTIONS.has(collection)
    && !screens.some((screen) => screen.id === collection || screen.collection === collection));

/**
 * As opções das listas que os campos EXPOSTOS usam — os que o convidado vê, cria ou altera —, e só
 * delas. O convidado não lê lista nenhuma: o servidor as lê com o acesso do escritório, pela mesma
 * mescla do front (as do kernel primeiro, depois as cadastradas). A lista que falha ao ser lida fica só
 * com as do kernel, como no escritório: o portal não deixa de abrir por uma lista.
 */
const portalLookupOptions = async (
  repo: IPortalRepository,
  tenantId: string,
  allScreens: PortalScreen[],
  portalScreens: PortalScreen[],
): Promise<Map<string, PortalFieldOption[]>> => {
  const collections = new Set<string>();
  for (const screen of portalScreens) {
    const shown = new Set([...portalFieldKeys(screen), ...portalCreateFieldKeys(screen), ...portalEditFieldKeys(screen)]);
    for (const field of screen.fields) {
      if (shown.has(field.key) && field.lookupCollection && isPortalLookupList(field.lookupCollection, allScreens)) {
        collections.add(field.lookupCollection);
      }
    }
  }
  const entries = await Promise.all([...collections].map(async (collection) => {
    const office: PortalFieldOption[] = await repo.getLookupOptions(tenantId, collection).catch(() => []);
    return [collection, office] as const;
  }));
  return new Map(entries);
};

/**
 * O que a casca do portal precisa saber para desenhar — e só isso. O convidado não lê
 * `screenDefinitions` nem as configurações: recebe daqui as telas que o portal expõe, cada uma só com
 * os campos expostos, o menu e a home já na ordem do escritório, e os rótulos já no idioma dele.
 */
/** A ordem sugerida só serve para ordenar; ao convidado vai a lista já na ordem. */
const withoutOrder = <T extends { order?: number }>(value: T): Omit<T, 'order'> => {
  const copy = { ...value };
  delete copy.order;
  return copy;
};

export const makeGetPortalContextUseCase = (repo: IPortalRepository): GetPortalContextUseCase => ({
  execute: async ({ tenantId, userId, tenant, locale, timeZone, resolve, extensionViews, themes = [], documentTypes = [] }) => {
    if (!(await repo.getPortalUser(tenantId, userId))) {
      throw permissionDenied('@core.tenant/portal.not-invited');
    }
    const [allScreens, settings] = await Promise.all([repo.getScreens(tenantId), repo.getHomeSettings(tenantId)]);
    const screens = allScreens.filter((screen) => !!screen.portal);
    const lookups = await portalLookupOptions(repo, tenantId, allScreens, screens);
    // As declaradas no campo primeiro (cor só em lista colorida), depois as da lista — a mesma ordem
    // do formulário do escritório. A chave repetida fica com a primeira.
    const optionsOf = (field: PortalField): { options?: PortalFieldOption[] } => {
      const declared = (field.options ?? []).map((option) => ({
        key: option.key,
        label: option.label,
        ...(field.optionsColored && option.color ? { color: option.color } : {}),
      }));
      const listed = field.lookupCollection ? lookups.get(field.lookupCollection) ?? [] : [];
      if (declared.length === 0 && listed.length === 0) return {};
      const declaredKeys = new Set(declared.map((option) => option.key));
      const options = [...declared, ...listed.filter((option) => !declaredKeys.has(option.key))]
        .map((option) => ({ ...option, label: resolve(option.label) }));
      return { options };
    };
    const exposed = new Set(screens.map((screen) => screen.collection));
    const views = (extensionViews?.views ?? [])
      .filter((view) => !view.collection || exposed.has(view.collection));

    const screenFor = (entity: string) => portalTargetScreen(screens, entity);
    // Raiz é a tela sem pai NO PORTAL: a nota de um prestador exposto aparece dentro dele, não no menu.
    const roots = screens.filter((screen) => {
      const link = portalLinkOf(screen);
      return !link || !screenFor(link.targetEntity);
    });
    const menu = applyPortalPreference<PortalMenuEntry & { order?: number }>([
      // As telas vêm antes por padrão — são o portal; as páginas de extensão o completam.
      ...roots.map((screen, index) => ({
        order: index - roots.length,
        id: portalScreenEntryId(screen.collection),
        kind: 'screen' as const,
        title: resolve(screen.titlePlural),
        icon: screen.icon,
        collection: screen.collection,
      })),
      ...views.filter((view) => view.surface === 'page' && view.key).map((view) => ({
        id: portalPageEntryId(view.pluginId, view.key as string),
        kind: 'page' as const,
        title: view.title ? resolve(view.title) : view.key as string,
        icon: view.icon ?? 'apps',
        pluginId: view.pluginId,
        viewKey: view.viewKey,
        order: view.order,
      })),
    ], settings.menu).map(withoutOrder);
    const widgets = applyPortalPreference(
      views.filter((view) => view.surface === 'widget' && view.key).map((view) => ({
        id: portalWidgetEntryId(view.pluginId, view.key as string),
        title: view.title ? resolve(view.title) : '',
        pluginId: view.pluginId,
        viewKey: view.viewKey,
        order: view.order,
      })),
      settings.widgets,
    ).map(withoutOrder);
    const homeView = views.find((view) => view.surface === 'home');
    const layoutView = views.find((view) =>
      view.surface === 'layout' && view.key && portalLayoutId(view.pluginId, view.key) === settings.layout);
    const layout = layoutView
      ? { id: settings.layout, pluginId: layoutView.pluginId, viewKey: layoutView.viewKey }
      : { id: isBuiltinPortalLayout(settings.layout) ? settings.layout : DEFAULT_PORTAL_LAYOUT };

    return {
      views,
      bundles: views.length > 0 ? extensionViews?.bundles ?? [] : [],
      themes,
      home: {
        welcome: settings.welcome,
        menu,
        widgets,
        view: homeView ? { pluginId: homeView.pluginId, viewKey: homeView.viewKey } : null,
        layout,
      },
      locale,
      ...(timeZone ? { timeZone } : {}),
      tenantName: tenant.name,
      logoURL: tenant.logoURL,
      screens: screens.map((screen) => {
        const exposed = new Set(portalFieldKeys(screen));
        const fillable = new Set(portalCreateFieldKeys(screen));
        const editable = new Set(portalEditFieldKeys(screen));
        const link = portalLinkOf(screen);
        const linkTarget = link ? screenFor(link.targetEntity) : undefined;
        const describe = (field: PortalField) => ({
          key: field.key,
          label: resolve(field.label),
          type: field.type,
          required: field.required === true,
          ...optionsOf(field),
        });
        return {
          id: screen.id,
          uploads: screen.portal?.uploads && screen.portal.documents === true
            ? { types: portalUploadTypes(screen, documentTypes) }
            : null,
          parent: linkTarget?.portal ? { collection: linkTarget.collection } : null,
          collection: screen.collection,
          titleSingular: resolve(screen.titleSingular),
          titlePlural: resolve(screen.titlePlural),
          icon: screen.icon,
          documents: screen.portal?.documents === true,
          fields: screen.fields
            .filter((field) => exposed.has(field.key))
            .map((field) => ({
              key: field.key,
              label: resolve(field.label),
              type: field.type,
              ...optionsOf(field),
            })),
          create: fillable.size > 0 && linkTarget
            ? {
              fields: screen.fields.filter((field) => fillable.has(field.key)).map(describe),
              link: { collection: linkTarget.collection, label: resolve(linkTarget.titleSingular) },
            }
            : null,
          edit: editable.size > 0
            ? {
              fields: screen.fields.filter((field) => editable.has(field.key)).map(describe),
              onlyOwn: screen.portal?.edit?.onlyOwn === true,
            }
            : null,
        };
      }),
    };
  },
});

/**
 * A recusa da VALIDAÇÃO — campo obrigatório, formato, chave repetida —, com os parâmetros que a frase
 * interpola. É a única recusa que o convidado precisa ler em detalhe: as outras são de acesso, e
 * dizem todas a mesma coisa.
 */
export class PortalSubmissionInvalid extends Error {
  constructor(message: string, readonly params: Record<string, string> = {}) {
    super(message);
    this.name = 'PortalSubmissionInvalid';
  }
}

/** A gravação em si — o motor de registros do backend, com validação, chaves e autoria `portal`. */
export type PortalRecordWriter = (input: {
  tenantId: string;
  collection: string;
  data: Record<string, unknown>;
  userId: string;
  /** Presente, ALTERA este registro em vez de criar um. */
  recordId?: string;
}) => Promise<{ ok: true; id: string } | { ok: false; error: string; errorParams?: Record<string, string> }>;

/** O que o convidado fez, contado ao escritório. Quem decide quem recebe é o notificador. */
export type PortalActivityKind = 'created' | 'updated' | 'attached';

export type PortalActivityNotifier = (activity: {
  tenantId: string;
  userId: string;
  kind: PortalActivityKind;
  screen: PortalScreen;
  recordId: string;
  /** Repetir o mesmo fato não avisa duas vezes — um anexo é um aviso, por mais que o pedido se repita. */
  dedupKey?: string;
}) => Promise<void>;

/** Avisar nunca desfaz o que o convidado fez: a falha fica no log, e a resposta segue. */
const tellOffice = async (notify: PortalActivityNotifier | undefined, activity: Parameters<PortalActivityNotifier>[0]) => {
  if (!notify) return;
  try {
    await notify(activity);
  } catch {
    // O aviso é consequência, não condição.
  }
};

export interface SubmitPortalRecordInput {
  tenantId: string;
  userId: string;
  collection: string;
  /** O registro a que o novo pertence — a empresa, ou a nota de um item. */
  linkRecordId: string;
  data: Record<string, unknown>;
}

export type SubmitPortalRecordUseCase = {
  execute: (input: SubmitPortalRecordInput) => Promise<{ id: string }>;
};

/**
 * O convidado CRIA um registro — sempre para algo que já é dele.
 *
 * O vínculo é a única coisa que importa aqui, e ele NUNCA vem do cliente: o convidado aponta o
 * registro a que o novo pertence, e só passa se ele o enxerga — é sujeito do convite dele, ou uma
 * projeção em que ele está no `audience`. O campo de vínculo é então carimbado pelo servidor, e o que
 * mais vier no pedido fora dos campos preenchíveis é descartado.
 *
 * Toda recusa de acesso é a mesma frase, pelo motivo de sempre: dizer qual condição faltou ajudaria a
 * descobrir o que existe no escritório.
 */
export const makeSubmitPortalRecordUseCase = (
  repo: IPortalRepository,
  write: PortalRecordWriter,
  notify?: PortalActivityNotifier,
): SubmitPortalRecordUseCase => ({
  execute: async ({ tenantId, userId, collection, linkRecordId, data }) => {
    const denied = permissionDenied('@core.tenant/portal.create.denied');
    const guest = await repo.getPortalUser(tenantId, userId);
    if (!guest) throw denied;

    const screens = await repo.getScreens(tenantId);
    const screen = screens.find((one) => one.collection === collection && one.portal?.create);
    const link = screen ? portalLinkOf(screen) : null;
    if (!screen || !link || portalCreateFieldKeys(screen).length === 0) throw denied;

    const target = portalTargetScreen(screens, link.targetEntity);
    if (!target?.portal || !linkRecordId) throw denied;

    const visible = target.portal.subject === 'self'
      ? guest.subjectKeys.includes(portalSubjectKey(target.collection, linkRecordId))
      : guestSees(guest, await repo.getProjection(tenantId, portalRecordDocId(target.collection, linkRecordId)));
    if (!visible) throw denied;

    const submission = buildPortalSubmission(screen, data, linkRecordId);
    if (!submission) throw denied;

    const outcome = await write({ tenantId, collection, data: submission, userId });
    if (!outcome.ok) throw new PortalSubmissionInvalid(outcome.error, outcome.errorParams);
    await tellOffice(notify, {
      tenantId, userId, kind: 'created', screen, recordId: outcome.id, dedupKey: `portal:created:${collection}:${outcome.id}`,
    });
    return { id: outcome.id };
  },
});

export interface UpdatePortalRecordInput {
  tenantId: string;
  userId: string;
  collection: string;
  recordId: string;
  data: Record<string, unknown>;
  /** O fuso do escritório — o `today()` da condição responde nele. */
  timeZone?: string;
}

export type UpdatePortalRecordUseCase = {
  execute: (input: UpdatePortalRecordInput) => Promise<{ id: string }>;
};

/**
 * O convidado ALTERA um registro que é dele.
 *
 * Tudo é conferido de novo, sobre o registro como está AGORA — a projeção que desenhou o botão pode
 * ter ficado para trás: ele enxerga o registro, e o registro ainda passa no `visibleWhen`; a tela
 * deixa alterar; a condição do escritório vale
 * para o registro inteiro, inclusive o que o convidado não vê; e, se a tela pede, foi ele quem o
 * criou. Do que ele manda, só os campos editáveis passam — o vínculo nunca está entre eles, e é isso
 * que impede passar o registro para outra empresa.
 */
export const makeUpdatePortalRecordUseCase = (
  repo: IPortalRepository,
  write: PortalRecordWriter,
  notify?: PortalActivityNotifier,
): UpdatePortalRecordUseCase => ({
  execute: async ({ tenantId, userId, collection, recordId, data, timeZone }) => {
    const denied = permissionDenied('@core.tenant/portal.edit.denied');
    const guest = await repo.getPortalUser(tenantId, userId);
    if (!guest) throw denied;

    const projection = await repo.getProjection(tenantId, portalRecordDocId(collection, recordId));
    if (!guestSees(guest, projection)) throw denied;

    const screens = await repo.getScreens(tenantId);
    const screen = screens.find((one) => one.collection === collection && one.portal);
    if (!screen?.portal?.edit) throw denied;

    const record = await repo.getRecord(tenantId, collection, recordId);
    if (!record) throw denied;
    const evaluate = (expression: string, values: Record<string, unknown>) => evaluatePortalCondition(expression, values, timeZone);
    const open = isPortalRecordVisible(screen, record, evaluate) && isPortalEditOpen(screen, record, evaluate);
    if (!open || !canPortalUserEdit(screen, userId, { editable: open, portalOwner: portalOwnerOf(record) })) {
      throw denied;
    }

    const changes = buildPortalEdit(screen, data);
    if (Object.keys(changes).length === 0) return { id: recordId };

    const outcome = await write({ tenantId, collection, data: changes, userId, recordId });
    if (!outcome.ok) throw new PortalSubmissionInvalid(outcome.error, outcome.errorParams);
    await tellOffice(notify, { tenantId, userId, kind: 'updated', screen, recordId });
    return { id: outcome.id };
  },
});

export interface AttachPortalDocumentInput {
  tenantId: string;
  userId: string;
  userName: string;
  collection: string;
  recordId: string;
  /** O id do arquivo na área de espera do convidado. */
  uploadId: string;
  name: string;
  type: string;
}

export interface AttachPortalDocumentDeps {
  documentTypes: (tenantId: string) => Promise<Array<{ key: string; label: string }>>;
  attach: (file: {
    tenantId: string;
    collection: string;
    recordId: string;
    name: string;
    contentType: string;
    data: Buffer;
    type: string;
    userId: string;
    userName: string;
  }) => Promise<{ id: string }>;
}

export type AttachPortalDocumentUseCase = {
  execute: (input: AttachPortalDocumentInput) => Promise<{ id: string }>;
};

/**
 * O convidado ANEXA um documento a um registro que é dele.
 *
 * Tudo é conferido antes de o arquivo sair da área de espera, e na ordem em que o escritório o diria:
 * é convidado; o registro está no portal dele; a tela deixa anexar; o tipo é um dos que a tela
 * oferece, entre os que o escritório tem — escolher, nunca criar —; e o arquivo cabe. Só então ele vai
 * para o registro, já compartilhado (o que o convidado envia ele vê), e a espera é limpa.
 *
 * Não há o caminho inverso: excluir um documento não existe para o convidado, em caso nenhum.
 */
export const makeAttachPortalDocumentUseCase = (
  repo: IPortalRepository,
  deps: AttachPortalDocumentDeps,
  notify?: PortalActivityNotifier,
): AttachPortalDocumentUseCase => ({
  execute: async ({ tenantId, userId, userName, collection, recordId, uploadId, name, type }) => {
    const denied = permissionDenied('@core.tenant/portal.upload.denied');
    // A espera é limpa em TODO desfecho, inclusive nas recusas: um arquivo recusado que ficasse lá
    // seria espaço do escritório ocupado para sempre, por quem quisesse repetir a recusa.
    try {
      const guest = await repo.getPortalUser(tenantId, userId);
      if (!guest) throw denied;

      const projection = await repo.getProjection(tenantId, portalRecordDocId(collection, recordId));
      if (!guestSees(guest, projection)) throw denied;

      const screens = await repo.getScreens(tenantId);
      const screen = screens.find((one) => one.collection === collection && one.portal);
      if (!screen?.portal?.uploads || screen.portal.documents !== true) throw denied;

      const allowed = portalUploadTypes(screen, await deps.documentTypes(tenantId));
      if (!allowed.some((option) => option.key === type)) throw invalidArgument('@core.tenant/portal.upload.type-invalid');

      const file = await repo.readStagedUpload(tenantId, userId, uploadId);
      if (!file) throw invalidArgument('@core.tenant/portal.upload.missing');
      if (file.data.length > PORTAL_UPLOAD_MAX_BYTES) throw invalidArgument('@core.tenant/portal.upload.too-large');
      const cleanName = name.trim().slice(0, 200) || uploadId;
      const attached = await deps.attach({
        tenantId, collection, recordId, name: cleanName, contentType: file.contentType, data: file.data, type, userId, userName,
      });
      await tellOffice(notify, {
        tenantId, userId, kind: 'attached', screen, recordId, dedupKey: `portal:attached:${collection}:${recordId}:${attached.id}`,
      });
      return attached;
    } finally {
      await repo.deleteStagedUpload(tenantId, userId, uploadId);
    }
  },
});
