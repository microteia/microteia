import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
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
 * guardado. O Console LÊ; quem monta o arquivo é o escritor do SDK instalado (ver `loadCatalogWriter`).
 *
 * O token do `gcloud` é credencial de PROJETO: não passa pelas Security Rules, e por isso exige papel
 * no Firebase inteiro. Quem administra só o escritório tira o mesmo retrato pela aplicação (Extensões →
 * Exportar catálogo), lendo como membro, sob as regras.
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

/**
 * O nome do arquivo que o SDK procura. O valor de verdade vem do SDK carregado; este é só o que se diz
 * ao autor ANTES de o SDK ter sido encontrado.
 */
const CATALOG_FILE_HINT = 'installed-catalog.json';

/** Um documento já decodificado, com o id que a coleção lhe deu — a entrada que o escritor do SDK pede. */
export interface CatalogSourceDocument {
  id: string;
  data: Record<string, unknown>;
}

/**
 * O pedaço do retrato que o Console ainda lê, para o resumo no terminal. A forma inteira é do SDK — o
 * Console não a conhece, e é exatamente isso que o impede de escrever um formato que o kernel não lê.
 */
interface WrittenCatalog {
  screens: { origin: string }[];
  lookups: unknown[];
  tagLists: unknown[];
  extensions: { exports: unknown[]; navGroups: unknown[]; documentTemplates: unknown[] }[];
}

interface CatalogWriterInput {
  projectId: string;
  tenant: TenantSummary;
  kernelVersion: string;
  exportedAt: Date;
  exporter: { tool: 'console'; version: string };
  screens: CatalogSourceDocument[];
  lookups: CatalogSourceDocument[];
  tagLists: CatalogSourceDocument[];
  extensions: CatalogSourceDocument[];
}

/** O que o Console usa do barril do `@microteia/sdk` instalado em `extensions/`. */
export interface CatalogWriter {
  file: string;
  build: (input: CatalogWriterInput) => WrittenCatalog;
  serialize: (snapshot: WrittenCatalog) => string;
}

/**
 * O escritor do retrato, carregado do SDK que o escritório tem em `extensions/`.
 *
 * O Console trazia uma CÓPIA do escritor, e o leitor morava no SDK: os dois lados eram compilados
 * separadamente e casados só por teste, e o Console é distribuído à parte do kernel. Carregar o
 * escritor de onde mora o leitor faz o formato ter um dono só — e é a mesma função que a aplicação usa
 * no botão Exportar catálogo da tela de Extensões.
 *
 * O SDK de um kernel anterior a esse escritor não o tem, e aí o comando RECUSA dizendo como trazê-lo,
 * em vez de escrever com uma cópia que já não é conferida contra nada.
 */
export const loadCatalogWriter = (directory: string): CatalogWriter => {
  if (!existsSync(join(directory, 'node_modules', '@microteia', 'sdk'))) {
    throw new Error(
      `The authoring SDK is not installed in ${EXTENSIONS_DIR}/, and it is the SDK that writes the catalog —\n`
      + '  the same one that reads it. Run "microteia plugin-init" (or "npm install" inside it), then run this again.',
    );
  }

  const sdk = createRequire(join(directory, 'package.json'))('@microteia/sdk') as Record<string, unknown>;
  const build = sdk.buildInstalledCatalog;
  const serialize = sdk.serializeInstalledCatalog;
  const file = sdk.INSTALLED_CATALOG_FILE;

  if (typeof build !== 'function' || typeof serialize !== 'function' || typeof file !== 'string') {
    throw new Error(
      `The authoring SDK in ${EXTENSIONS_DIR}/ is older than the catalog writer this Console relies on.\n`
      + '  Install a newer kernel ("microteia unpack --version latest"), which brings an SDK that writes it.\n'
      + '  Without access to the Firebase project, "Export catalog" on the Extensions screen of the\n'
      + '  application writes the same file, once the installation runs a kernel that has it.',
    );
  }

  return {
    file,
    build: build as CatalogWriter['build'],
    serialize: serialize as CatalogWriter['serialize'],
  };
};

const decode = (documents: FirestoreDocument[]): CatalogSourceDocument[] =>
  documents.map((document) => ({ id: documentId(document), data: decodeFields(document.fields) }));

const readSubcollection = async (
  projectId: string,
  tenantId: string,
  name: string,
): Promise<CatalogSourceDocument[]> =>
  decode(await listDocuments(projectId, `/tenants/${tenantId}/${name}`));

/** A cópia instalada como está gravada: o escritor lê o manifesto de dentro de `package`, como o kernel. */
const storedExtension = (extension: InstalledExtensionRecord): CatalogSourceDocument => ({
  id: extension.documentId,
  data: extension.data,
});

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
const checkIgnored = async (directory: string, catalogFile: string): Promise<void> => {
  const path = join(directory, '.gitignore');
  if (!existsSync(path)) return;
  const lines = (await readFile(path, 'utf8')).split('\n').map((line) => line.trim());
  if (lines.includes(catalogFile) || lines.includes('*.json')) return;

  warn(`${relative(process.cwd(), path) || '.gitignore'} does not ignore ${catalogFile}.`);
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

  // Mesmo com `--output`: o escritor mora no SDK de `extensions/`, e sem ele não há o que escrever.
  if (!existsSync(directory)) {
    throw new Error(
      `There is no ${EXTENSIONS_DIR}/ in this installation, and that is where the catalog belongs — it\n`
      + `  exists to answer the authoring tools, and the SDK there is what writes ${CATALOG_FILE_HINT}.\n`
      + '  Run "microteia plugin-init" first.',
    );
  }

  const writer = loadCatalogWriter(directory);
  const target = output === undefined ? join(directory, writer.file) : resolve(output);

  step(1, 2, `Reading what ${tenant.name} has`);
  const [screens, lookups, tagLists, extensions] = await Promise.all([
    readSubcollection(projectId, tenant.id, 'screenDefinitions'),
    readSubcollection(projectId, tenant.id, 'lookupDefinitions'),
    readSubcollection(projectId, tenant.id, 'tagDefinitions'),
    readInstalledExtensions(projectId, tenant.id),
  ]);

  const document = writer.build({
    projectId,
    tenant,
    kernelVersion: await installedKernelVersion(root),
    exportedAt: new Date(),
    exporter: { tool: 'console', version: CLI_VERSION },
    screens,
    lookups,
    tagLists,
    extensions: extensions.map(storedExtension),
  });

  step(2, 2, 'Writing the snapshot');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, writer.serialize(document));

  const fromExtensions = document.screens.filter((screen) => screen.origin === 'plugin').length;
  success(`${relative(process.cwd(), target) || writer.file} — ${document.screens.length} screen(s), `
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
  await checkIgnored(directory, writer.file);
  info('It is a SNAPSHOT, and it says so: the authoring tools report when it was taken and warn when it');
  info('is old. Nothing keeps it in step with the office — run this again after screens change there.');
  blank();
  info('What it deliberately leaves out: records, the values inside a list of options or a tag list,');
  info('members and permissions, what a workflow, script or action DOES, secrets and settings. It');
  info('describes what the entities ARE, and nothing an office typed into them. What each extension');
  info('declares in "exports" travels: that is the surface another extension may reference.');
  blank();
};
