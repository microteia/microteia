import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { flagValue } from '../shared/args.js';
import type { ParsedArgs } from '../shared/args.js';
import { CLI_VERSION } from '../shared/paths.js';
import { blank, bullets, heading, info, step, success, warn } from '../shared/ui.js';
import { decodeFields, documentId, listDocuments } from './firestoreRest.js';
import type { FirestoreDocument } from './firestoreRest.js';
import { listTenants, readInstalledExtensions } from './installedExtensions.js';
import type { InstalledExtensionRecord, TenantSummary } from './installedExtensions.js';
import { ENVIRONMENT_FILE, readEnvironment } from './environment.js';
import { EXTENSIONS_DIR } from './pluginWorkspace.js';
import { WORKSPACE_DIR } from './workspace.js';

/**
 * `microteia export-catalog` — o RETRATO do domínio instalado, para o diretório de autoria.
 *
 * O servidor MCP do SDK monta o catálogo a partir dos `plugin.ts` do diretório mais o registro de
 * entidades do kernel. Numa instalação real isso deixa de fora as duas coisas que mais importam: a
 * tela que o escritório criou no Form Design e a extensão de terceiro já instalada. O detector de
 * "campo que pertence a outra entidade conhecida" não podia disparar contra elas, porque para ele elas
 * não existiam.
 *
 * A saída NÃO foi ligar o SDK ao Firestore. `microteia-plugin` é offline por desenho, e arrastar
 * credencial para dentro da ferramenta de autoria trocaria uma cegueira por um problema pior. Quem já
 * fala com o projeto do escritório é o Console — o token vem do `gcloud`, a cada execução, e nada é
 * guardado. Então é o Console que lê e escreve o arquivo, e o SDK apenas o encontra ali.
 *
 * Três decisões que não são preferência:
 *
 * - **O arquivo NÃO mora em `.microteia/`.** Aquele diretório é apagado por inteiro a cada `unpack`,
 *   e um retrato que some na troca de kernel é um retrato que ninguém pode depender de ter. Ele fica
 *   em `extensions/`, ao lado do `microteia.yaml`, que é onde o autor trabalha.
 * - **Ele é gitignorado**, pela conciliação que o SDK já faz do `.gitignore` daquele diretório. Ele
 *   carrega nome de tela e de campo que o escritório digitou: dado do tenant, não artefato do produto.
 * - **`--tenant` é obrigatório.** Um projeto Firebase pode ter vários escritórios, e escolher um por
 *   adivinhação escreveria o vocabulário de um dentro do trabalho de outro. Sem a opção, o comando
 *   LISTA os que existem.
 */

/** O nome é contrato com o SDK, que o procura por este nome — ver `installedCatalog.ts` do kernel. */
export const CATALOG_FILE = 'installed-catalog.json';

/**
 * A versão do FORMATO. Ela existe para que um Console de outra época não seja lido como se falasse a
 * mesma língua: o SDK recusa o que não for exatamente esta, e diz o comando que refaz o arquivo.
 */
export const CATALOG_FORMAT_VERSION = 1;

/**
 * O que viaja de cada campo, e nada além.
 *
 * A linha é ESQUEMA versus CONTEÚDO. Nome, tipo, obrigatoriedade, referência, agregado e expressão
 * descrevem o que a entidade É, e é disso que o catálogo e os detectores precisam. Opção de lista,
 * máscara, texto de ajuda, valor padrão e regra de formulário são conteúdo e apresentação: o catálogo
 * nunca os lê, e cada um deles é mais vocabulário do escritório saindo do banco sem precisar.
 */
export interface CatalogFieldExport {
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
}

export interface CatalogScreenExport {
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
  fields: CatalogFieldExport[];
}

export interface CatalogListExport {
  collection: string;
  label: string;
  ownerPluginId?: string;
}

/**
 * Um artefato que a extensão declara em `manifest.exports` — a superfície que outra extensão pode
 * referenciar como `<pluginId>/<sourceId>`.
 *
 * O `kind` viaja porque é ele que decide ONDE a referência cabe: script em `scriptId`, automação em
 * `targetWorkflowId`. `unknown` é o export declarado que não casa com artefato nenhum do pacote —
 * dizê-lo é melhor que omiti-lo, porque uma referência a ele passaria no portão da instalação, que
 * confere a LISTA, e falharia só na primeira execução.
 *
 * O que NÃO viaja é o que o artefato faz: os passos e o código são comportamento, e o retrato é
 * esquema. O nome e o tipo são contrato.
 */
export interface CatalogExtensionExportedArtifact {
  id: string;
  kind: 'workflow' | 'action' | 'script' | 'unknown';
  name: string;
}

/**
 * Um grupo da barra lateral que a extensão declara (`ui.nav.group`). Viaja porque a CHAVE é contrato:
 * é o que outra extensão escreve para entrar no grupo, e quem autora sem enxergá-la inventa outra — e
 * o menu passa a mostrar dois grupos com o mesmo nome.
 *
 * O nome vai resolvido em cada idioma que o próprio pacote traz, porque é pelo nome que o autor
 * reconhece o grupo; o rótulo literal vai como está, com `translations` vazio.
 */
export interface CatalogExtensionNavGroup {
  key: string;
  label: string;
  translations: Record<string, string>;
  order: number;
}

/**
 * Um modelo de documento que a extensão declara (`document.template`), como CONTRATO: a chave, a origem
 * e a forma de cada parâmetro. Viaja porque outra extensão GERA esse modelo pelo passo
 * `render-document`, com `param.<chave>` e `belongsTo`, e um nome trocado ali só aparece na geração —
 * com o campo em branco, ou com a recusa no clique.
 *
 * O que NÃO viaja é o texto do modelo, o rótulo, a regra e a amostra: é conteúdo, e o passo não os lê.
 */
export interface CatalogExtensionDocumentParameter {
  key: string;
  type: string;
  required?: boolean;
  list?: boolean;
  entityType?: string;
}

export interface CatalogExtensionDocumentTemplate {
  key: string;
  source: 'record' | 'payload';
  parameters: CatalogExtensionDocumentParameter[];
}

export interface CatalogExtensionExport {
  id: string;
  name: string;
  version: string;
  active: boolean;
  /**
   * Sempre escrita, mesmo vazia. É a lista PRESENTE e vazia que diz "esta extensão não exporta nada";
   * a chave ausente é o silêncio de um Console anterior a este campo, e o kernel distingue as duas.
   */
  exports: CatalogExtensionExportedArtifact[];
  /** Sempre escrita, mesmo vazia, pela mesma razão de `exports`. */
  navGroups: CatalogExtensionNavGroup[];
  /** Sempre escrita, mesmo vazia, pela mesma razão de `exports`. */
  documentTemplates: CatalogExtensionDocumentTemplate[];
}

export interface CatalogExport {
  version: number;
  projectId: string;
  tenantId: string;
  tenantName: string;
  exportedAt: string;
  kernelVersion: string;
  consoleVersion: string;
  extensions: CatalogExtensionExport[];
  screens: CatalogScreenExport[];
  lookups: CatalogListExport[];
  tagLists: CatalogListExport[];
}

/** Um documento já decodificado, com o id que a coleção lhe deu. */
export interface CatalogSourceDocument {
  id: string;
  data: Record<string, unknown>;
}

export interface CatalogExportInput {
  projectId: string;
  tenant: TenantSummary;
  kernelVersion: string;
  exportedAt: Date;
  screens: CatalogSourceDocument[];
  lookups: CatalogSourceDocument[];
  tagLists: CatalogSourceDocument[];
  extensions: InstalledExtensionRecord[];
}

const text = (value: unknown): string | undefined =>
  (typeof value === 'string' && value.trim() !== '' ? value : undefined);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  (typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined);

const FIELD_ORIGINS = ['builtin', 'plugin', 'design'];

/**
 * A superfície exportada de uma cópia instalada: os ids de `manifest.exports`, cada um casado com o
 * artefato do pacote que o atende, para ganhar tipo e nome.
 *
 * O Console não alcança `src/` — logo não há `MarketplacePlugin` tipado aqui, e a leitura é do
 * documento cru, como todo o resto deste arquivo. Um export que não casa com nada continua na lista
 * como `unknown`: a extensão está declarando algo que não entrega, e esconder isso do autor apenas
 * adia a descoberta para a primeira execução.
 */
const exportedArtifacts = (extension: InstalledExtensionRecord): CatalogExtensionExportedArtifact[] => {
  const declared = extension.manifest?.exports;
  if (!Array.isArray(declared)) return [];

  const pkg = asRecord(extension.data.package) ?? {};
  const named = new Map<string, CatalogExtensionExportedArtifact>();
  const collect = (raw: unknown, kind: 'workflow' | 'action' | 'script'): void => {
    for (const one of Array.isArray(raw) ? raw : []) {
      const record = asRecord(one);
      const id = text(record?.templateId);
      if (id === undefined || named.has(id)) continue;
      named.set(id, { id, kind, name: text(record?.name) ?? text(record?.title) ?? id });
    }
  };
  collect(pkg.workflows, 'workflow');
  collect(pkg.actions, 'action');
  collect(pkg.scripts, 'script');

  return declared
    .filter((id): id is string => typeof id === 'string' && id !== '')
    .map((id) => named.get(id) ?? { id, kind: 'unknown' as const, name: id })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
};

const NAV_GROUP_POINT = 'ui.nav.group';
const MESSAGES_POINT = 'i18n.messages';
const DEFAULT_LOCALE = 'en';
const MESSAGE_REFERENCE = /^@([a-z0-9.-]+)\/(.+)$/;

/**
 * Os grupos da barra lateral de uma cópia instalada, com o nome resolvido pelos `i18n.messages` do
 * próprio manifesto. É a mesma leitura que `declaredNavGroupsOf` faz no kernel, repetida porque o
 * Console não alcança `src/` — e é o teste que atravessa a fronteira que confere as duas.
 */
const navGroupsOf = (extension: InstalledExtensionRecord): CatalogExtensionNavGroup[] => {
  const contributes = Array.isArray(extension.manifest?.contributes) ? extension.manifest.contributes : [];
  const contributions = contributes.map(asRecord).filter((one): one is Record<string, unknown> => one !== undefined);
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
    .flatMap((one): CatalogExtensionNavGroup[] => {
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

const documentParameterOf = (raw: unknown): CatalogExtensionDocumentParameter[] => {
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

/**
 * Os modelos de documento de uma cópia instalada, como contrato. É a mesma leitura que
 * `documentTemplateContractOf` faz no kernel, repetida porque o Console não alcança `src/` — e é o
 * teste que atravessa a fronteira que confere as duas.
 */
const documentTemplatesOf = (extension: InstalledExtensionRecord): CatalogExtensionDocumentTemplate[] => {
  const contributes = Array.isArray(extension.manifest?.contributes) ? extension.manifest.contributes : [];
  return contributes
    .map(asRecord)
    .filter((one): one is Record<string, unknown> => one?.point === DOCUMENT_TEMPLATE_POINT)
    .flatMap((one): CatalogExtensionDocumentTemplate[] => {
      const metadata = asRecord(one.metadata);
      const key = text(metadata?.key);
      if (metadata === undefined || key === undefined) return [];
      return [{
        key,
        source: metadata.source === 'payload' ? 'payload' : 'record',
        parameters: (Array.isArray(metadata.parameters) ? metadata.parameters : []).flatMap(documentParameterOf),
      }];
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
};

/**
 * A mesma dedução que a aplicação faz ao ler a tela (`screenDefinitionMapper.ts`): o `origin` gravado
 * quando ele existe, senão `plugin` para quem tem dono e `design` para o que o escritório criou. Ela é
 * repetida aqui porque o Console não alcança `src/` — e é conferida contra a instalação real por teste.
 */
const originOf = (data: Record<string, unknown>, fallback: string): string => {
  const declared = text(data.origin);
  if (declared !== undefined && FIELD_ORIGINS.includes(declared)) return declared;
  return text(data.ownerPluginId) !== undefined ? 'plugin' : fallback;
};

const fieldExport = (raw: unknown, index: number, screenOrigin: string): CatalogFieldExport | null => {
  const field = asRecord(raw);
  if (field === undefined) return null;
  const key = text(field.key);
  if (key === undefined) return null;

  const logic = asRecord(field.logic);
  const compute = text(logic?.compute);

  return {
    key,
    label: text(field.label) ?? key,
    type: text(field.type) ?? 'text',
    required: field.required === true,
    order: typeof field.order === 'number' ? field.order : index,
    ...(field.multi === true ? { multi: true } : {}),
    ...(text(field.refEntity) === undefined ? {} : { refEntity: text(field.refEntity) as string }),
    ...(text(field.refDenormKey) === undefined ? {} : { refDenormKey: text(field.refDenormKey) as string }),
    ...(text(field.lookupCollection) === undefined ? {} : { lookupCollection: text(field.lookupCollection) as string }),
    ...(text(field.section) === undefined ? {} : { section: text(field.section) as string }),
    origin: originOf(field, screenOrigin),
    ...(text(field.ownerPluginId) === undefined ? {} : { ownerPluginId: text(field.ownerPluginId) as string }),
    ...(asRecord(field.aggregation) === undefined ? {} : { aggregation: asRecord(field.aggregation) as Record<string, unknown> }),
    ...(compute === undefined ? {} : { compute }),
  };
};

const screenExport = (document: CatalogSourceDocument): CatalogScreenExport => {
  const data = document.data;
  const origin = originOf(data, 'design');
  const fields = Array.isArray(data.fields) ? data.fields : [];

  return {
    key: document.id,
    ...(text(data.sourceId) === undefined ? {} : { sourceId: text(data.sourceId) as string }),
    ...(text(data.dataCollection) === undefined ? {} : { collection: text(data.dataCollection) as string }),
    titleSingular: text(data.titleSingular) ?? document.id,
    ...(text(data.titlePlural) === undefined ? {} : { titlePlural: text(data.titlePlural) as string }),
    titleFieldKey: text(data.titleFieldKey) ?? '',
    origin,
    ...(text(data.ownerPluginId) === undefined ? {} : { ownerPluginId: text(data.ownerPluginId) as string }),
    ...(text(data.parentEntity) === undefined ? {} : { parentEntity: text(data.parentEntity) as string }),
    ...(text(data.parentFieldKey) === undefined ? {} : { parentFieldKey: text(data.parentFieldKey) as string }),
    ...(text(data.parentRelation) === undefined ? {} : { parentRelation: text(data.parentRelation) as string }),
    ...(text(data.tagCollection) === undefined ? {} : { tagCollection: text(data.tagCollection) as string }),
    ...(text(data.eventPrefix) === undefined ? {} : { eventPrefix: text(data.eventPrefix) as string }),
    fields: fields
      .map((field, index) => fieldExport(field, index, origin))
      .filter((field): field is CatalogFieldExport => field !== null),
  };
};

/**
 * O id do documento É o nome da coleção da lista, tanto em `lookupDefinitions` quanto em
 * `tagDefinitions` — a mesma convenção que os repositórios da aplicação usam ao mapeá-las.
 */
const listExport = (document: CatalogSourceDocument): CatalogListExport => ({
  collection: document.id,
  label: text(document.data.label) ?? document.id,
  ...(text(document.data.ownerPluginId) === undefined
    ? {}
    : { ownerPluginId: text(document.data.ownerPluginId) as string }),
});

/**
 * O documento, montado a partir do que foi lido. É PURA de propósito: o que ela produz é o contrato com
 * o SDK, e um contrato que só pode ser exercitado com um projeto Firebase na frente é um contrato que
 * ninguém confere.
 *
 * Uma tela DESLIGADA (`enabled: false`) fica de fora: a coleção dela pode até existir no banco, mas
 * nada da plataforma a desenha, e trazê-la faria o catálogo afirmar que a entidade existe. Uma tela de
 * extensão DESATIVADA continua: o documento dela segue gravado, e é ele que explica um campo que o
 * autor vai encontrar.
 */
export const buildCatalogExport = (input: CatalogExportInput): CatalogExport => ({
  version: CATALOG_FORMAT_VERSION,
  projectId: input.projectId,
  tenantId: input.tenant.id,
  tenantName: input.tenant.name,
  exportedAt: input.exportedAt.toISOString(),
  kernelVersion: input.kernelVersion,
  consoleVersion: CLI_VERSION,
  extensions: input.extensions
    .map((one) => ({
      id: one.id,
      name: one.name,
      version: one.version,
      active: one.active,
      exports: exportedArtifacts(one),
      navGroups: navGroupsOf(one),
      documentTemplates: documentTemplatesOf(one),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  screens: input.screens
    .filter((document) => document.data.enabled !== false)
    .map(screenExport)
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  lookups: input.lookups
    .map(listExport)
    .sort((a, b) => (a.collection < b.collection ? -1 : a.collection > b.collection ? 1 : 0)),
  tagLists: input.tagLists
    .map(listExport)
    .sort((a, b) => (a.collection < b.collection ? -1 : a.collection > b.collection ? 1 : 0)),
});

const decode = (documents: FirestoreDocument[]): CatalogSourceDocument[] =>
  documents.map((document) => ({ id: documentId(document), data: decodeFields(document.fields) }));

const readSubcollection = async (
  projectId: string,
  tenantId: string,
  name: string,
): Promise<CatalogSourceDocument[]> =>
  decode(await listDocuments(projectId, `/tenants/${tenantId}/${name}`));

/**
 * O kernel que está NO LUGAR nesta instalação, e não o que já foi publicado: o retrato descreve o
 * contrato contra o qual o autor compila agora. Ausente, o SDK dirá que não sabe — o que é melhor que
 * carimbar uma versão inventada.
 */
const installedKernelVersion = async (root: string): Promise<string> => {
  const path = join(root, WORKSPACE_DIR, 'install', 'manifest.json');
  if (!existsSync(path)) return 'unknown';
  try {
    const manifest = JSON.parse(await readFile(path, 'utf8')) as { kernelVersion?: string };
    return typeof manifest.kernelVersion === 'string' ? manifest.kernelVersion : 'unknown';
  } catch {
    return 'unknown';
  }
};

/**
 * O arquivo é gitignorado pela conciliação que o SDK faz do `.gitignore` de `extensions/` — este
 * comando não escreve naquele arquivo, porque a política é de lá. O que ele faz é OLHAR: se a linha
 * ainda não chegou (um diretório sincronizado por um kernel anterior), diz qual comando a traz, em vez
 * de deixar o retrato pronto para ser commitado sem ninguém notar.
 */
const checkIgnored = async (directory: string): Promise<void> => {
  const path = join(directory, '.gitignore');
  if (!existsSync(path)) return;
  const lines = (await readFile(path, 'utf8')).split('\n').map((line) => line.trim());
  if (lines.includes(CATALOG_FILE) || lines.includes('*.json')) return;

  warn(`${relative(process.cwd(), path) || '.gitignore'} does not ignore ${CATALOG_FILE}.`);
  info('  It carries screen and field names the office typed, which is tenant data and does not belong');
  info(`  in an extension repository. Run "npm run sync" in ${EXTENSIONS_DIR}/ to get the line, or add it`);
  info('  by hand.');
};

const listAndStop = (tenants: TenantSummary[], projectId: string): void => {
  if (tenants.length === 0) {
    warn(`${projectId} has no office yet, so there is no catalog to export.`);
    info('  An office is created the first time somebody signs in to the application.');
    blank();
    return;
  }

  info(`${projectId} has ${tenants.length} office(s). Pick one:`);
  bullets(tenants.map((tenant) => `${tenant.name} — microteia export-catalog --tenant ${tenant.id}`));
  blank();
  info('The export is per office because screens, lists and tag lists are per office: exporting the');
  info('wrong one would put another office\'s vocabulary inside your extension work.');
  blank();
};

export const exportCatalog = async (args: ParsedArgs): Promise<void> => {
  const file = resolve(flagValue(args, 'file') ?? join(process.cwd(), ENVIRONMENT_FILE));
  const root = dirname(file);
  const environment = await readEnvironment(file);
  const projectId = environment.firebase.projectId;

  if (projectId === null) {
    throw new Error('This installation is not connected yet. Run "microteia connect --project <id>".');
  }

  heading(`Exporting the installed catalog from ${projectId}`);

  const tenants = await listTenants(projectId);
  const wanted = flagValue(args, 'tenant');

  if (wanted === undefined) {
    listAndStop(tenants, projectId);
    return;
  }

  const tenant = tenants.find((one) => one.id === wanted);
  if (tenant === undefined) {
    throw new Error(
      `${projectId} has no office with id "${wanted}".\n`
      + `  Offices in this project: ${tenants.length === 0 ? '(none)' : tenants.map((one) => `${one.name} (${one.id})`).join(', ')}`,
    );
  }

  const output = flagValue(args, 'output');
  const directory = join(root, EXTENSIONS_DIR);

  if (output === undefined && !existsSync(directory)) {
    throw new Error(
      `There is no ${EXTENSIONS_DIR}/ in this installation, and that is where the catalog belongs — it\n`
      + '  exists to answer the authoring tools, and nothing else reads it.\n'
      + '  Run "microteia plugin-init" first, or pass --output <path> to put it somewhere else.',
    );
  }

  const target = output === undefined ? join(directory, CATALOG_FILE) : resolve(output);

  step(1, 2, `Reading what ${tenant.name} has`);
  const [screens, lookups, tagLists, extensions] = await Promise.all([
    readSubcollection(projectId, tenant.id, 'screenDefinitions'),
    readSubcollection(projectId, tenant.id, 'lookupDefinitions'),
    readSubcollection(projectId, tenant.id, 'tagDefinitions'),
    readInstalledExtensions(projectId, tenant.id),
  ]);

  const document = buildCatalogExport({
    projectId,
    tenant,
    kernelVersion: await installedKernelVersion(root),
    exportedAt: new Date(),
    screens,
    lookups,
    tagLists,
    extensions,
  });

  step(2, 2, 'Writing the snapshot');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(document, null, 2)}\n`);

  const fromExtensions = document.screens.filter((screen) => screen.origin === 'plugin').length;
  success(`${relative(process.cwd(), target) || CATALOG_FILE} — ${document.screens.length} screen(s), `
    + `${document.lookups.length} list(s), ${document.tagLists.length} tag list(s)`);
  info(`  ${fromExtensions} screen(s) come from the ${document.extensions.length} installed extension(s); `
    + `the rest the office built itself.`);
  const exported = document.extensions.reduce((total, one) => total + one.exports.length, 0);
  info(`  ${exported} artifact(s) are declared for other extensions to reference as <extension-id>/<id>.`);
  const groups = document.extensions.reduce((total, one) => total + one.navGroups.length, 0);
  info(`  ${groups} sidebar group(s) are declared, by key, for other extensions to join.`);
  const templates = document.extensions.reduce((total, one) => total + one.documentTemplates.length, 0);
  info(`  ${templates} document template(s) are declared, with the shape of their parameters, for other extensions to generate.`);

  blank();
  await checkIgnored(directory);
  info('It is a SNAPSHOT, and it says so: the authoring tools report when it was taken and warn when it');
  info('is old. Nothing keeps it in step with the office — run this again after screens change there.');
  blank();
  info('What it deliberately leaves out: records, the values inside a list of options or a tag list,');
  info('members and permissions, what a workflow, script or action DOES, secrets and settings. It');
  info('describes what the entities ARE, and nothing an office typed into them. What each extension');
  info('declares in "exports" travels: that is the surface another extension may reference.');
  blank();
};
