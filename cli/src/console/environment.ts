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
  kernel: { version: string | null };
  /**
   * Quais Cloud Functions de EXTENSÃO já foram deployadas neste projeto. Fica aqui, e não no banco,
   * porque é estado da instalação e não do escritório — e é o que permite ao `provision` deployar só o
   * delta e reconhecer o que ficou órfão depois de uma desinstalação.
   *
   * Uma lista num escalar separado por vírgula porque o leitor de YAML daqui entende mapas de dois
   * níveis e escalares, e trazer sequências para guardar meia dúzia de nomes seria pagar caro pela
   * generalidade.
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
  };
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
    kernel: { version: optional('kernel', 'version') },
    backend: {
      functions: optional('backend', 'functions'),
      parameters: optional('backend', 'parameters'),
    },
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
  version: ${quote(environment.kernel.version)}

backend:
  # Cloud Functions deployed because an installed extension asked for them. Managed by
  # "microteia provision" — editing it by hand only makes the next run deploy or keep the wrong set.
  functions: ${quote(environment.backend.functions)}
  # A fingerprint of each backend setting already applied from .env.<projectId> (next to this file).
  # It is how
  # "microteia provision" notices a setting filled in after the deploy and redeploys the functions
  # that carry it. It holds no value, only a salted digest of each one — editing it by hand only makes
  # the next run redeploy, or skip, the wrong set.
  parameters: ${quote(environment.backend.parameters)}
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
