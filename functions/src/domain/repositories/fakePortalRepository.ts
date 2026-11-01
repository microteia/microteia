import { recordDocumentStoragePath } from '../services/recordDocumentHash';
import { recordDocumentLinkState } from '../services/recordDocumentLinks';
import type {
  IPortalRepository,
  PortalActionDefinition,
  PortalDocumentProjection,
  PortalFieldOption,
  PortalProjection,
  PortalReprojectionState,
  PortalScreen,
  PortalUserRecord,
  SharedRecordDocument,
} from './IPortalRepository';
import type { PortalHomeSettings } from '../schema/portalExtensionPoints';
import type { PortalTextOverride } from '../schema/portalText';
import { portalSubjectRoleOf, withPortalSubjectRole, withoutPortalSubjectRoles } from '../schema/portalRole';

/** Uma página por id de documento, como o Firestore a entrega: `startAfter(after)`, `limit(pageSize)`. */
const pageOf = <T extends { id: string }>(items: T[], after: string | null, pageSize: number) => {
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const page = sorted.filter((item) => after === null || item.id > after).slice(0, pageSize);
  return { items: page, next: page.length === pageSize ? page[page.length - 1].id : null };
};

/** Um escritório inteiro em memória — telas, registros, convites e projeções. */
export const makeFakePortalRepository = (screens: PortalScreen[]) => {
  const records = new Map<string, Record<string, unknown>>();
  const documents = new Map<string, Record<string, unknown>>();
  const projections = new Map<string, PortalProjection>();
  const projectedDocuments = new Map<string, PortalDocumentProjection>();
  const users = new Map<string, PortalUserRecord>();
  const invites: string[] = [];
  const staged = new Map<string, { data: Buffer; contentType: string }>();
  const reprojections = new Map<string, PortalReprojectionState>();
  const lookups = new Map<string, PortalFieldOption[]>();
  const actions = new Map<string, PortalActionDefinition>();
  const homeSettings: PortalHomeSettings = { welcome: '', menu: { order: [], hidden: [] }, widgets: { order: [], hidden: [] }, layout: '' };
  const portalTexts = new Map<string, PortalTextOverride[]>();
  const portalTextReads: string[] = [];

  const repo: IPortalRepository = {
    getHomeSettings: async () => homeSettings,
    listPortalTexts: async (tenantId) => {
      portalTextReads.push(tenantId);
      return portalTexts.get(tenantId) ?? [];
    },
    getScreens: async () => screens,
    getLookupOptions: async (_t, collection) => lookups.get(collection) ?? [],
    getRecord: async (_t, collection, id) => records.get(`${collection}/${id}`),
    getActions: async (_t, ids) => ids.flatMap((id) => {
      const action = actions.get(id);
      return action ? [action] : [];
    }),
    getRecordsReferencing: async (_t, collection, fieldKey, recordId, multi, limit) =>
      [...records.entries()]
        .filter(([key, data]) => key.startsWith(`${collection}/`)
          && (multi ? Array.isArray(data[fieldKey]) && (data[fieldKey] as unknown[]).includes(recordId) : data[fieldKey] === recordId))
        .slice(0, limit)
        .map(([key, data]) => ({ id: key.slice(collection.length + 1), data })),
    listRecords: async (_t, collection, after, pageSize) => pageOf(
      [...records.entries()]
        .filter(([key]) => key.startsWith(`${collection}/`))
        .map(([key, data]) => ({ id: key.slice(collection.length + 1), data })),
      after,
      pageSize,
    ),
    audienceFor: async (_t, subjectKeys) =>
      [...users.values()].filter((user) => user.subjectKeys.some((key) => subjectKeys.includes(key))).map((user) => user.userId).sort(),
    getProjection: async (_t, id) => projections.get(id) ?? null,
    getStoredProjection: async (_t, id) => {
      const projection = projections.get(id);
      return projection ? { projection, stored: { ...projection } } : null;
    },
    writeProjection: async (_t, id, projection) => { projections.set(id, projection); },
    deleteProjection: async (_t, id) => {
      projections.delete(id);
      for (const key of [...projectedDocuments.keys()]) if (key.startsWith(`${id}/`)) projectedDocuments.delete(key);
    },
    projectionsForSubject: async (_t, subjectKey) => ({
      items: [...projections.entries()]
        .filter(([, projection]) => projection.subjectKeys.includes(subjectKey))
        .map(([id, projection]) => ({ id, subjectKeys: projection.subjectKeys, audience: projection.audience })),
      next: null,
    }),
    projectionsOfCollection: async (_t, collection, after, pageSize) => pageOf(
      [...projections.entries()]
        .filter(([, projection]) => projection.collection === collection)
        .map(([id, projection]) => ({ id, subjectKeys: projection.subjectKeys, audience: projection.audience })),
      after,
      pageSize,
    ),
    countRecords: async (_t, collection) => [...records.keys()].filter((key) => key.startsWith(`${collection}/`)).length,
    countProjectionsOfCollection: async (_t, collection) =>
      [...projections.values()].filter((projection) => projection.collection === collection).length,
    listReprojections: async () => new Map(reprojections),
    updateReprojection: async (_t, collection, mutate) => {
      const next = mutate(reprojections.get(collection) ?? null);
      if (next) reprojections.set(collection, next);
      return next;
    },
    updateReprojections: async (_t, mutate) => {
      const changed = mutate(new Map(reprojections));
      for (const [collection, state] of changed) reprojections.set(collection, state);
      return changed;
    },
    setAudiences: async (_t, changes) => {
      for (const change of changes) {
        const current = projections.get(change.projectionId);
        if (current) projections.set(change.projectionId, { ...current, audience: change.audience });
      }
    },
    sharedDocuments: async (_t, collection, recordId) =>
      [...documents.entries()]
        .filter(([key, data]) => key.startsWith(`${collection}/${recordId}/`) && data.portalShared === true)
        .map(([key, data]) => ({
          id: key.split('/').pop() as string,
          name: String(data.name ?? ''),
          type: null,
          description: null,
          createdAt: null,
          sha256: null,
          url: String(data.url ?? ''),
        }) satisfies SharedRecordDocument),
    getRecordDocument: async (_t, collection, recordId, documentId) => {
      const data = documents.get(`${collection}/${recordId}/${documentId}`);
      if (!data) return null;
      return {
        id: documentId,
        name: String(data.name ?? ''),
        type: null,
        description: null,
        createdAt: null,
        sha256: null,
        url: String(data.url ?? ''),
        portalShared: data.portalShared === true,
        storagePath: recordDocumentStoragePath({ tenantId: _t, parent: collection, parentId: recordId }, data),
        link: recordDocumentLinkState(data),
      };
    },
    clearDocumentProjections: async (_t, id) => {
      for (const key of [...projectedDocuments.keys()]) if (key.startsWith(`${id}/`)) projectedDocuments.delete(key);
    },
    getDocumentProjections: async (_t, projectionId) => new Map(
      [...projectedDocuments.entries()]
        .filter(([key]) => key.startsWith(`${projectionId}/`))
        .map(([key, projection]) => [key.slice(projectionId.length + 1), projection]),
    ),
    writeDocumentProjection: async (_t, projectionId, documentId, projection) => {
      projectedDocuments.set(`${projectionId}/${documentId}`, projection);
    },
    deleteDocumentProjection: async (_t, projectionId, documentId) => {
      projectedDocuments.delete(`${projectionId}/${documentId}`);
    },
    getPortalUser: async (_t, userId) => users.get(userId) ?? null,
    listPortalUsers: async () => [...users.values()],
    grantSubject: async (_t, grant, subjectKey, role) => {
      const current = users.get(grant.userId);
      const roles = current?.subjectRoles ?? [];
      const roleChanged = !!role && portalSubjectRoleOf(roles, subjectKey) !== role;
      const subjectRoles = roleChanged && role ? withPortalSubjectRole(roles, subjectKey, role) : roles;
      users.set(grant.userId, {
        userId: grant.userId,
        email: grant.email,
        displayName: current?.displayName ?? grant.displayName,
        subjectKeys: [...new Set([...(current?.subjectKeys ?? []), subjectKey])],
        ...(subjectRoles.length > 0 ? { subjectRoles } : {}),
      });
      return { granted: !current?.subjectKeys.includes(subjectKey), roleChanged };
    },
    revokeSubject: async (_t, userId, subjectKey) => {
      const current = users.get(userId);
      if (!current) return false;
      const remaining = subjectKey === null ? [] : current.subjectKeys.filter((key) => key !== subjectKey);
      if (remaining.length === current.subjectKeys.length) return false;
      if (remaining.length === 0) users.delete(userId);
      else users.set(userId, { ...current, subjectKeys: remaining, subjectRoles: withoutPortalSubjectRoles(current.subjectRoles ?? [], subjectKey) });
      return true;
    },
    readStagedUpload: async (_t, userId, uploadId) => staged.get(`${userId}/${uploadId}`) ?? null,
    deleteStagedUpload: async (_t, userId, uploadId) => { staged.delete(`${userId}/${uploadId}`); },
    markInvite: async (email) => { invites.push(email); },
    hasInvite: async (email) => invites.includes(email),
  };

  return {
    repo, records, documents, projections, projectedDocuments, users, invites, homeSettings, staged, reprojections, lookups, actions,
    portalTexts, portalTextReads,
  };
};

const field = (key: string, extra: Partial<PortalScreen['fields'][number]> = {}) => ({ key, label: key, type: 'text', ...extra });

/** Uma prefeitura: empresas recebem convidados; notas apontam para a empresa; itens herdam da nota. */
export const CITY_SCREENS: PortalScreen[] = [
  {
    id: 'companies',
    collection: 'companies',
    titleFieldKey: 'name',
    titleSingular: 'Company',
    titlePlural: 'Companies',
    icon: 'building',
    fields: [field('name'), field('taxId')],
    portal: { subject: 'self', fields: ['name'] },
  },
  {
    id: 'invoices',
    collection: 'invoices',
    titleFieldKey: 'number',
    titleSingular: 'Invoice',
    titlePlural: 'Invoices',
    icon: 'file',
    fields: [
      field('number'),
      field('amount', { type: 'currency' }),
      field('auditNote'),
      field('companyId', { type: 'reference', refEntity: 'companies' }),
    ],
    portal: { subject: { field: 'companyId' }, fields: ['number', 'amount', 'companyId'], documents: true },
  },
  {
    id: 'invoiceItems',
    collection: 'invoiceItems',
    titleFieldKey: 'description',
    titleSingular: 'Item',
    titlePlural: 'Items',
    icon: 'list',
    parentEntity: 'invoices',
    parentFieldKey: 'invoiceId',
    fields: [field('description'), field('invoiceId', { type: 'reference', refEntity: 'invoices' })],
    portal: { subject: 'parent', fields: ['description'] },
  },
  {
    id: 'inspections',
    collection: 'inspections',
    titleFieldKey: 'title',
    titleSingular: 'Inspection',
    titlePlural: 'Inspections',
    icon: 'search',
    fields: [field('title'), field('companyId', { type: 'reference', refEntity: 'companies' })],
    portal: null,
  },
];

/** A âncora das rules que a instalação grava com o nome da coleção: sem campos, sem portal. */
const anchorScreen = (collection: string): PortalScreen => ({
  id: collection,
  collection,
  titleSingular: collection,
  titlePlural: collection,
  icon: 'table',
  fields: [],
  portal: null,
});

/**
 * A mesma prefeitura, com as telas trazidas por uma extensão sobre coleções que já existem
 * (`dataCollection`). Os vínculos continuam apontando para a COLEÇÃO (`companies`, `invoices`), e cada
 * coleção-alvo tem também a âncora, com o nome dela e sem portal — listada ANTES, como no Firestore.
 */
export const EXTENSION_CITY_SCREENS: PortalScreen[] = [
  anchorScreen('companies'),
  anchorScreen('invoices'),
  ...CITY_SCREENS.map((screen) => ({ ...screen, id: `city_${screen.id}` })),
];

/**
 * A mesma prefeitura com uma tela PÚBLICA — as indisponibilidades do sistema, de todo convidado — e uma
 * filha dela, que tenta herdar o público pelo pai (e não herda).
 */
export const PUBLIC_CITY_SCREENS: PortalScreen[] = [
  ...CITY_SCREENS,
  {
    id: 'outages',
    collection: 'outages',
    titleFieldKey: 'description',
    titleSingular: 'Outage',
    titlePlural: 'Outages',
    icon: 'alert',
    fields: [field('description'), field('kind'), field('companyId', { type: 'reference', refEntity: 'companies' })],
    portal: { subject: 'public', fields: ['description', 'companyId'], visibleWhen: 'kind == "outage"' },
  },
  {
    id: 'outageNotes',
    collection: 'outageNotes',
    titleFieldKey: 'text',
    titleSingular: 'Note',
    titlePlural: 'Notes',
    icon: 'list',
    parentEntity: 'outages',
    parentFieldKey: 'outageId',
    fields: [field('text'), field('outageId', { type: 'reference', refEntity: 'outages' })],
    portal: { subject: 'parent', fields: ['text'] },
  },
];
