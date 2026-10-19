import type {
  IPortalAccountService,
  IPortalRepository,
  PortalScreen,
} from '../repositories/IPortalRepository';
import { invalidArgument, permissionDenied } from '../errors/DomainError';
import {
  buildPortalSubmission,
  normalizePortalEmail,
  portalCreateFieldKeys,
  portalLinkOf,
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
  execute: async ({ tenantId, tenantName, email, subjectKey, invitedBy }) => {
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
  /** O que o convidado preenche ao criar, e a que tipo de registro o novo se vincula. */
  create: {
    fields: Array<{ key: string; label: string; type?: string; required: boolean; options?: Array<{ key: string; label: string }> }>;
    link: { collection: string; label: string };
  } | null;
  collection: string;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  documents: boolean;
  fields: PortalScreen['fields'];
}

export interface PortalContext {
  /** O idioma ESCOLHIDO para este convidado (dele ou do escritório); vazio quando ninguém escolheu. */
  locale: string;
  tenantName: string;
  logoURL: string | null;
  screens: PortalContextScreen[];
}

export type GetPortalContextUseCase = {
  execute: (input: {
    tenantId: string;
    userId: string;
    tenant: { name: string; logoURL: string | null };
    locale: string;
    resolve: (value: string) => string;
  }) => Promise<PortalContext>;
};

/**
 * O que a casca do portal precisa saber para desenhar — e só isso. O convidado não lê
 * `screenDefinitions`: recebe daqui as telas que o portal expõe, cada uma só com os campos expostos,
 * e os rótulos já no idioma dele.
 */
export const makeGetPortalContextUseCase = (repo: IPortalRepository): GetPortalContextUseCase => ({
  execute: async ({ tenantId, userId, tenant, locale, resolve }) => {
    if (!(await repo.getPortalUser(tenantId, userId))) {
      throw permissionDenied('@core.tenant/portal.not-invited');
    }
    const screens = (await repo.getScreens(tenantId)).filter((screen) => !!screen.portal);
    return {
      locale,
      tenantName: tenant.name,
      logoURL: tenant.logoURL,
      screens: screens.map((screen) => {
        const exposed = new Set(portalFieldKeys(screen));
        const fillable = new Set(portalCreateFieldKeys(screen));
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
