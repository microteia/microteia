import type { IPortalRepository, PortalDocumentProjection, PortalProjection, PortalScreen } from '../repositories/IPortalRepository';
import type { IRecordDocumentLinks } from '../repositories/IRecordDocumentLinks';
import { wasEverPortalShared } from '../services/recordDocumentLinks';
import type { StartPortalReprojectionUseCase } from './PortalReprojectionUseCases';
import {
  PORTAL_PUBLIC_SUBJECT_KEY,
  PORTAL_SUBJECT_MAX_DEPTH,
  evaluatePortalCondition,
  isPortalEditOpen,
  portalOwnerOf,
  parsePortalSubjectKey,
  portalLinkOf,
  portalSubjectKey,
  portalExposedTitle,
  portalDocumentLinkMinutes,
  portalLabelReferrers,
  portalRecordDocId,
  portalReferenceLabels,
  portalReferenceTitleSource,
  portalScreenOf,
  portalTargetScreen,
  projectPortalData,
  referencedIds,
  resolvePortalReferenceTitle,
  resolvePortalSubjectKeys,
  type PortalLabelReferrer,
} from '../schema/portal';

const PAGE_SIZE = 300;

const sameMembers = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join('\u0000') === [...b].sort().join('\u0000');

const hasIsEqual = (value: unknown): value is { isEqual: (other: unknown) => boolean } =>
  typeof value === 'object' && value !== null && typeof (value as { isEqual?: unknown }).isEqual === 'function';

/**
 * Igualdade do valor como o Firestore o devolve: `Timestamp` e afins se comparam pelo `isEqual` deles, e
 * chave com `undefined` vale ausente (a gravação a descarta). Na dúvida, diferente — o custo do engano
 * é uma gravação a mais, nunca um convidado vendo dado velho.
 */
export const samePortalValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (hasIsEqual(a)) return hasIsEqual(b) && a.isEqual(b);
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => samePortalValue(item, b[index]));
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) return false;
  const one = a as Record<string, unknown>;
  const other = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(one), ...Object.keys(other)].filter((key) => one[key] !== undefined || other[key] !== undefined));
  return [...keys].every((key) => samePortalValue(one[key], other[key]));
};

/**
 * As telas cujo sujeito chega PELA tela dada — elas precisam ser refeitas quando o sujeito dela muda.
 * O vínculo é resolvido pela MESMA regra da corrente (`portalTargetScreen`): o filho que aponta para a
 * coleção, e não para a chave da tela, também é dependente.
 */
const dependentsOf = (screens: PortalScreen[], screen: PortalScreen) =>
  screens.flatMap((candidate) => {
    const link = portalLinkOf(candidate);
    return link && portalTargetScreen(screens, link.targetEntity) === screen
      ? [{ screen: candidate, fieldKey: link.fieldKey, multi: link.multi }]
      : [];
  });

export interface ProjectPortalRecordInput {
  tenantId: string;
  collection: string;
  recordId: string;
  /** `null` quando o registro foi apagado. */
  data: Record<string, unknown> | null;
  /**
   * Refaz também os documentos projetados — a declaração mudou, e `documents` pode ter sido ligado
   * (traz os já compartilhados) ou desligado (tira os que tinham saído). Na gravação comum, não:
   * cada documento tem o próprio gatilho.
   *
   * Com `documentLinks`, é também aqui que o token permanente dos documentos que já foram
   * compartilhados é trocado: é a passada que a declaração abre, e ela visita todo registro da coleção.
   */
  syncDocuments?: boolean;
  /**
   * Refaz os dependentes quando o sujeito muda (padrão). A reprojeção desliga: a coleção deles já está
   * no escopo da passada e será percorrida por ela, e um pai com milhares de filhos faria uma rodada
   * sem tamanho previsível.
   */
  cascade?: boolean;
}

export type ProjectPortalRecordUseCase = {
  /** Devolve se a coleção é do portal — quem chama pode parar de olhar o resto. */
  execute: (input: ProjectPortalRecordInput) => Promise<boolean>;
};

/**
 * Mantém a projeção de UM registro em dia: só os campos expostos, o sujeito a que ele pertence e
 * quem pode vê-lo.
 *
 * Sem sujeito — o vínculo foi apagado, a tela-sujeito saiu do portal, o registro (ou um elo da
 * corrente) não passa no `visibleWhen` — a projeção some. É a resposta
 * fechada: o registro que não sabe a quem pertence não pertence a ninguém de fora.
 *
 * Quando o sujeito MUDA, as telas que chegam a ele por esta (o filho, a nota que aponta para o
 * pedido) são refeitas também: a projeção delas carrega o sujeito antigo, e o convidado de antes
 * continuaria vendo o que já não é dele.
 */
export const makeProjectPortalRecordUseCase = (
  repo: IPortalRepository,
  links?: IRecordDocumentLinks,
): ProjectPortalRecordUseCase => {
  /**
   * O token que pode ter saído com o link permanente é trocado — em TODO registro da coleção, inclusive
   * o que já não está no portal: o convidado que guardou o link continuaria abrindo o arquivo. A falha
   * sobe, e a passada conta o registro e tenta de novo.
   */
  const rotateExposedTokens = async (tenantId: string, screen: PortalScreen, recordId: string) => {
    if (!links || portalDocumentLinkMinutes(screen) === null) return;
    for (const documentId of await links.pendingRotation(tenantId, screen.collection, recordId)) {
      await links.rotate({ tenantId, collection: screen.collection, recordId, documentId });
    }
  };

  const project = async (
    tenantId: string,
    screens: PortalScreen[],
    screen: PortalScreen,
    recordId: string,
    data: Record<string, unknown> | null,
    depth: number,
    syncDocuments: boolean,
    cascade: boolean,
  ): Promise<void> => {
    const projectionId = portalRecordDocId(screen.collection, recordId);
    if (syncDocuments && data) await rotateExposedTokens(tenantId, screen, recordId);
    const read = await repo.getStoredProjection(tenantId, projectionId);
    const existing = read?.projection ?? null;
    const screenFor = (entityKey: string) => portalTargetScreen(screens, entityKey);

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
      const getRecord = (collection: string, id: string) => repo.getRecord(tenantId, collection, id);
      // O rótulo é o TÍTULO do registro apontado — da tela no portal que o expõe, ou de qualquer tela
      // quando a referência está em `referenceTitles`. Fora disso, sem rótulo: o id não sai como nome.
      for (const label of portalReferenceLabels(screens, screen)) {
        const ids = referencedIds(data[label.fieldKey]);
        if (ids.length === 0) continue;
        const titles = await Promise.all(ids.map(async (id) => {
          const referenced = await getRecord(label.target.collection, id);
          return referenced ? resolvePortalReferenceTitle(label, referenced, getRecord) : '';
        }));
        labels[label.fieldKey] = titles.filter((title) => title !== '').join(', ');
      }

      const link = portalLinkOf(screen);
      const linkTarget = link ? screenFor(link.targetEntity) : undefined;
      const parentKeys = link && linkTarget
        ? referencedIds(data[link.fieldKey]).map((id) => portalSubjectKey(linkTarget.collection, id))
        : [];

      // O público não tem quem convidar: a regra o libera pelo `public`, e `audience` fica vazio — um
      // convite novo não precisa refazer nada, e nenhuma lista de uids cresce com o escritório.
      const isPublic = subjectKeys.includes(PORTAL_PUBLIC_SUBJECT_KEY);
      const projection: PortalProjection = {
        collection: screen.collection,
        recordId,
        screenId: screen.id,
        subjectKeys,
        audience: isPublic ? [] : await repo.audienceFor(tenantId, subjectKeys),
        title: portalExposedTitle(screen, data, labels),
        data: projectPortalData(screen, data),
        labels,
        parentKeys,
        parentKey: parentKeys[0] ?? '',
        editable: isPortalEditOpen(screen, data, evaluatePortalCondition),
        portalOwner: portalOwnerOf(data),
        ...(isPublic ? { public: true as const } : {}),
      };
      // Regravar o que ficou igual não muda nada para o convidado, e cada gravação acorda os gatilhos
      // que escutam o tenant inteiro — numa passada, milhares de invocações para nada.
      if (!read || !samePortalValue(read.stored, projection)) await repo.writeProjection(tenantId, projectionId, projection);

      if (existing && syncDocuments && !screen.portal?.documents) {
        // A tela deixou de expor documentos: o que já tinha saído volta para dentro.
        await repo.clearDocumentProjections(tenantId, projectionId);
      }
      if ((!existing || syncDocuments) && screen.portal?.documents) {
        const projected = existing
          ? await repo.getDocumentProjections(tenantId, projectionId)
          : new Map<string, PortalDocumentProjection>();
        for (const document of await repo.sharedDocuments(tenantId, screen.collection, recordId)) {
          const documentProjection: PortalDocumentProjection = {
            name: document.name,
            type: document.type,
            description: document.description,
            createdAt: document.createdAt,
            sha256: document.sha256,
          };
          if (samePortalValue(projected.get(document.id), documentProjection)) continue;
          await repo.writeDocumentProjection(tenantId, projectionId, document.id, documentProjection);
        }
      }
    }

    const subjectChanged = !sameMembers(existing?.subjectKeys ?? [], subjectKeys);
    if (!cascade || !subjectChanged || depth >= PORTAL_SUBJECT_MAX_DEPTH) return;
    for (const dependent of dependentsOf(screens, screen)) {
      const children = await repo.getRecordsReferencing(
        tenantId, dependent.screen.collection, dependent.fieldKey, recordId, dependent.multi,
      );
      for (const child of children) {
        await project(tenantId, screens, dependent.screen, child.id, child.data, depth + 1, false, true);
      }
    }
  };

  return {
    execute: async ({ tenantId, collection, recordId, data, syncDocuments = false, cascade = true }) => {
      const screens = await repo.getScreens(tenantId);
      const screen = portalScreenOf(screens, collection);
      if (!screen) return false;
      await project(tenantId, screens, screen, recordId, data, 0, syncDocuments, cascade);
      return true;
    },
  };
};

/**
 * Quantos registros que apontam para o renomeado são refeitos na hora, por campo. Acima disso a coleção
 * deles ganha uma passada de reprojeção — por rodadas, na fila do escritório —, e não uma invocação sem
 * tamanho previsível.
 */
export const PORTAL_LABEL_REFRESH_LIMIT = 100;

export interface RefreshPortalReferenceLabelsInput {
  tenantId: string;
  collection: string;
  recordId: string;
  /** `null` quando o registro acabou de nascer. */
  before: Record<string, unknown> | null;
  /** `null` quando o registro foi apagado. */
  after: Record<string, unknown> | null;
}

export type RefreshPortalReferenceLabelsUseCase = {
  /** Devolve quantos registros foram refeitos na hora. */
  execute: (input: RefreshPortalReferenceLabelsInput) => Promise<number>;
};

/**
 * O título de um registro mudou: refaz as projeções que o mostram — no rótulo de uma referência exposta,
 * ou no título que é essa referência. Sem isto, o domicílio continuaria com o nome antigo do contribuinte
 * até alguém regravá-lo. Vale pelo segundo salto: renomear o contribuinte refaz também a comunicação que
 * aponta para o domicílio dele, e trocar o contribuinte do domicílio refaz as comunicações dele.
 *
 * A pergunta é feita em TODA gravação de registro, e por isso é pura até o título mudar de fato: só
 * então lê os que apontam para ele. É a regra que a projeção usa para escrever o rótulo
 * (`portalLabelReferrers`), e não outra.
 */
export const makeRefreshPortalReferenceLabelsUseCase = (
  repo: IPortalRepository,
  project: ProjectPortalRecordUseCase,
  startReprojection: StartPortalReprojectionUseCase,
): RefreshPortalReferenceLabelsUseCase => ({
  execute: async ({ tenantId, collection, recordId, before, after }) => {
    const screens = await repo.getScreens(tenantId);
    const renamed = portalLabelReferrers(screens, collection).filter(({ label, distant }) => {
      const source = distant && label.through ? label.through : label;
      return portalReferenceTitleSource(source, before) !== portalReferenceTitleSource(source, after);
    });
    if (renamed.length === 0) return 0;

    /**
     * Quem aponta, até o teto — `null` acima dele. Pelo segundo salto, o teto vale para o registro do
     * meio e para a soma de quem aponta para todos eles: o contribuinte com cem domicílios de mil
     * comunicações cada um é uma passada, não cem mil projeções numa invocação.
     */
    const referrersOf = async ({ screen, label, distant }: PortalLabelReferrer<PortalScreen>) => {
      const middle = distant && label.through
        ? await repo.getRecordsReferencing(
          tenantId, label.target.collection, label.through.fieldKey, recordId, label.through.multi, PORTAL_LABEL_REFRESH_LIMIT + 1,
        )
        : [{ id: recordId }];
      if (middle.length > PORTAL_LABEL_REFRESH_LIMIT) return null;
      const found: Array<{ id: string; data: Record<string, unknown> }> = [];
      for (const { id } of middle) {
        found.push(...await repo.getRecordsReferencing(
          tenantId, screen.collection, label.fieldKey, id, label.multi, PORTAL_LABEL_REFRESH_LIMIT + 1 - found.length,
        ));
        if (found.length > PORTAL_LABEL_REFRESH_LIMIT) return null;
      }
      return found;
    };

    const overflow = new Set<string>();
    const refreshed = new Set<string>();
    for (const referrer of renamed) {
      const { screen } = referrer;
      if (overflow.has(screen.collection)) continue;
      const records = await referrersOf(referrer);
      if (!records) {
        overflow.add(screen.collection);
        continue;
      }
      for (const record of records) {
        const key = portalRecordDocId(screen.collection, record.id);
        if (refreshed.has(key)) continue;
        refreshed.add(key);
        await project.execute({ tenantId, collection: screen.collection, recordId: record.id, data: record.data, cascade: false });
      }
    }
    if (overflow.size > 0) await startReprojection.execute(tenantId, [...overflow]);
    return refreshed.size;
  },
});

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
    const audiences = new Map<string, string[]>();
    for (const subjectKey of new Set(subjectKeys)) {
      let after: string | null = null;
      do {
        const page = await repo.projectionsForSubject(tenantId, subjectKey, after, PAGE_SIZE);
        const changes: Array<{ projectionId: string; audience: string[] }> = [];
        for (const item of page.items) {
          // As projeções de um sujeito quase sempre têm os MESMOS sujeitos: uma consulta por
          // combinação, e não uma por projeção — dez mil notas da mesma empresa são uma consulta só.
          const signature = [...item.subjectKeys].sort().join('\u0000');
          let audience = audiences.get(signature);
          if (!audience) {
            audience = await repo.audienceFor(tenantId, item.subjectKeys);
            audiences.set(signature, audience);
          }
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

export interface ProjectPortalDocumentInput {
  tenantId: string;
  collection: string;
  recordId: string;
  documentId: string;
  /** `null` quando o documento foi apagado. */
  data: Record<string, unknown> | null;
  /** Como estava antes da gravação — `null` quando ele acabou de nascer. */
  before?: Record<string, unknown> | null;
}

export type ProjectPortalDocumentUseCase = {
  execute: (input: ProjectPortalDocumentInput) => Promise<void>;
};

/**
 * O documento sai do escritório só se a tela expõe documentos, se alguém o marcou como compartilhado,
 * e se o registro dele já está no portal. Faltando qualquer um, a cópia some.
 */
export const makeProjectPortalDocumentUseCase = (
  repo: IPortalRepository,
  links?: IRecordDocumentLinks,
): ProjectPortalDocumentUseCase => ({
  execute: async ({ tenantId, collection, recordId, documentId, data, before = null }) => {
    const screens = await repo.getScreens(tenantId);
    const screen = portalScreenOf(screens, collection);
    if (!screen) return;
    const projectionId = portalRecordDocId(collection, recordId);

    const shared = !!data && data.portalShared === true && !data.deletedBy && screen.portal?.documents === true;
    // Compartilhado pela PRIMEIRA vez numa tela com link curto: o token dele nunca saiu, e o selo evita
    // que a próxima passada o troque sem necessidade. O que já foi compartilhado antes fica sem selo —
    // ele pode ter saído —, e a passada o troca.
    if (shared && links && portalDocumentLinkMinutes(screen) !== null && !wasEverPortalShared(before)) {
      await links.seal({ tenantId, collection, recordId, documentId });
    }
    if (!shared || !(await repo.getProjection(tenantId, projectionId))) {
      await repo.deleteDocumentProjection(tenantId, projectionId, documentId);
      return;
    }
    await repo.writeDocumentProjection(tenantId, projectionId, documentId, {
      name: typeof data.name === 'string' ? data.name : '',
      type: typeof data.type === 'string' ? data.type : null,
      description: typeof data.description === 'string' ? data.description : null,
      createdAt: data.createdAt ?? null,
      sha256: typeof data.sha256 === 'string' ? data.sha256 : null,
    });
  },
});

/** O sujeito existe e é de uma tela-sujeito — o que o convite pode apontar. */
export const isValidPortalSubject = (screens: PortalScreen[], subjectKey: string): PortalScreen | undefined => {
  const parsed = parsePortalSubjectKey(subjectKey);
  if (!parsed) return undefined;
  return screens.find((screen) => screen.collection === parsed.collection && screen.portal?.subject === 'self');
};
