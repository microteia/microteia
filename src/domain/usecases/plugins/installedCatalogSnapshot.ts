/**
 * O RETRATO do domínio instalado num escritório — o `installed-catalog.json` que o diretório de autoria
 * lê para enxergar a tela do Form Design e a extensão de terceiro já instalada.
 *
 * Este é o ÚNICO escritor do arquivo, e mora aqui, puro, por causa de quem o chama:
 *
 * - o **Console** (`microteia export-catalog`), que lê o Firestore com o token do `gcloud` — credencial
 *   de PROJETO, que não passa pelas Security Rules e por isso exige papel no Firebase inteiro;
 * - a **aplicação** (Extensões → Exportar catálogo), que lê as mesmas quatro coleções com a identidade
 *   do MEMBRO, sob as regras. É o caminho de quem administra o escritório e não o projeto.
 *
 * As quatro coleções já eram legíveis por qualquer membro, e o retrato só leva esquema: oferecer o
 * download na aplicação não amplia o que ninguém vê. O que faltava era o retrato não depender de quem
 * tem o projeto.
 *
 * Enquanto o escritor vivia no Console, o formato era escrito de um lado e lido do outro (o leitor é
 * `src/sdk/node/installedCatalog.ts`), compilados separadamente e casados só por teste. Agora o Console
 * carrega ESTA função do SDK instalado em `extensions/` — o mesmo kernel do leitor —, e um Console de
 * outra época não tem mais como escrever um formato que o kernel não lê.
 *
 * A leitura é do documento CRU, nunca da entidade mapeada pelos repositórios. O documento gravado pode
 * ter qualquer forma, e um mapeamento que descarte um campo (`ownerPluginId`, `sourceId`) faria o
 * retrato afirmar uma ausência que o banco não tem.
 *
 * Três decisões que não são preferência:
 *
 * - **É ESQUEMA, nunca conteúdo.** Nome de tela, de campo e de lista viajam; opção de lista, máscara,
 *   texto de ajuda, valor padrão, regra de formulário, registro, membro e segredo não.
 * - **Ele se anuncia como retrato:** projeto, escritório, quando, por qual kernel e por qual ferramenta.
 * - **A lista vazia é escrita.** `exports: []` diz "não exporta nada"; a chave ausente é o silêncio de
 *   um escritor anterior ao campo, e o leitor distingue as duas.
 */

/** O nome é contrato com o leitor do SDK, que o procura por este nome. */
export const INSTALLED_CATALOG_FILE = 'installed-catalog.json';

/** A forma do arquivo. Sobe quando um leitor antigo deixaria de entender o que um novo escreve. */
export const INSTALLED_CATALOG_VERSION = 1;

/**
 * Quem tirou o retrato. A aplicação não tem versão própria a declarar além do `kernelVersion`, que é
 * exatamente o que ela roda; o Console tem, e é por ela que se reconhece um retrato tirado por um
 * Console anterior a este escritor.
 */
export type InstalledCatalogExporter =
  | { tool: 'console'; version: string }
  | { tool: 'application' };

/**
 * O que viaja de cada campo, e nada além. A linha é ESQUEMA versus CONTEÚDO: nome, tipo,
 * obrigatoriedade, referência, agregado e expressão descrevem o que a entidade É.
 */
export interface InstalledCatalogSnapshotField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  order: number;
  multi?: boolean;
  refEntity?: string;
  refDenormKey?: string;
  lookupCollection?: string;
  section?: string;
  origin: string;
  ownerPluginId?: string;
  aggregation?: Record<string, unknown>;
  compute?: string;
  /** O atalho de chave de um campo só — o kernel o desaçucara em `field:<key>`. */
  unique?: true;
}

/**
 * Uma chave da coleção (`ScreenDefinition.keys`). A mensagem do conflito NÃO viaja — é apresentação —,
 * e o `status` também não: a adoção é estado do kernel.
 */
export interface InstalledCatalogSnapshotKey {
  name: string;
  kind: string;
  fields: string[];
  scope?: string;
  normalize?: { trim?: boolean; caseInsensitive?: boolean; formatPreset?: string };
  sparse?: boolean;
  ownerPluginId?: string;
}

export interface InstalledCatalogSnapshotScreen {
  key: string;
  /**
   * O id UNIVERSAL da tela. A chave acima é a instalada, que pode ter sido desambiguada; é pelo
   * `sourceId` que uma extensão endereça a tela de outra (`record:<sourceId>`).
   */
  sourceId?: string;
  collection?: string;
  titleSingular: string;
  titlePlural?: string;
  titleFieldKey: string;
  origin: string;
  ownerPluginId?: string;
  parentEntity?: string;
  parentFieldKey?: string;
  parentRelation?: string;
  tagCollection?: string;
  eventPrefix?: string;
  /** Sempre escrita, mesmo vazia: a vazia diz "sem chave"; a ausente é escritor anterior ao campo. */
  keys: InstalledCatalogSnapshotKey[];
  fields: InstalledCatalogSnapshotField[];
}

export interface InstalledCatalogSnapshotList {
  collection: string;
  label: string;
  ownerPluginId?: string;
}

/**
 * Um artefato de `manifest.exports`. `unknown` é o export declarado que não casa com artefato nenhum
 * do pacote — dizê-lo é melhor que omiti-lo, porque a referência a ele passaria no portão da
 * instalação, que confere a LISTA, e falharia só na primeira execução.
 */
export interface InstalledCatalogSnapshotExportedArtifact {
  id: string;
  kind: 'workflow' | 'action' | 'script' | 'unknown';
  name: string;
}

/**
 * Um grupo da barra lateral (`ui.nav.group`). A CHAVE é contrato: é o que outra extensão escreve para
 * entrar no grupo. O nome vai resolvido em cada idioma que o próprio pacote traz.
 */
export interface InstalledCatalogSnapshotNavGroup {
  key: string;
  label: string;
  translations: Record<string, string>;
  order: number;
}

export interface InstalledCatalogSnapshotDocumentParameter {
  key: string;
  type: string;
  required?: boolean;
  list?: boolean;
  entityType?: string;
}

/** Um modelo de documento (`document.template`) como CONTRATO — nunca o texto, o rótulo nem a amostra. */
export interface InstalledCatalogSnapshotDocumentTemplate {
  key: string;
  source: 'record' | 'payload';
  parameters: InstalledCatalogSnapshotDocumentParameter[];
}

/** Um preset de campo (`data.field.preset`) como as PARTES que ele tem — nunca o template nem a regra. */
export interface InstalledCatalogSnapshotFieldPreset {
  key: string;
  slots: ('mask' | 'format' | 'validate')[];
}

export interface InstalledCatalogSnapshotExtension {
  id: string;
  name: string;
  version: string;
  active: boolean;
  /** Sempre escritas, mesmo vazias — ver o cabeçalho deste arquivo. */
  exports: InstalledCatalogSnapshotExportedArtifact[];
  navGroups: InstalledCatalogSnapshotNavGroup[];
  documentTemplates: InstalledCatalogSnapshotDocumentTemplate[];
  fieldPresets: InstalledCatalogSnapshotFieldPreset[];
}

export interface InstalledCatalogSnapshot {
  version: number;
  projectId: string;
  tenantId: string;
  tenantName: string;
  exportedAt: string;
  kernelVersion: string;
  exportedBy: InstalledCatalogExporter['tool'];
  /** Só quando quem tirou foi o Console. É o campo que leitores anteriores a `exportedBy` conhecem. */
  consoleVersion?: string;
  extensions: InstalledCatalogSnapshotExtension[];
  screens: InstalledCatalogSnapshotScreen[];
  lookups: InstalledCatalogSnapshotList[];
  tagLists: InstalledCatalogSnapshotList[];
}

/** Um documento já decodificado, com o id que a coleção lhe deu. */
export interface InstalledCatalogSourceDocument {
  id: string;
  data: Record<string, unknown>;
}

/** O que se lê do escritório: as quatro coleções, cruas. */
export interface InstalledCatalogSources {
  screens: InstalledCatalogSourceDocument[];
  lookups: InstalledCatalogSourceDocument[];
  tagLists: InstalledCatalogSourceDocument[];
  extensions: InstalledCatalogSourceDocument[];
}

export interface InstalledCatalogSnapshotInput extends InstalledCatalogSources {
  projectId: string;
  tenant: { id: string; name: string };
  kernelVersion: string;
  exportedAt: Date;
  exporter: InstalledCatalogExporter;
}

const text = (value: unknown): string | undefined =>
  (typeof value === 'string' && value.trim() !== '' ? value : undefined);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  (typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined);

const byKey = <T>(pick: (one: T) => string) => (a: T, b: T): number =>
  (pick(a) < pick(b) ? -1 : pick(a) > pick(b) ? 1 : 0);

const FIELD_ORIGINS = ['builtin', 'plugin', 'design'];

/**
 * A cópia instalada, como o resto do kernel a entende: o manifesto dentro de `package`, e o id do
 * documento como reserva quando o manifesto não o diz. Desativada (`active: false`) continua no
 * retrato: as telas dela seguem gravadas, e é ela que explica um campo que o autor vai encontrar.
 */
interface InstalledExtensionSource {
  id: string;
  name: string;
  version: string;
  active: boolean;
  manifest: Record<string, unknown> | undefined;
  pkg: Record<string, unknown>;
}

const installedExtensionOf = (document: InstalledCatalogSourceDocument): InstalledExtensionSource => {
  const pkg = asRecord(document.data.package) ?? {};
  const manifest = asRecord(pkg.manifest);
  return {
    id: String(manifest?.id ?? document.id),
    name: String(manifest?.name ?? manifest?.id ?? document.id),
    version: String(manifest?.version ?? '0.0.0'),
    active: document.data.active !== false,
    manifest,
    pkg,
  };
};

const contributionsOf = (extension: InstalledExtensionSource): Record<string, unknown>[] =>
  (Array.isArray(extension.manifest?.contributes) ? extension.manifest.contributes : [])
    .map(asRecord)
    .filter((one): one is Record<string, unknown> => one !== undefined);

/**
 * Os ids de `manifest.exports`, cada um casado com o artefato do pacote que o atende, para ganhar tipo
 * e nome. Um export que não casa com nada continua na lista como `unknown`.
 */
const exportedArtifacts = (extension: InstalledExtensionSource): InstalledCatalogSnapshotExportedArtifact[] => {
  const declared = extension.manifest?.exports;
  if (!Array.isArray(declared)) return [];

  const named = new Map<string, InstalledCatalogSnapshotExportedArtifact>();
  const collect = (raw: unknown, kind: 'workflow' | 'action' | 'script'): void => {
    for (const one of Array.isArray(raw) ? raw : []) {
      const record = asRecord(one);
      const id = text(record?.templateId);
      if (id === undefined || named.has(id)) continue;
      named.set(id, { id, kind, name: text(record?.name) ?? text(record?.title) ?? id });
    }
  };
  collect(extension.pkg.workflows, 'workflow');
  collect(extension.pkg.actions, 'action');
  collect(extension.pkg.scripts, 'script');

  return declared
    .filter((id): id is string => typeof id === 'string' && id !== '')
    .map((id) => named.get(id) ?? { id, kind: 'unknown' as const, name: id })
    .sort(byKey((one) => one.id));
};

const NAV_GROUP_POINT = 'ui.nav.group';
const MESSAGES_POINT = 'i18n.messages';
const DEFAULT_LOCALE = 'en';
const MESSAGE_REFERENCE = /^@([a-z0-9.-]+)\/(.+)$/;

/**
 * A mesma leitura que `declaredNavGroupsOf` faz do manifesto tipado, feita aqui sobre o documento
 * cru — e conferida contra ela por teste.
 */
const navGroupsOf = (extension: InstalledExtensionSource): InstalledCatalogSnapshotNavGroup[] => {
  const contributions = contributionsOf(extension);
  const bundles = contributions
    .filter((one) => one.point === MESSAGES_POINT)
    .map((one) => asRecord(one.metadata))
    .filter((one): one is Record<string, unknown> => one !== undefined);

  const translationsOf = (label: string): Record<string, string> => {
    const match = MESSAGE_REFERENCE.exec(label);
    if (!match) return {};
    const found: Record<string, string> = {};
    for (const bundle of bundles) {
      const locale = text(bundle.locale);
      const message = asRecord(bundle.messages)?.[match[2]];
      if (bundle.namespace !== match[1] || locale === undefined || typeof message !== 'string' || message.trim() === '') continue;
      if (found[locale] === undefined) found[locale] = message;
    }
    return found;
  };

  return contributions
    .filter((one) => one.point === NAV_GROUP_POINT)
    .flatMap((one): InstalledCatalogSnapshotNavGroup[] => {
      const metadata = asRecord(one.metadata) ?? {};
      const key = text(metadata.key)?.trim();
      if (key === undefined) return [];
      const raw = text(metadata.label) ?? key;
      const translations = translationsOf(raw);
      return [{
        key,
        label: translations[DEFAULT_LOCALE] ?? Object.values(translations)[0] ?? raw,
        translations,
        order: typeof metadata.order === 'number' ? metadata.order : 0,
      }];
    });
};

const DOCUMENT_TEMPLATE_POINT = 'document.template';

const documentParameterOf = (raw: unknown): InstalledCatalogSnapshotDocumentParameter[] => {
  const record = asRecord(raw);
  const key = text(record?.key);
  const type = text(record?.type);
  if (record === undefined || key === undefined || type === undefined) return [];
  const entityType = text(record.entityType);
  return [{
    key,
    type,
    ...(record.required === true ? { required: true } : {}),
    ...(record.list === true ? { list: true } : {}),
    ...(entityType === undefined ? {} : { entityType }),
  }];
};

/** A mesma leitura que `documentTemplateContractOf` faz, sobre o documento cru. */
const documentTemplatesOf = (extension: InstalledExtensionSource): InstalledCatalogSnapshotDocumentTemplate[] =>
  contributionsOf(extension)
    .filter((one) => one.point === DOCUMENT_TEMPLATE_POINT)
    .flatMap((one): InstalledCatalogSnapshotDocumentTemplate[] => {
      const metadata = asRecord(one.metadata);
      const key = text(metadata?.key);
      if (metadata === undefined || key === undefined) return [];
      return [{
        key,
        source: metadata.source === 'payload' ? 'payload' : 'record',
        parameters: (Array.isArray(metadata.parameters) ? metadata.parameters : []).flatMap(documentParameterOf),
      }];
    })
    .sort(byKey((one) => one.key));

const FIELD_PRESET_POINT = 'data.field.preset';

/**
 * A mesma leitura que `declaredFieldPresets` faz — chave e rótulo obrigatórios, e as partes pelo
 * critério do editor de campo —, sobre o documento cru.
 */
const fieldPresetsOf = (extension: InstalledExtensionSource): InstalledCatalogSnapshotFieldPreset[] =>
  contributionsOf(extension)
    .filter((one) => one.point === FIELD_PRESET_POINT)
    .flatMap((one): InstalledCatalogSnapshotFieldPreset[] => {
      const metadata = asRecord(one.metadata);
      const key = text(metadata?.key);
      if (metadata === undefined || key === undefined || text(metadata.label) === undefined) return [];
      return [{
        key,
        slots: [
          ...(metadata.mask ? ['mask' as const] : []),
          ...(Array.isArray(metadata.format) && metadata.format.length > 0 ? ['format' as const] : []),
          ...(metadata.validate ? ['validate' as const] : []),
        ],
      }];
    })
    .sort(byKey((one) => one.key));

/**
 * A mesma dedução de `screenDefinitionMapper.ts`: o `origin` gravado quando ele existe, senão `plugin`
 * para quem tem dono e `design` para o que o escritório criou.
 */
const originOf = (data: Record<string, unknown>, fallback: string): string => {
  const declared = text(data.origin);
  if (declared !== undefined && FIELD_ORIGINS.includes(declared)) return declared;
  return text(data.ownerPluginId) !== undefined ? 'plugin' : fallback;
};

const optional = <K extends string>(key: K, value: unknown): Partial<Record<K, string>> => {
  const found = text(value);
  return found === undefined ? {} : { [key]: found } as Record<K, string>;
};

const fieldExport = (raw: unknown, index: number, screenOrigin: string): InstalledCatalogSnapshotField | null => {
  const field = asRecord(raw);
  if (field === undefined) return null;
  const key = text(field.key);
  if (key === undefined) return null;

  const compute = text(asRecord(field.logic)?.compute);
  const aggregation = asRecord(field.aggregation);

  return {
    key,
    label: text(field.label) ?? key,
    type: text(field.type) ?? 'text',
    required: field.required === true,
    order: typeof field.order === 'number' ? field.order : index,
    ...(field.multi === true ? { multi: true } : {}),
    ...optional('refEntity', field.refEntity),
    ...optional('refDenormKey', field.refDenormKey),
    ...optional('lookupCollection', field.lookupCollection),
    ...optional('section', field.section),
    origin: originOf(field, screenOrigin),
    ...optional('ownerPluginId', field.ownerPluginId),
    ...(aggregation === undefined ? {} : { aggregation }),
    ...(compute === undefined ? {} : { compute }),
    ...(field.unique === true ? { unique: true as const } : {}),
  };
};

const normalizeExport = (raw: unknown): InstalledCatalogSnapshotKey['normalize'] | undefined => {
  const normalize = asRecord(raw);
  if (normalize === undefined) return undefined;
  const picked = {
    ...(typeof normalize.trim === 'boolean' ? { trim: normalize.trim } : {}),
    ...(typeof normalize.caseInsensitive === 'boolean' ? { caseInsensitive: normalize.caseInsensitive } : {}),
    ...optional('formatPreset', normalize.formatPreset),
  };
  return Object.keys(picked).length > 0 ? picked : undefined;
};

/** A chave como o kernel a grava, sem o que é apresentação. Sem nome ou sem campo, não é chave. */
const keyExport = (raw: unknown): InstalledCatalogSnapshotKey | null => {
  const key = asRecord(raw);
  const name = text(key?.name);
  const kind = text(key?.kind);
  const fields = (Array.isArray(key?.fields) ? key.fields : []).filter((one): one is string => typeof one === 'string' && one !== '');
  if (key === undefined || name === undefined || kind === undefined || fields.length === 0) return null;
  const normalize = normalizeExport(key.normalize);
  return {
    name,
    kind,
    fields,
    ...optional('scope', key.scope),
    ...(normalize === undefined ? {} : { normalize }),
    ...(typeof key.sparse === 'boolean' ? { sparse: key.sparse } : {}),
    ...optional('ownerPluginId', key.ownerPluginId),
  };
};

const screenExport = (document: InstalledCatalogSourceDocument): InstalledCatalogSnapshotScreen => {
  const data = document.data;
  const origin = originOf(data, 'design');
  const fields = Array.isArray(data.fields) ? data.fields : [];

  return {
    key: document.id,
    ...optional('sourceId', data.sourceId),
    ...optional('collection', data.dataCollection),
    titleSingular: text(data.titleSingular) ?? document.id,
    ...optional('titlePlural', data.titlePlural),
    titleFieldKey: text(data.titleFieldKey) ?? '',
    origin,
    ...optional('ownerPluginId', data.ownerPluginId),
    ...optional('parentEntity', data.parentEntity),
    ...optional('parentFieldKey', data.parentFieldKey),
    ...optional('parentRelation', data.parentRelation),
    ...optional('tagCollection', data.tagCollection),
    ...optional('eventPrefix', data.eventPrefix),
    keys: (Array.isArray(data.keys) ? data.keys : [])
      .map(keyExport)
      .filter((key): key is InstalledCatalogSnapshotKey => key !== null),
    fields: fields
      .map((field, index) => fieldExport(field, index, origin))
      .filter((field): field is InstalledCatalogSnapshotField => field !== null),
  };
};

/**
 * O id do documento É o nome da coleção da lista, tanto em `lookupDefinitions` quanto em
 * `tagDefinitions` — a mesma convenção que os repositórios da aplicação usam ao mapeá-las.
 */
const listExport = (document: InstalledCatalogSourceDocument): InstalledCatalogSnapshotList => ({
  collection: document.id,
  label: text(document.data.label) ?? document.id,
  ...optional('ownerPluginId', document.data.ownerPluginId),
});

/**
 * O retrato, montado a partir do que foi lido.
 *
 * Uma tela DESLIGADA (`enabled: false`) fica de fora: a coleção dela pode até existir no banco, mas
 * nada da plataforma a desenha, e trazê-la faria o catálogo afirmar que a entidade existe.
 */
export const buildInstalledCatalog = (input: InstalledCatalogSnapshotInput): InstalledCatalogSnapshot => ({
  version: INSTALLED_CATALOG_VERSION,
  projectId: input.projectId,
  tenantId: input.tenant.id,
  tenantName: input.tenant.name,
  exportedAt: input.exportedAt.toISOString(),
  kernelVersion: input.kernelVersion,
  exportedBy: input.exporter.tool,
  ...(input.exporter.tool === 'console' ? { consoleVersion: input.exporter.version } : {}),
  extensions: input.extensions
    .map(installedExtensionOf)
    .map((one) => ({
      id: one.id,
      name: one.name,
      version: one.version,
      active: one.active,
      exports: exportedArtifacts(one),
      navGroups: navGroupsOf(one),
      documentTemplates: documentTemplatesOf(one),
      fieldPresets: fieldPresetsOf(one),
    }))
    .sort(byKey((one) => one.id)),
  screens: input.screens
    .filter((document) => document.data.enabled !== false)
    .map(screenExport)
    .sort(byKey((one) => one.key)),
  lookups: input.lookups.map(listExport).sort(byKey((one) => one.collection)),
  tagLists: input.tagLists.map(listExport).sort(byKey((one) => one.collection)),
});

/** O arquivo como ele é gravado: o mesmo texto pelo Console e pela aplicação. */
export const serializeInstalledCatalog = (snapshot: InstalledCatalogSnapshot): string =>
  `${JSON.stringify(snapshot, null, 2)}\n`;
