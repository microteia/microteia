import type {
  IPortalAccountService,
  IPortalRepository,
  PortalScreen,
} from '../repositories/IPortalRepository';
import { invalidArgument, permissionDenied } from '../errors/DomainError';
import {
  applyPortalPreference,
  portalPageEntryId,
  portalScreenEntryId,
  portalWidgetEntryId,
  type PortalViewDescriptor,
} from '../schema/portalExtensionPoints';
import {
  buildPortalSubmission,
  normalizePortalEmail,
  buildPortalEdit,
  canPortalUserEdit,
  evaluatePortalCondition,
  isPortalEditOpen,
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
} from '../schema/portal';
import { isValidPortalSubject } from './PortalProjectionUseCases';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InvitePortalUserInput {
  tenantId: string;
  tenantName: string;
  email: string;
  subjectKey: string;
  invitedBy: string;
  /** O idioma em que quem convidou usa o produto. */
  locale?: string;
}

export type InvitePortalUserUseCase = {
  execute: (input: InvitePortalUserInput) => Promise<{ userId: string; created: boolean }>;
};

/**
 * Vincula alguém de fora a um registro-sujeito.
 *
 * A ordem é o desenho inteiro. A conta, quando não existe, é criada AQUI — e criar a conta dispara o
 * bootstrap, que dá um escritório a todo usuário novo. Por isso a marca do convite é gravada ANTES:
 * é o que o bootstrap lê para saber que esta pessoa chegou pelo portal, e não para abrir um
 * escritório. Gravada depois, a marca perderia a corrida para o gatilho.
 */
export const makeInvitePortalUserUseCase = (
  repo: IPortalRepository,
  accounts: IPortalAccountService,
): InvitePortalUserUseCase => ({
  execute: async ({ tenantId, tenantName, email, subjectKey, invitedBy, locale }) => {
    const normalized = normalizePortalEmail(email);
    if (!EMAIL_PATTERN.test(normalized)) throw invalidArgument('@core.tenant/portal.email.invalid');

    const screens = await repo.getScreens(tenantId);
    const subject = parsePortalSubjectKey(subjectKey);
    if (!subject || !isValidPortalSubject(screens, subjectKey)) {
      throw invalidArgument('@core.tenant/portal.subject.invalid');
    }
    if (!(await repo.getRecord(tenantId, subject.collection, subject.recordId))) {
      throw invalidArgument('@core.tenant/portal.subject.invalid');
    }

    let account = await accounts.findUserIdByEmail(normalized);
    let created = false;
    if (!account) {
      await repo.markInvite(normalized, tenantId);
      account = { userId: await accounts.createAccount(normalized), displayName: null };
      created = true;
    }

    await repo.grantSubject(tenantId, {
      userId: account.userId,
      email: normalized,
      displayName: account.displayName ?? normalized,
      tenantName,
      invitedBy,
      ...(locale ? { locale } : {}),
    }, portalSubjectKey(subject.collection, subject.recordId));

    return { userId: account.userId, created };
  },
});

export type RevokePortalUserUseCase = {
  execute: (tenantId: string, userId: string, subjectKey: string | null) => Promise<void>;
};

/** Sem `subjectKey`, revoga o convite inteiro; com ele, só aquele vínculo. */
export const makeRevokePortalUserUseCase = (repo: IPortalRepository): RevokePortalUserUseCase => ({
  execute: (tenantId, userId, subjectKey) => repo.revokeSubject(tenantId, userId, subjectKey),
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
    if (!(await repo.getPortalUser(tenantId, userId))) throw denied;

    const projection = await repo.getProjection(tenantId, projectionId);
    if (!projection || !projection.audience.includes(userId)) throw denied;
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
    fields: Array<{ key: string; label: string; type?: string; required: boolean; options?: Array<{ key: string; label: string }> }>;
    link: { collection: string; label: string };
  } | null;
  /** O que o convidado altera, e se só no que ele mesmo criou. */
  edit: {
    fields: Array<{ key: string; label: string; type?: string; required: boolean; options?: Array<{ key: string; label: string }> }>;
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
}

export interface PortalContext {
  /** O idioma ESCOLHIDO para este convidado (dele ou do escritório); vazio quando ninguém escolheu. */
  locale: string;
  tenantName: string;
  logoURL: string | null;
  screens: PortalContextScreen[];
  /** As views das extensões para ESTE portal — de coleção, só as de coleção exposta. */
  views: PortalContextView[];
  /** Os textos dessas extensões, em todos os idiomas que elas trazem. */
  bundles: Array<{ locale: string; namespace: string; messages: Record<string, string> }>;
  home: PortalHome;
}

export type GetPortalContextUseCase = {
  execute: (input: {
    tenantId: string;
    userId: string;
    tenant: { name: string; logoURL: string | null };
    locale: string;
    resolve: (value: string) => string;
    extensionViews?: { views: PortalContextView[]; bundles: PortalContext['bundles'] };
    /** Os tipos de documento do escritório — os fixos mais os cadastrados, já com rótulo. */
    documentTypes?: Array<{ key: string; label: string }>;
  }) => Promise<PortalContext>;
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
  execute: async ({ tenantId, userId, tenant, locale, resolve, extensionViews, documentTypes = [] }) => {
    if (!(await repo.getPortalUser(tenantId, userId))) {
      throw permissionDenied('@core.tenant/portal.not-invited');
    }
    const [allScreens, settings] = await Promise.all([repo.getScreens(tenantId), repo.getHomeSettings(tenantId)]);
    const screens = allScreens.filter((screen) => !!screen.portal);
    const exposed = new Set(screens.map((screen) => screen.collection));
    const views = (extensionViews?.views ?? [])
      .filter((view) => !view.collection || exposed.has(view.collection));

    const screenFor = (entity: string) =>
      screens.find((one) => one.id === entity) ?? screens.find((one) => one.collection === entity);
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

    return {
      views,
      bundles: views.length > 0 ? extensionViews?.bundles ?? [] : [],
      home: {
        welcome: settings.welcome,
        menu,
        widgets,
        view: homeView ? { pluginId: homeView.pluginId, viewKey: homeView.viewKey } : null,
      },
      locale,
      tenantName: tenant.name,
      logoURL: tenant.logoURL,
      screens: screens.map((screen) => {
        const exposed = new Set(portalFieldKeys(screen));
        const fillable = new Set(portalCreateFieldKeys(screen));
        const editable = new Set(portalEditFieldKeys(screen));
        const link = portalLinkOf(screen);
        const linkTarget = link
          ? screens.find((one) => one.id === link.targetEntity) ?? screens.find((one) => one.collection === link.targetEntity)
          : undefined;
        const describe = (field: PortalScreen['fields'][number]) => ({
          key: field.key,
          label: resolve(field.label),
          type: field.type,
          required: field.required === true,
          ...(field.options ? { options: field.options.map((option) => ({ key: option.key, label: resolve(option.label) })) } : {}),
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
              ...(field.options ? { options: field.options.map((option) => ({ key: option.key, label: resolve(option.label) })) } : {}),
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
): SubmitPortalRecordUseCase => ({
  execute: async ({ tenantId, userId, collection, linkRecordId, data }) => {
    const denied = permissionDenied('@core.tenant/portal.create.denied');
    const guest = await repo.getPortalUser(tenantId, userId);
    if (!guest) throw denied;

    const screens = await repo.getScreens(tenantId);
    const screen = screens.find((one) => one.collection === collection && one.portal?.create);
    const link = screen ? portalLinkOf(screen) : null;
    if (!screen || !link || portalCreateFieldKeys(screen).length === 0) throw denied;

    const target = screens.find((one) => one.id === link.targetEntity)
      ?? screens.find((one) => one.collection === link.targetEntity);
    if (!target?.portal || !linkRecordId) throw denied;

    const visible = target.portal.subject === 'self'
      ? guest.subjectKeys.includes(portalSubjectKey(target.collection, linkRecordId))
      : (await repo.getProjection(tenantId, portalRecordDocId(target.collection, linkRecordId)))
        ?.audience.includes(userId) === true;
    if (!visible) throw denied;

    const submission = buildPortalSubmission(screen, data, linkRecordId);
    if (!submission) throw denied;

    const outcome = await write({ tenantId, collection, data: submission, userId });
    if (!outcome.ok) throw new PortalSubmissionInvalid(outcome.error, outcome.errorParams);
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
 * ter ficado para trás: ele enxerga o registro; a tela deixa alterar; a condição do escritório vale
 * para o registro inteiro, inclusive o que o convidado não vê; e, se a tela pede, foi ele quem o
 * criou. Do que ele manda, só os campos editáveis passam — o vínculo nunca está entre eles, e é isso
 * que impede passar o registro para outra empresa.
 */
export const makeUpdatePortalRecordUseCase = (
  repo: IPortalRepository,
  write: PortalRecordWriter,
): UpdatePortalRecordUseCase => ({
  execute: async ({ tenantId, userId, collection, recordId, data, timeZone }) => {
    const denied = permissionDenied('@core.tenant/portal.edit.denied');
    if (!(await repo.getPortalUser(tenantId, userId))) throw denied;

    const projection = await repo.getProjection(tenantId, portalRecordDocId(collection, recordId));
    if (!projection || !projection.audience.includes(userId)) throw denied;

    const screens = await repo.getScreens(tenantId);
    const screen = screens.find((one) => one.collection === collection && one.portal);
    if (!screen?.portal?.edit) throw denied;

    const record = await repo.getRecord(tenantId, collection, recordId);
    if (!record) throw denied;
    const open = isPortalEditOpen(screen, record, (expression, values) => evaluatePortalCondition(expression, values, timeZone));
    if (!open || !canPortalUserEdit(screen, userId, { editable: open, portalOwner: portalOwnerOf(record) })) {
      throw denied;
    }

    const changes = buildPortalEdit(screen, data);
    if (Object.keys(changes).length === 0) return { id: recordId };

    const outcome = await write({ tenantId, collection, data: changes, userId, recordId });
    if (!outcome.ok) throw new PortalSubmissionInvalid(outcome.error, outcome.errorParams);
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
): AttachPortalDocumentUseCase => ({
  execute: async ({ tenantId, userId, userName, collection, recordId, uploadId, name, type }) => {
    const denied = permissionDenied('@core.tenant/portal.upload.denied');
    if (!(await repo.getPortalUser(tenantId, userId))) throw denied;

    const projection = await repo.getProjection(tenantId, portalRecordDocId(collection, recordId));
    if (!projection || !projection.audience.includes(userId)) throw denied;

    const screens = await repo.getScreens(tenantId);
    const screen = screens.find((one) => one.collection === collection && one.portal);
    if (!screen?.portal?.uploads || screen.portal.documents !== true) throw denied;

    const allowed = portalUploadTypes(screen, await deps.documentTypes(tenantId));
    if (!allowed.some((option) => option.key === type)) throw invalidArgument('@core.tenant/portal.upload.type-invalid');

    const file = await repo.readStagedUpload(tenantId, userId, uploadId);
    if (!file) throw invalidArgument('@core.tenant/portal.upload.missing');
    try {
      if (file.data.length > PORTAL_UPLOAD_MAX_BYTES) throw invalidArgument('@core.tenant/portal.upload.too-large');
      const cleanName = name.trim().slice(0, 200) || uploadId;
      return await deps.attach({
        tenantId, collection, recordId, name: cleanName, contentType: file.contentType, data: file.data, type, userId, userName,
      });
    } finally {
      await repo.deleteStagedUpload(tenantId, userId, uploadId);
    }
  },
});
