import type { IPortalRepository, PortalProjection, PortalScreen } from '../repositories/IPortalRepository';
import {
  PORTAL_SUBJECT_MAX_DEPTH,
  parsePortalSubjectKey,
  portalExposedTitle,
  portalFieldKeys,
  portalRecordDocId,
  portalRecordTitle,
  projectPortalData,
  referencedIds,
  resolvePortalSubjectKeys,
} from '../schema/portal';

const PAGE_SIZE = 300;

const sameMembers = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

/** A tela que declara `portal` para os registros desta coleção. */
const portalScreenOf = (screens: PortalScreen[], collection: string): PortalScreen | undefined =>
  screens.find((screen) => screen.collection === collection && !!screen.portal);

const screenForEntity = (screens: PortalScreen[]) => (entityKey: string): PortalScreen | undefined =>
  screens.find((screen) => screen.id === entityKey) ?? screens.find((screen) => screen.collection === entityKey);

/** As telas cujo sujeito chega PELA tela dada — elas precisam ser refeitas quando o sujeito dela muda. */
const dependentsOf = (screens: PortalScreen[], screen: PortalScreen) =>
  screens.flatMap((candidate) => {
    const subject = candidate.portal?.subject;
    if (!subject || subject === 'self') return [];
    if (subject === 'parent') {
      return candidate.parentEntity === screen.id && candidate.parentFieldKey
        ? [{ screen: candidate, fieldKey: candidate.parentFieldKey, multi: false }]
        : [];
    }
    const field = candidate.fields.find((one) => one.key === subject.field);
    return field?.type === 'reference' && (field.refEntity === screen.id || field.refEntity === screen.collection)
      ? [{ screen: candidate, fieldKey: field.key, multi: field.multi === true }]
      : [];
  });

export interface ProjectPortalRecordInput {
  tenantId: string;
  collection: string;
  recordId: string;
  /** `null` quando o registro foi apagado. */
  data: Record<string, unknown> | null;
}

export type ProjectPortalRecordUseCase = {
  /** Devolve se a coleção é do portal — quem chama pode parar de olhar o resto. */
  execute: (input: ProjectPortalRecordInput) => Promise<boolean>;
};

/**
 * Mantém a projeção de UM registro em dia: só os campos expostos, o sujeito a que ele pertence e
 * quem pode vê-lo.
 *
 * Sem sujeito — o vínculo foi apagado, a tela-sujeito saiu do portal — a projeção some. É a resposta
 * fechada: o registro que não sabe a quem pertence não pertence a ninguém de fora.
 *
 * Quando o sujeito MUDA, as telas que chegam a ele por esta (o filho, a nota que aponta para o
 * pedido) são refeitas também: a projeção delas carrega o sujeito antigo, e o convidado de antes
 * continuaria vendo o que já não é dele.
 */
export const makeProjectPortalRecordUseCase = (repo: IPortalRepository): ProjectPortalRecordUseCase => {
  const project = async (
    tenantId: string,
    screens: PortalScreen[],
    screen: PortalScreen,
    recordId: string,
    data: Record<string, unknown> | null,
    depth: number,
  ): Promise<void> => {
    const projectionId = portalRecordDocId(screen.collection, recordId);
    const existing = await repo.getProjection(tenantId, projectionId);
    const screenFor = screenForEntity(screens);

    const subjectKeys = data
      ? await resolvePortalSubjectKeys(screen, recordId, data, {
        screenFor,
        getRecord: (collection, id) => repo.getRecord(tenantId, collection, id),
      })
      : [];

    if (!data || subjectKeys.length === 0) {
      if (existing) await repo.deleteProjection(tenantId, projectionId);
    } else {
      const labels: Record<string, string> = {};
      for (const key of portalFieldKeys(screen)) {
        const field = screen.fields.find((one) => one.key === key);
        if (field?.type !== 'reference' || !field.refEntity) continue;
        const target = screenFor(field.refEntity);
        const ids = referencedIds(data[key]);
        if (!target || ids.length === 0) continue;
        const titles = await Promise.all(ids.map(async (id) => {
          const referenced = await repo.getRecord(tenantId, target.collection, id);
          return referenced ? portalRecordTitle(target, referenced) : '';
        }));
        labels[key] = titles.filter((title) => title !== '').join(', ');
      }

      const projection: PortalProjection = {
        collection: screen.collection,
        recordId,
        screenId: screen.id,
        subjectKeys,
        audience: await repo.audienceFor(tenantId, subjectKeys),
        title: portalExposedTitle(screen, data),
        data: projectPortalData(screen, data),
        labels,
      };
      await repo.writeProjection(tenantId, projectionId, projection);

      if (!existing && screen.portal?.documents) {
        for (const document of await repo.sharedDocuments(tenantId, screen.collection, recordId)) {
          await repo.writeDocumentProjection(tenantId, projectionId, document.id, {
            name: document.name,
            type: document.type,
            description: document.description,
            createdAt: document.createdAt,
          });
        }
      }
    }

    const subjectChanged = !sameMembers(existing?.subjectKeys ?? [], subjectKeys);
    if (!subjectChanged || depth >= PORTAL_SUBJECT_MAX_DEPTH) return;
    for (const dependent of dependentsOf(screens, screen)) {
      const children = await repo.getRecordsReferencing(
        tenantId, dependent.screen.collection, dependent.fieldKey, recordId, dependent.multi,
      );
      for (const child of children) {
        await project(tenantId, screens, dependent.screen, child.id, child.data, depth + 1);
      }
    }
  };

  return {
    execute: async ({ tenantId, collection, recordId, data }) => {
      const screens = await repo.getScreens(tenantId);
      const screen = portalScreenOf(screens, collection);
      if (!screen) return false;
      await project(tenantId, screens, screen, recordId, data, 0);
      return true;
    },
  };
};

export type RefreshPortalAudienceUseCase = {
  execute: (tenantId: string, subjectKeys: string[]) => Promise<number>;
};

/**
 * Refaz QUEM vê, sem refazer o que é visto: o convite mudou, o dado não.
 *
 * Varre só as projeções daquele sujeito — nunca a coleção original —, e por isso o custo de convidar
 * alguém para uma empresa de dez mil notas é ler dez mil projeções, uma vez, em lotes.
 */
export const makeRefreshPortalAudienceUseCase = (repo: IPortalRepository): RefreshPortalAudienceUseCase => ({
  execute: async (tenantId, subjectKeys) => {
    let changed = 0;
    for (const subjectKey of new Set(subjectKeys)) {
      let after: string | null = null;
      do {
        const page = await repo.projectionsForSubject(tenantId, subjectKey, after, PAGE_SIZE);
        const changes: Array<{ projectionId: string; audience: string[] }> = [];
        for (const item of page.items) {
          const audience = await repo.audienceFor(tenantId, item.subjectKeys);
          if (!sameMembers(audience, item.audience)) changes.push({ projectionId: item.id, audience });
        }
        if (changes.length > 0) await repo.setAudiences(tenantId, changes);
        changed += changes.length;
        after = page.next;
      } while (after);
    }
    return changed;
  },
});

export type ReprojectPortalCollectionUseCase = {
  execute: (tenantId: string, collection: string) => Promise<void>;
};

/**
 * A declaração da tela mudou: o que antes saía pode não sair mais, e o contrário. Refaz a coleção
 * inteira — e, se ela deixou o portal, apaga o que tinha sido projetado dela.
 */
export const makeReprojectPortalCollectionUseCase = (
  repo: IPortalRepository,
  projectRecord: ProjectPortalRecordUseCase,
): ReprojectPortalCollectionUseCase => ({
  execute: async (tenantId, collection) => {
    const screens = await repo.getScreens(tenantId, { fresh: true });
    if (!portalScreenOf(screens, collection)) {
      let after: string | null = null;
      do {
        const page = await repo.projectionsOfCollection(tenantId, collection, after, PAGE_SIZE);
        for (const item of page.items) await repo.deleteProjection(tenantId, item.id);
        after = page.next;
      } while (after);
      return;
    }

    let after: string | null = null;
    do {
      const page = await repo.listRecords(tenantId, collection, after, PAGE_SIZE);
      for (const record of page.items) {
        await projectRecord.execute({ tenantId, collection, recordId: record.id, data: record.data });
      }
      after = page.next;
    } while (after);
  },
});

export interface ProjectPortalDocumentInput {
  tenantId: string;
  collection: string;
  recordId: string;
  documentId: string;
  /** `null` quando o documento foi apagado. */
  data: Record<string, unknown> | null;
}

export type ProjectPortalDocumentUseCase = {
  execute: (input: ProjectPortalDocumentInput) => Promise<void>;
};

/**
 * O documento sai do escritório só se a tela expõe documentos, se alguém o marcou como compartilhado,
 * e se o registro dele já está no portal. Faltando qualquer um, a cópia some.
 */
export const makeProjectPortalDocumentUseCase = (repo: IPortalRepository): ProjectPortalDocumentUseCase => ({
  execute: async ({ tenantId, collection, recordId, documentId, data }) => {
    const screens = await repo.getScreens(tenantId);
    const screen = portalScreenOf(screens, collection);
    if (!screen) return;
    const projectionId = portalRecordDocId(collection, recordId);

    const shared = !!data && data.portalShared === true && !data.deletedBy && screen.portal?.documents === true;
    if (!shared || !(await repo.getProjection(tenantId, projectionId))) {
      await repo.deleteDocumentProjection(tenantId, projectionId, documentId);
      return;
    }
    await repo.writeDocumentProjection(tenantId, projectionId, documentId, {
      name: typeof data.name === 'string' ? data.name : '',
      type: typeof data.type === 'string' ? data.type : null,
      description: typeof data.description === 'string' ? data.description : null,
      createdAt: data.createdAt ?? null,
    });
  },
});

/** O sujeito existe e é de uma tela-sujeito — o que o convite pode apontar. */
export const isValidPortalSubject = (screens: PortalScreen[], subjectKey: string): PortalScreen | undefined => {
  const parsed = parsePortalSubjectKey(subjectKey);
  if (!parsed) return undefined;
  return screens.find((screen) => screen.collection === parsed.collection && screen.portal?.subject === 'self');
};
