import type {
  IPortalRepository,
  PortalDocumentProjection,
  PortalProjection,
  PortalScreen,
  PortalUserRecord,
  SharedRecordDocument,
} from './IPortalRepository';
import type { PortalHomeSettings } from '../schema/portalExtensionPoints';

/** Um escritório inteiro em memória — telas, registros, convites e projeções. */
export const makeFakePortalRepository = (screens: PortalScreen[]) => {
  const records = new Map<string, Record<string, unknown>>();
  const documents = new Map<string, Record<string, unknown>>();
  const projections = new Map<string, PortalProjection>();
  const projectedDocuments = new Map<string, PortalDocumentProjection>();
  const users = new Map<string, PortalUserRecord>();
  const invites: string[] = [];
  const homeSettings: PortalHomeSettings = { welcome: '', menu: { order: [], hidden: [] }, widgets: { order: [], hidden: [] } };

  const repo: IPortalRepository = {
    getHomeSettings: async () => homeSettings,
    getScreens: async () => screens,
    getRecord: async (_t, collection, id) => records.get(`${collection}/${id}`),
    getRecordsReferencing: async (_t, collection, fieldKey, recordId) =>
      [...records.entries()]
        .filter(([key, data]) => key.startsWith(`${collection}/`) && data[fieldKey] === recordId)
        .map(([key, data]) => ({ id: key.slice(collection.length + 1), data })),
    listRecords: async (_t, collection) => ({
      items: [...records.entries()]
        .filter(([key]) => key.startsWith(`${collection}/`))
        .map(([key, data]) => ({ id: key.slice(collection.length + 1), data })),
      next: null,
    }),
    audienceFor: async (_t, subjectKeys) =>
      [...users.values()].filter((user) => user.subjectKeys.some((key) => subjectKeys.includes(key))).map((user) => user.userId).sort(),
    getProjection: async (_t, id) => projections.get(id) ?? null,
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
    projectionsOfCollection: async (_t, collection) => ({
      items: [...projections.entries()]
        .filter(([, projection]) => projection.collection === collection)
        .map(([id, projection]) => ({ id, subjectKeys: projection.subjectKeys, audience: projection.audience })),
      next: null,
    }),
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
        url: String(data.url ?? ''),
        portalShared: data.portalShared === true,
      };
    },
    writeDocumentProjection: async (_t, projectionId, documentId, projection) => {
      projectedDocuments.set(`${projectionId}/${documentId}`, projection);
    },
    deleteDocumentProjection: async (_t, projectionId, documentId) => {
      projectedDocuments.delete(`${projectionId}/${documentId}`);
    },
    getPortalUser: async (_t, userId) => users.get(userId) ?? null,
    listPortalUsers: async () => [...users.values()],
    grantSubject: async (_t, grant, subjectKey) => {
      const current = users.get(grant.userId);
      users.set(grant.userId, {
        userId: grant.userId,
        email: grant.email,
        displayName: grant.displayName,
        subjectKeys: [...new Set([...(current?.subjectKeys ?? []), subjectKey])],
      });
    },
    revokeSubject: async (_t, userId, subjectKey) => {
      const current = users.get(userId);
      if (!current) return;
      const remaining = subjectKey === null ? [] : current.subjectKeys.filter((key) => key !== subjectKey);
      if (remaining.length === 0) users.delete(userId);
      else users.set(userId, { ...current, subjectKeys: remaining });
    },
    markInvite: async (email) => { invites.push(email); },
    hasInvite: async (email) => invites.includes(email),
  };

  return { repo, records, documents, projections, projectedDocuments, users, invites, homeSettings };
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
