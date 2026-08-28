import { readFile, writeFile } from 'node:fs/promises';

/**
 * Um Environment é UMA instalação da Microteia associada a UM projeto Firebase. Nada além disso por
 * enquanto: organização, staging e promoção entre ambientes são conceitos que ainda não existem, e
 * inventá-los agora seria decidir sem saber.
 */
export interface Environment {
  project: { name: string };
  environment: { id: string; name: string };
  firebase: { projectId: string | null; region: string };
  /**
   * `version` é o kernel EM VIGOR nesta instalação — quem o grava é o `unpack`, que é o comando que o
   * põe no lugar. `deployed` é o que já foi publicado no projeto, gravado pelo `deploy`.
   *
   * São dois porque a separação entre `unpack` e `deploy` é o contrato: existe um intervalo legítimo em
   * que o pacote está no lugar e não foi publicado. Um campo só mentia numa das duas pontas — e mentia
   * na que se olha, porque o `MICROTEIA.md` reescrito pelo `unpack` já anunciava a versão nova enquanto
   * o `microteia.yaml` ao lado dele seguia na anterior.
   */
  kernel: { version: string | null; deployed: string | null };
  /**
   * Quais Cloud Functions de EXTENSÃO já foram deployadas neste projeto, e de QUEM. Fica aqui, e não no
   * banco, porque é estado da instalação e não do escritório — e é o que permite ao `provision`
   * deployar só o delta e reconhecer o que ficou órfão depois de uma desinstalação.
   *
   * `nome@pluginId` separado por vírgula — ver `appliedFunctions.ts`, que o lê e o escreve. O escalar é
   * porque o leitor de YAML daqui entende mapas de dois níveis e escalares, e trazer sequências para
   * guardar meia dúzia de pares seria pagar caro pela generalidade. Uma entrada sem `@` é o que uma
   * instalação anterior ao dono gravou, e continua valendo.
   */
  backend: {
    functions: string | null;
    /**
     * Uma impressão digital por parâmetro de backend já aplicado (`NOME:digest`), para o
     * provisionamento reconhecer o valor que foi preenchido ou trocado DEPOIS do deploy — ver
     * `backendParameters.ts`. Sem isso, a function deployada continua com o valor anterior e nenhum
     * comando repara nisso.
     */
    parameters: string | null;
    /**
     * Os índices compostos declarados por causa de uma extensão — ver `backendIndexes.ts`. Fica na
     * RAIZ porque tem de sobreviver ao `unpack`, que apaga `.microteia/install/` inteiro e devolve o
     * `firestore.indexes.json` do pacote, que é só a baseline.
     */
    indexes: string | null;
  };
  /**
   * As extensões que a instalação carrega ANTES do login — os pacotes compilados que `deploy` carimba
   * em `microteia-extensions.js`. É por aqui que um SSO chega à tela de entrada: ali não há escritório,
   * logo não há como ler o que um escritório instalou.
   *
   * É uma lista de CAMINHOS, e é deliberado que seja explícita. Varrer `extensions/` poria no ar um
   * rascunho de autoria — aquele diretório é onde se escreve, não o que roda. Carimbar é um ato, e
   * escrever o caminho aqui é o ato.
   *
   * Escalar separado por vírgula, como `backend.functions`, pela mesma razão: o leitor de YAML daqui
   * entende mapas de dois níveis e escalares.
   */
  login: { extensions: string | null };
}

export const ENVIRONMENT_FILE = 'microteia.yaml';

/**
 * O YAML aqui é um SUBCONJUNTO deliberado: mapas de dois níveis com valores escalares, que é a forma
 * exata deste arquivo. Não há biblioteca de YAML no repositório, e trazer uma para ler quatro seções
 * seria pagar uma dependência pela generalidade que não vamos usar. O que o leitor não entende ele
 * REJEITA com o número da linha, em vez de adivinhar.
 */
const unquote = (raw: string): string | null => {
  const value = raw.trim();
  if (value === '' || value === 'null' || value === '~') return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return value;
};

const needsQuotes = (value: string): boolean =>
  value === ''
  || /^[-?:,[\]{}#&*!|>'"%@`]/.test(value)
  || value.includes(': ')
  || value.includes(' #')
  || /^(true|false|null|yes|no|on|off)$/i.test(value)
  || /^-?\d+(\.\d+)?$/.test(value)
  || value.trim() !== value;

const quote = (value: string | null): string => {
  if (value === null) return 'null';
  if (!needsQuotes(value)) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
};

export const parseEnvironment = (source: string): Environment => {
  const sections = new Map<string, Map<string, string | null>>();
  let current: Map<string, string | null> | null = null;

  const lines = source.split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    // O comentário pode estar INDENTADO: o arquivo que este módulo gera tem um dentro da seção
    // `firebase`, e olhar só a coluna zero faria o leitor rejeitar o que ele mesmo escreveu.
    const withoutComment = line.trim().startsWith('#') ? '' : line;
    if (withoutComment.trim() === '') continue;

    const topLevel = withoutComment.match(/^([A-Za-z][A-Za-z0-9_]*):\s*$/);
    if (topLevel !== null) {
      current = new Map();
      sections.set(topLevel[1], current);
      continue;
    }

    const entry = withoutComment.match(/^ {2}([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    if (entry !== null) {
      if (current === null) {
        throw new Error(`${ENVIRONMENT_FILE} line ${index + 1}: entry outside of any section.`);
      }
      current.set(entry[1], unquote(entry[2]));
      continue;
    }

    throw new Error(`${ENVIRONMENT_FILE} line ${index + 1}: unsupported syntax: ${line.trim()}`);
  }

  const required = (section: string, key: string): string => {
    const value = sections.get(section)?.get(key);
    if (value === undefined || value === null || value === '') {
      throw new Error(`${ENVIRONMENT_FILE} is missing ${section}.${key}.`);
    }
    return value;
  };

  const optional = (section: string, key: string): string | null =>
    sections.get(section)?.get(key) ?? null;

  return {
    project: { name: required('project', 'name') },
    environment: {
      id: required('environment', 'id'),
      name: required('environment', 'name'),
    },
    firebase: {
      projectId: optional('firebase', 'projectId'),
      region: required('firebase', 'region'),
    },
    kernel: {
      version: optional('kernel', 'version'),
      deployed: optional('kernel', 'deployed'),
    },
    backend: {
      functions: optional('backend', 'functions'),
      parameters: optional('backend', 'parameters'),
      indexes: optional('backend', 'indexes'),
    },
    login: { extensions: optional('login', 'extensions') },
  };
};

export const serializeEnvironment = (environment: Environment): string => `# Microteia installation.
#
# Created by "microteia init" and completed by "microteia connect" and "microteia deploy".
# It describes ONE installation bound to ONE Firebase project. It holds no credentials and is safe
# to keep next to your own Cloud Functions — but it is specific to this installation, so it does not
# belong in a shared repository.

project:
  name: ${quote(environment.project.name)}

environment:
  id: ${quote(environment.environment.id)}
  name: ${quote(environment.environment.name)}

firebase:
  projectId: ${quote(environment.firebase.projectId)}
  # The region the kernel is compiled for. Cloud Functions are pinned to it, and Firestore must be
  # in the same region or its triggers will never fire. Changing it here does not move anything.
  region: ${quote(environment.firebase.region)}

kernel:
  # The version in place in this installation, written by "microteia unpack".
  version: ${quote(environment.kernel.version)}
  # The version already published to the Firebase project, written by "microteia deploy". It trails
  # the one above between taking a package and publishing it, which is what those two commands are
  # separate for.
  deployed: ${quote(environment.kernel.deployed)}

backend:
  # Cloud Functions deployed because an installed extension asked for them. Managed by
  # "microteia provision" — editing it by hand only makes the next run deploy or keep the wrong set.
  functions: ${quote(environment.backend.functions)}
  # A fingerprint of each backend setting already applied from .env.<projectId> (next to this file).
  # It is how "microteia provision" notices a setting filled in after the deploy and redeploys the
  # functions that carry it. It holds no value, only a salted digest of each one — editing it by hand only makes
  # the next run redeploy, or skip, the wrong set.
  parameters: ${quote(environment.backend.parameters)}
  # Composite indexes declared because an installed extension asked for them. It has to live here,
  # and not only in the unpacked package, because "microteia unpack" replaces that whole directory
  # and the package carries only the kernel's own indexes. Without it, a kernel upgrade made
  # "firebase deploy" offer to delete the indexes of every extension. Managed by
  # "microteia provision".
  indexes: ${quote(environment.backend.indexes)}

login:
  # Compiled extension packages (.json) to load BEFORE anyone signs in — this is how a corporate SSO
  # reaches the sign-in screen, since there is no organization to read it from yet. Comma-separated
  # paths, relative to this file. "microteia deploy" stamps them into microteia-extensions.js and
  # refuses a package that contributes to none of the points that work before sign-in.
  #
  # Nothing stamped here runs JavaScript: the packages load as untrusted, so only declarations apply.
  # To USE an extension inside the organization, install it from the Extensions screen instead.
  extensions: ${quote(environment.login.extensions)}
`;

export const readEnvironment = async (path: string): Promise<Environment> => {
  try {
    return parseEnvironment(await readFile(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`No ${ENVIRONMENT_FILE} here. Run "microteia init" first.`, { cause: error });
    }
    throw error;
  }
};

export const writeEnvironment = async (path: string, environment: Environment): Promise<void> => {
  await writeFile(path, serializeEnvironment(environment));
};

export const slug = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
