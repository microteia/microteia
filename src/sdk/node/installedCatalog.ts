import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import type { CustomFieldType, FieldAggregation, FieldOrigin } from '../../domain/schema/fieldRules';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';
import type { RecordKeyKind, RecordKeyNormalization, RecordKeyScope, RecordKeySpec } from '../../domain/schema/recordKeys';
import { RECORD_KEY_KINDS, RECORD_KEY_SCOPES } from '../../domain/schema/recordKeys';
import type { DocumentTemplateContract } from '../../domain/usecases/plugins/documentStepIntegrity';
import { documentTemplateContractOf } from '../../domain/usecases/plugins/documentStepIntegrity';
import type { FieldPresetSlot, OfferedFieldPreset } from '../../domain/usecases/plugins/fieldPresetRefs';
import type { CatalogScreenInput, ParentRelation } from '../domain/catalog';

/**
 * O RETRATO DA INSTALAÇÃO — o que o servidor MCP passa a saber sem nunca falar com o Firestore.
 *
 * O catálogo do workspace (`workspaceCatalog.ts`) só enxerga os `plugin.ts` deste diretório mais as
 * entidades que o kernel declara. Numa instalação real isso deixa de fora justamente o que mais
 * importa: a tela que o escritório criou no Form Design e a extensão de terceiro já instalada. O
 * detector de "campo que pertence a outra entidade conhecida" não podia disparar contra elas, porque
 * para ele elas não existiam.
 *
 * Fechar isso ligando o SDK ao banco trocaria uma cegueira por um problema pior: `microteia-plugin` é
 * offline por desenho, e arrastar credencial para cá poria segredo do escritório dentro da ferramenta
 * de autoria. Quem já fala com o projeto é o Console, que tem o token do `gcloud` — então é ele que
 * EXPORTA (`microteia export-catalog`), e este módulo apenas LÊ o arquivo, se ele estiver lá.
 *
 * Daí as três propriedades que governam o formato:
 *
 * - **É um retrato, e se anuncia como tal.** Carrega projeto, escritório, quando foi tirado e por qual
 *   versão do kernel. Um catálogo apresentado como completo quando não é vale menos que nenhum.
 * - **É esquema, nunca conteúdo.** Nome de tela, de campo e de lista viajam; registro, valor de lista,
 *   membro, segredo e configuração não. Ver `INSTALLED_CATALOG_OMITS`.
 * - **É opcional.** Sem o arquivo, tudo continua exatamente como antes.
 *
 * O Console NÃO importa este módulo — ele é compilado e distribuído sozinho, sem alcançar `src/`. As
 * duas pontas do contrato são casadas por teste (`installedCatalog.test.ts` do lado de cá,
 * `exportCatalog.test.ts` do lado de lá), e o `version` do arquivo é o que impede um Console de outra
 * época de ser lido como se falasse a mesma língua.
 */

export const INSTALLED_CATALOG_FILE = 'installed-catalog.json';

/** A forma do arquivo. Sobe quando um leitor antigo deixaria de entender o que um novo escreve. */
export const INSTALLED_CATALOG_VERSION = 1;

/** A partir daqui o retrato é ANUNCIADO como velho — ele continua valendo, e quem lê fica sabendo. */
export const INSTALLED_CATALOG_STALE_DAYS = 14;

/**
 * O que o retrato deliberadamente NÃO carrega, e por quê. Serve à resposta das tools: dizer o que
 * falta é o que impede o agente de tomar a lista por completa.
 */
export const INSTALLED_CATALOG_OMITS: readonly string[] = [
  'records — the catalog describes shape, and a snapshot of an office\'s data has no business in an authoring directory',
  'the values inside a list of options or a tag list — that vocabulary is the office\'s, and the entity catalog never reads it',
  'members, roles and permissions — who may do what is not part of what an entity IS',
  'what a workflow, script or action DOES — the steps and the code are behaviour, not shape. What each '
    + 'installed extension declares in `manifest.exports` does travel: that is the surface you may '
    + 'reference, and a name you cannot see is a name you cannot write',
  'secrets and settings — nothing here should ever hold a credential',
];

export interface InstalledCatalogField {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  order: number;
  multi?: boolean;
  refEntity?: string | null;
  refDenormKey?: string | null;
  lookupCollection?: string | null;
  section?: string | null;
  origin: FieldOrigin;
  ownerPluginId?: string | null;
  aggregation?: FieldAggregation | null;
  compute?: string | null;
  unique?: boolean;
}

export interface InstalledCatalogScreen {
  key: string;
  /** O id universal da tela. Ausente num retrato de Console anterior ao campo. */
  sourceId?: string | null;
  collection?: string | null;
  titleSingular: string;
  titlePlural?: string;
  titleFieldKey: string;
  origin: FieldOrigin;
  ownerPluginId?: string | null;
  parentEntity?: string | null;
  parentFieldKey?: string | null;
  parentRelation?: ParentRelation | null;
  tagCollection?: string | null;
  eventPrefix?: string | null;
  /**
   * As chaves da coleção. **`undefined` é "não registrado", e nunca "sem chave"** — um Console anterior
   * ao campo não o escrevia; ver `keysKnown`.
   */
  keys?: RecordKeySpec[];
  fields: InstalledCatalogField[];
}

export interface InstalledCatalogList {
  collection: string;
  label: string;
  ownerPluginId?: string | null;
}

/**
 * O tipo do artefato exportado, porque é ele que decide ONDE a referência cabe: um script vai em
 * `scriptId`, uma automação em `targetWorkflowId`. `unknown` é o export declarado que não casa com
 * nenhum artefato do pacote — dizê-lo é melhor que escondê-lo, porque a referência a ele passaria no
 * portão da instalação (que confere a lista) e falharia na primeira execução.
 */
export type InstalledCatalogExportKind = 'workflow' | 'action' | 'script' | 'unknown';

export interface InstalledCatalogExport {
  /** O `sourceId` — a metade direita de `<pluginId>/<sourceId>`. */
  id: string;
  kind: InstalledCatalogExportKind;
  name: string;
}

/**
 * Um grupo da barra lateral que a extensão instalada declara (`ui.nav.group`), com o nome já
 * resolvido em cada idioma que ela traz. É contrato, como o `exports`: a chave é o que outra extensão
 * escreve para ENTRAR no grupo, e uma chave que não se enxerga vira um segundo grupo com o mesmo nome.
 */
export interface InstalledCatalogNavGroup {
  key: string;
  label: string;
  translations: Record<string, string>;
  order: number;
}

export interface InstalledCatalogExtension {
  id: string;
  name: string;
  version: string;
  active: boolean;
  /**
   * A superfície pública desta extensão, de `manifest.exports`. **`undefined` é "não registrado", e
   * nunca "não exporta nada"** — um Console anterior a este campo não escrevia a chave, e um que a
   * conhece escreve `[]` quando a lista é vazia. É essa distinção que `exportsKnown` carrega, e é ela
   * que impede o retrato de afirmar ausência quando o que houve foi silêncio.
   */
  exports?: InstalledCatalogExport[];
  /** Os grupos da barra lateral que ela declara. Ausente, como `exports`, é silêncio de Console antigo. */
  navGroups?: InstalledCatalogNavGroup[];
  /**
   * Os modelos de documento que ela declara, como CONTRATO: chave, origem e a forma dos parâmetros —
   * nunca o texto. É contra eles que o passo `render-document` de outra extensão é conferido. Ausente,
   * como `exports`, é silêncio de Console antigo.
   */
  documentTemplates?: DocumentTemplateContract[];
  /**
   * Os presets de campo que ela declara (`data.field.preset`) — a chave e as partes (`mask`, `format`,
   * `validate`), nunca o template nem a regra. É contra eles que o `mask` de um campo de outra extensão
   * é conferido. Ausente, como `exports`, é silêncio de Console antigo.
   */
  fieldPresets?: OfferedFieldPreset[];
}

export interface InstalledCatalogFile {
  version: number;
  projectId: string;
  tenantId: string;
  tenantName: string;
  exportedAt: string;
  /** A versão do CONTRATO do kernel que estava instalada quando o retrato foi tirado. */
  kernelVersion: string;
  /** A versão do Console que o tirou — a única coisa aqui que não vem do banco. */
  consoleVersion: string;
  extensions: InstalledCatalogExtension[];
  screens: InstalledCatalogScreen[];
  lookups: InstalledCatalogList[];
  tagLists: InstalledCatalogList[];
}

/** O retrato lido e conferido, ou a razão de ele não ter podido ser usado. */
export interface InstalledCatalogRead {
  path: string;
  present: boolean;
  snapshot: InstalledCatalogFile | null;
  /** Dias inteiros desde `exportedAt`. `null` quando não há retrato ou a data é ilegível. */
  ageDays: number | null;
  stale: boolean;
  /** O retrato foi tirado por um kernel diferente do que roda aqui. */
  kernelDiffers: boolean;
  /**
   * Se dá para confiar na superfície exportada que o retrato traz. `false` quando alguma extensão
   * chegou SEM a chave `exports` — o Console que o tirou é anterior a ela, e uma lista vazia ali seria
   * lida como "esta extensão não exporta nada", que é uma afirmação que ninguém fez.
   */
  exportsKnown: boolean;
  /** O mesmo, para os grupos da barra lateral: `false` quando alguma extensão chegou sem `navGroups`. */
  navGroupsKnown: boolean;
  /** O mesmo, para os modelos de documento: `false` quando alguma extensão chegou sem `documentTemplates`. */
  documentTemplatesKnown: boolean;
  /** O mesmo, para os presets de campo: `false` quando alguma extensão chegou sem `fieldPresets`. */
  fieldPresetsKnown: boolean;
  /**
   * O mesmo, para as chaves das telas: `false` quando alguma tela chegou sem `keys`. Aí uma chave que
   * só existe na instalação não aparece, e o plano a propõe como nova.
   */
  keysKnown: boolean;
  /** Por que o arquivo não pôde ser usado — arquivo torto, formato de outra época, campo faltando. */
  problems: string[];
}

const ABSENT = (path: string): InstalledCatalogRead => ({
  path,
  present: false,
  snapshot: null,
  ageDays: null,
  stale: false,
  kernelDiffers: false,
  exportsKnown: true,
  navGroupsKnown: true,
  documentTemplatesKnown: true,
  fieldPresetsKnown: true,
  keysKnown: true,
  problems: [],
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;

const text = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const optionalText = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

const FIELD_ORIGINS: readonly FieldOrigin[] = ['builtin', 'plugin', 'design'];

const origin = (value: unknown, fallback: FieldOrigin): FieldOrigin =>
  typeof value === 'string' && (FIELD_ORIGINS as readonly string[]).includes(value)
    ? value as FieldOrigin
    : fallback;

const PARENT_RELATIONS: readonly ParentRelation[] = ['owned', 'related'];

const parentRelation = (value: unknown): ParentRelation | null =>
  typeof value === 'string' && (PARENT_RELATIONS as readonly string[]).includes(value)
    ? value as ParentRelation
    : null;

const readField = (raw: unknown, index: number, screenOrigin: FieldOrigin): InstalledCatalogField | null => {
  const record = asRecord(raw);
  if (record === null) return null;
  const key = text(record.key);
  if (key === '') return null;
  return {
    key,
    label: text(record.label, key),
    type: text(record.type, 'text') as CustomFieldType,
    required: record.required === true,
    order: typeof record.order === 'number' ? record.order : index,
    ...(record.multi === true ? { multi: true } : {}),
    ...(optionalText(record.refEntity) === null ? {} : { refEntity: optionalText(record.refEntity) }),
    ...(optionalText(record.refDenormKey) === null ? {} : { refDenormKey: optionalText(record.refDenormKey) }),
    ...(optionalText(record.lookupCollection) === null ? {} : { lookupCollection: optionalText(record.lookupCollection) }),
    ...(optionalText(record.section) === null ? {} : { section: optionalText(record.section) }),
    origin: origin(record.origin, screenOrigin),
    ...(optionalText(record.ownerPluginId) === null ? {} : { ownerPluginId: optionalText(record.ownerPluginId) }),
    ...(asRecord(record.aggregation) === null ? {} : { aggregation: record.aggregation as FieldAggregation }),
    ...(optionalText(record.compute) === null ? {} : { compute: optionalText(record.compute) }),
    ...(record.unique === true ? { unique: true } : {}),
  };
};

const readNormalization = (value: unknown): RecordKeyNormalization | null => {
  const record = asRecord(value);
  if (record === null) return null;
  const normalization: RecordKeyNormalization = {
    ...(typeof record.trim === 'boolean' ? { trim: record.trim } : {}),
    ...(typeof record.caseInsensitive === 'boolean' ? { caseInsensitive: record.caseInsensitive } : {}),
    ...(optionalText(record.formatPreset) === null ? {} : { formatPreset: optionalText(record.formatPreset) as string }),
  };
  return Object.keys(normalization).length > 0 ? normalization : null;
};

/**
 * Uma chave do retrato. A que não diz o tipo que o kernel conhece, ou não cita campo nenhum, fica de
 * fora: entrar com outro tipo faria o plano comparar uma restrição diferente da instalada.
 */
const readKey = (raw: unknown): RecordKeySpec | null => {
  const record = asRecord(raw);
  if (record === null) return null;
  const name = text(record.name);
  const kind = text(record.kind);
  const fields = list(record.fields).filter((one): one is string => typeof one === 'string' && one !== '');
  if (name === '' || !(RECORD_KEY_KINDS as readonly string[]).includes(kind) || fields.length === 0) return null;
  const scope = text(record.scope);
  const normalize = readNormalization(record.normalize);
  return {
    name,
    kind: kind as RecordKeyKind,
    fields,
    ...((RECORD_KEY_SCOPES as readonly string[]).includes(scope) ? { scope: scope as RecordKeyScope } : {}),
    ...(normalize === null ? {} : { normalize }),
    ...(typeof record.sparse === 'boolean' ? { sparse: record.sparse } : {}),
    ...(optionalText(record.ownerPluginId) === null ? {} : { ownerPluginId: optionalText(record.ownerPluginId) }),
  };
};

const readScreen = (raw: unknown): InstalledCatalogScreen | null => {
  const record = asRecord(raw);
  if (record === null) return null;
  const key = text(record.key);
  if (key === '') return null;
  const screenOrigin = origin(record.origin, 'design');
  return {
    key,
    ...(optionalText(record.sourceId) === null ? {} : { sourceId: optionalText(record.sourceId) }),
    ...(optionalText(record.collection) === null ? {} : { collection: optionalText(record.collection) }),
    titleSingular: text(record.titleSingular, key),
    ...(optionalText(record.titlePlural) === null ? {} : { titlePlural: text(record.titlePlural) }),
    titleFieldKey: text(record.titleFieldKey),
    origin: screenOrigin,
    ...(optionalText(record.ownerPluginId) === null ? {} : { ownerPluginId: optionalText(record.ownerPluginId) }),
    ...(optionalText(record.parentEntity) === null ? {} : { parentEntity: optionalText(record.parentEntity) }),
    ...(optionalText(record.parentFieldKey) === null ? {} : { parentFieldKey: optionalText(record.parentFieldKey) }),
    ...(parentRelation(record.parentRelation) === null ? {} : { parentRelation: parentRelation(record.parentRelation) }),
    ...(optionalText(record.tagCollection) === null ? {} : { tagCollection: optionalText(record.tagCollection) }),
    ...(optionalText(record.eventPrefix) === null ? {} : { eventPrefix: optionalText(record.eventPrefix) }),
    // A chave AUSENTE é o silêncio de um Console antigo; a chave presente e vazia é a resposta "nenhuma".
    ...(Array.isArray(record.keys)
      ? { keys: record.keys.map(readKey).filter((one): one is RecordKeySpec => one !== null) }
      : {}),
    fields: list(record.fields)
      .map((field, index) => readField(field, index, screenOrigin))
      .filter((field): field is InstalledCatalogField => field !== null),
  };
};

const readList = (raw: unknown): InstalledCatalogList | null => {
  const record = asRecord(raw);
  if (record === null) return null;
  const collection = text(record.collection);
  if (collection === '') return null;
  return {
    collection,
    label: text(record.label, collection),
    ...(optionalText(record.ownerPluginId) === null ? {} : { ownerPluginId: optionalText(record.ownerPluginId) }),
  };
};

const EXPORT_KINDS: readonly InstalledCatalogExportKind[] = ['workflow', 'action', 'script', 'unknown'];

const readExport = (raw: unknown): InstalledCatalogExport | null => {
  const record = asRecord(raw);
  if (record === null) return null;
  const id = text(record.id);
  if (id === '') return null;
  const kind = text(record.kind);
  return {
    id,
    kind: (EXPORT_KINDS as readonly string[]).includes(kind) ? kind as InstalledCatalogExportKind : 'unknown',
    name: text(record.name, id),
  };
};

const readTranslations = (value: unknown): Record<string, string> => {
  const record = asRecord(value);
  if (record === null) return {};
  return Object.fromEntries(Object.entries(record)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== ''));
};

const readNavGroup = (raw: unknown): InstalledCatalogNavGroup | null => {
  const record = asRecord(raw);
  if (record === null) return null;
  const key = text(record.key);
  if (key === '') return null;
  return {
    key,
    label: text(record.label, key),
    translations: readTranslations(record.translations),
    order: typeof record.order === 'number' ? record.order : 0,
  };
};

const FIELD_PRESET_SLOTS: readonly FieldPresetSlot[] = ['mask', 'format', 'validate'];

const readFieldPreset = (raw: unknown): OfferedFieldPreset | null => {
  const record = asRecord(raw);
  const key = text(record?.key);
  if (record === null || key === '') return null;
  return {
    key,
    slots: list(record.slots).filter((slot): slot is FieldPresetSlot => FIELD_PRESET_SLOTS.includes(slot as FieldPresetSlot)),
  };
};

const readExtension = (raw: unknown): InstalledCatalogExtension | null => {
  const record = asRecord(raw);
  if (record === null) return null;
  const id = text(record.id);
  if (id === '') return null;
  return {
    id,
    name: text(record.name, id),
    version: text(record.version, '0.0.0'),
    active: record.active !== false,
    // A chave AUSENTE é o silêncio de um Console antigo; a chave presente e vazia é a resposta "nada".
    ...(Array.isArray(record.exports)
      ? { exports: record.exports.map(readExport).filter((one): one is InstalledCatalogExport => one !== null) }
      : {}),
    ...(Array.isArray(record.navGroups)
      ? { navGroups: record.navGroups.map(readNavGroup).filter((one): one is InstalledCatalogNavGroup => one !== null) }
      : {}),
    ...(Array.isArray(record.documentTemplates)
      ? {
          documentTemplates: record.documentTemplates
            .map(documentTemplateContractOf)
            .filter((one): one is DocumentTemplateContract => one !== null),
        }
      : {}),
    ...(Array.isArray(record.fieldPresets)
      ? { fieldPresets: record.fieldPresets.map(readFieldPreset).filter((one): one is OfferedFieldPreset => one !== null) }
      : {}),
  };
};

const daysBetween = (from: Date, to: Date): number =>
  Math.floor((to.getTime() - from.getTime()) / 86_400_000);

export const installedCatalogPath = (root: string): string => join(root, INSTALLED_CATALOG_FILE);

/**
 * Lê o retrato, se ele estiver lá.
 *
 * Arquivo ausente é o caso NORMAL, e não um problema: quem nunca rodou o `export-catalog` continua com
 * exatamente o comportamento de antes. Arquivo torto, de outro formato, ou sem o que identifica de onde
 * veio é RECUSADO com o motivo — meio retrato é pior que nenhum, porque um catálogo incompleto
 * apresentado como completo faz o agente deixar de perguntar.
 */
export const readInstalledCatalog = (root: string, now: Date = new Date()): InstalledCatalogRead => {
  const path = installedCatalogPath(root);
  if (!existsSync(path)) return ABSENT(path);

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {
      ...ABSENT(path),
      present: true,
      problems: [`${INSTALLED_CATALOG_FILE} is not readable JSON, so nothing from the installation was used. `
        + 'Delete it and run "microteia export-catalog --tenant <tenantId>" again.'],
    };
  }

  const record = asRecord(parsed);
  if (record === null) {
    return { ...ABSENT(path), present: true, problems: [`${INSTALLED_CATALOG_FILE} is not an object.`] };
  }

  const version = typeof record.version === 'number' ? record.version : 0;
  if (version !== INSTALLED_CATALOG_VERSION) {
    return {
      ...ABSENT(path),
      present: true,
      problems: [`${INSTALLED_CATALOG_FILE} is format version ${version}, and this kernel reads version `
        + `${INSTALLED_CATALOG_VERSION}. It was ignored. Run "microteia export-catalog --tenant <tenantId>" `
        + 'with the Console that came with this installation.'],
    };
  }

  const projectId = text(record.projectId);
  const tenantId = text(record.tenantId);
  if (projectId === '' || tenantId === '') {
    return {
      ...ABSENT(path),
      present: true,
      problems: [`${INSTALLED_CATALOG_FILE} does not say which project and office it came from, so it cannot `
        + 'be presented as a snapshot of anything. It was ignored.'],
    };
  }

  const exportedAt = text(record.exportedAt);
  const taken = new Date(exportedAt);
  const readable = exportedAt !== '' && !Number.isNaN(taken.getTime());
  const ageDays = readable ? Math.max(0, daysBetween(taken, now)) : null;

  const snapshot: InstalledCatalogFile = {
    version,
    projectId,
    tenantId,
    tenantName: text(record.tenantName, tenantId),
    exportedAt,
    kernelVersion: text(record.kernelVersion, 'unknown'),
    consoleVersion: text(record.consoleVersion, 'unknown'),
    extensions: list(record.extensions)
      .map(readExtension)
      .filter((one): one is InstalledCatalogExtension => one !== null),
    screens: list(record.screens)
      .map(readScreen)
      .filter((one): one is InstalledCatalogScreen => one !== null),
    lookups: list(record.lookups).map(readList).filter((one): one is InstalledCatalogList => one !== null),
    tagLists: list(record.tagLists).map(readList).filter((one): one is InstalledCatalogList => one !== null),
  };

  return {
    path,
    present: true,
    snapshot,
    ageDays,
    stale: ageDays !== null && ageDays >= INSTALLED_CATALOG_STALE_DAYS,
    kernelDiffers: snapshot.kernelVersion !== KERNEL_VERSION,
    exportsKnown: snapshot.extensions.every((one) => one.exports !== undefined),
    navGroupsKnown: snapshot.extensions.every((one) => one.navGroups !== undefined),
    documentTemplatesKnown: snapshot.extensions.every((one) => one.documentTemplates !== undefined),
    fieldPresetsKnown: snapshot.extensions.every((one) => one.fieldPresets !== undefined),
    keysKnown: snapshot.screens.every((one) => one.keys !== undefined),
    problems: readable ? [] : [`${INSTALLED_CATALOG_FILE} has no readable "exportedAt", so there is no telling `
      + 'how old it is. Treat every entity it brings as possibly out of date.'],
  };
};

/**
 * Uma tela do retrato virando a mesma forma que uma tela de `plugin.ts` — é por aqui que ela entra no
 * catálogo pela porta que já existia, e não por um segundo caminho paralelo.
 */
export const installedScreenInput = (screen: InstalledCatalogScreen): CatalogScreenInput => ({
  key: screen.key,
  ...(screen.sourceId === undefined ? {} : { sourceId: screen.sourceId }),
  ...(screen.collection === undefined ? {} : { collection: screen.collection }),
  titleSingular: screen.titleSingular,
  ...(screen.titlePlural === undefined ? {} : { titlePlural: screen.titlePlural }),
  titleFieldKey: screen.titleFieldKey,
  ...(screen.keys === undefined ? {} : { keys: screen.keys }),
  fields: screen.fields.map((field): FieldDefinition => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    order: field.order,
    ...(field.multi === undefined ? {} : { multi: field.multi }),
    ...(field.refEntity === undefined ? {} : { refEntity: field.refEntity }),
    ...(field.refDenormKey === undefined ? {} : { refDenormKey: field.refDenormKey }),
    ...(field.lookupCollection === undefined ? {} : { lookupCollection: field.lookupCollection }),
    ...(field.section === undefined ? {} : { section: field.section }),
    ...(field.aggregation === undefined ? {} : { aggregation: field.aggregation }),
    ...(field.compute === undefined || field.compute === null ? {} : { logic: { compute: field.compute } }),
    ...(field.unique === true ? { unique: true } : {}),
    origin: field.origin,
    ...(field.ownerPluginId === undefined ? {} : { ownerPluginId: field.ownerPluginId }),
  })),
  ...(screen.parentEntity === undefined ? {} : { parentEntity: screen.parentEntity }),
  ...(screen.parentFieldKey === undefined ? {} : { parentFieldKey: screen.parentFieldKey }),
  ...(screen.parentRelation === undefined ? {} : { parentRelation: screen.parentRelation }),
  ...(screen.tagCollection === undefined ? {} : { tagCollection: screen.tagCollection }),
  ...(screen.eventPrefix === undefined ? {} : { eventPrefix: screen.eventPrefix }),
  ...(screen.ownerPluginId === undefined ? {} : { ownerPluginId: screen.ownerPluginId }),
  origin: screen.origin,
  source: 'installation',
});
