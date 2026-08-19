import { access, appendFile, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { BackendParameter } from '../kernel/manifest.js';

/**
 * As configurações de backend são do ESCRITÓRIO, e por isso moram ao lado do `microteia.yaml` — não
 * dentro de `.microteia/`.
 *
 * Elas moravam lá dentro, e o resultado era perda de dado: o `deploy` substitui o pacote por inteiro
 * (`rm -rf install` e renomeia o staging), preservando explicitamente só `functions/custom` e
 * `functions/node_modules`. Uma credencial preenchida à mão em
 * `.microteia/install/functions/.env.<projectId>` era apagada no deploy seguinte, e o
 * `ensureBackendEnv` a recriava VAZIA — com o agravante de que a impressão digital deixava de bater, o
 * provisionamento marcava as functions como obsoletas e as redeployava com a string vazia. Ou seja: o
 * mecanismo escrito para detectar valor faltando passava a ser a causa dele.
 *
 * O diretório do `microteia.yaml` é o repositório de quem mantém a instalação: é onde ficam as
 * extensões que ele escreve (`extensions/`) e o registro do ambiente. `.microteia/` é descartável por
 * definição — tudo ali se refaz do tarball mais um `connect` —, e nada que uma pessoa digita pode
 * depender de sobreviver a isso.
 *
 * O arquivo que o `firebase-functions` lê continua tendo de estar em `install/functions/`, então ele é
 * uma CÓPIA, escrita no deploy. A fonte é a da raiz.
 */

/** O arquivo que o escritório edita. O nome leva o projeto: uma instalação, um projeto Firebase. */
export const officeEnvName = (projectId: string): string => `.env.${projectId}`;

export const officeEnvPath = (root: string, projectId: string): string =>
  join(root, officeEnvName(projectId));

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const declaredNames = (content: string): Set<string> => new Set(
  content.split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && line.includes('='))
    .map((line) => line.slice(0, line.indexOf('=')).trim()),
);

export interface EnsureEnvResult {
  path: string;
  created: boolean;
  added: string[];
}

/**
 * Garante que o arquivo existe e declara todo parâmetro do pacote.
 *
 * ACRESCENTA o que falta, nunca reescreve: um parâmetro novo numa versão nova do kernel não pode
 * apagar o que já foi preenchido. E o `firebase-functions` valida os `defineString` GLOBALMENTE, não
 * por function — um parâmetro declarado sem entrada no arquivo recusa o deploy de todas elas, e é por
 * isso que a lista é escrita a partir do manifesto em vez de copiada de um template.
 */
export const ensureOfficeEnv = async (
  root: string,
  projectId: string,
  parameters: BackendParameter[],
): Promise<EnsureEnvResult> => {
  const path = officeEnvPath(root, projectId);
  const previous = await exists(path) ? await readFile(path, 'utf8') : null;
  const declared = declaredNames(previous ?? '');
  const missing = parameters.filter((parameter) => !declared.has(parameter.name));

  if (previous !== null && missing.length === 0) return { path, created: false, added: [] };

  const body = `${missing.map((parameter) => `${parameter.name}=`).join('\n')}\n`;

  if (previous === null) {
    const header = `# Backend settings for ${projectId}.\n`
      + '#\n'
      + '# Fill in what the features you use need; the rest stays empty. After changing a value, run\n'
      + '# "microteia provision" — the value is stamped into each Cloud Function at ITS deploy, so a\n'
      + '# function already running keeps the previous one until it is deployed again.\n'
      + '#\n'
      + '# These are credentials. This file is gitignored — keep it that way.\n\n';
    await writeFile(path, `${header}${body}`);
    return { path, created: true, added: missing.map((parameter) => parameter.name) };
  }

  await appendFile(path, `\n${body}`);
  return { path, created: false, added: missing.map((parameter) => parameter.name) };
};

/**
 * Copia a fonte para onde o `firebase-functions` a lê. Sem isso o valor preenchido na raiz não chega a
 * function nenhuma, e a falha aparece só quando a feature é usada.
 */
export const stageOfficeEnv = async (
  root: string,
  projectId: string,
  install: string,
): Promise<boolean> => {
  const source = officeEnvPath(root, projectId);
  // Ausente não é erro: o `provision` pode correr numa instalação que ainda não desempacotou nada, e
  // quem avisa que falta valor é a conferência de parâmetros, com a lista do que falta.
  if (!await exists(source)) return false;

  const target = join(install, 'functions', officeEnvName(projectId));
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  return true;
};

const GITIGNORE_LINES = [
  '# Local Microteia installation: rebuilt from the package plus "microteia connect".',
  '.microteia/',
  '',
  '# Backend settings. These are credentials — never commit them.',
  '.env.*',
];

/** Um padrão que cubra `.env.<projectId>`. Não tenta ser um matcher de gitignore: reconhece os usuais. */
const coversEnvFiles = (content: string): boolean => content
  .split('\n')
  .map((line) => line.trim())
  .some((line) => line === '.env.*' || line === '.env*' || line === '*.env' || line === '.env');

/**
 * Garante que o `.env.<projectId>` não vai para um repositório. O diretório é do escritório e tende a
 * ser versionado — é onde ele guarda as extensões que escreve —, e uma credencial commitada por
 * omissão nossa é o pior desfecho possível deste comando.
 *
 * Cria o arquivo quando não existe. Quando existe, ACRESCENTA só a linha que falta e diz que o fez:
 * reescrever o `.gitignore` de alguém seria pior que o problema.
 */
export const ensureRootGitignore = async (root: string): Promise<'created' | 'appended' | 'ok'> => {
  const path = join(root, '.gitignore');

  if (!await exists(path)) {
    await writeFile(path, `${GITIGNORE_LINES.join('\n')}\n`);
    return 'created';
  }

  const content = await readFile(path, 'utf8');
  if (coversEnvFiles(content)) return 'ok';

  const separator = content.endsWith('\n') ? '' : '\n';
  await appendFile(path, `${separator}\n# Backend settings. These are credentials — never commit them.\n.env.*\n`);
  return 'appended';
};
