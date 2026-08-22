import { capture, captureOrThrow } from '../shared/run.js';

/**
 * Tudo aqui passa pelo `firebase` oficial. O Console não implementa autenticação própria e nunca vê
 * credencial do cliente: quem está logado é quem rodou `firebase login`, e o projeto é dele.
 */

export const FIREBASE_BIN = 'firebase';

export interface WebAppSummary {
  appId: string;
  displayName: string;
}

export const parseJson = (raw: string): unknown => {
  // O `firebase --json` às vezes imprime aviso antes do JSON; o objeto começa na primeira chave.
  const start = raw.indexOf('{');
  if (start === -1) throw new Error(`Expected JSON from the Firebase CLI, got:\n${raw.trim()}`);
  return JSON.parse(raw.slice(start)) as unknown;
};

/**
 * Procura recursivamente o objeto que contém a configuração do SDK. O `apps:sdkconfig` já mudou o
 * formato de saída entre versões do `firebase`, e casar a forma exata quebraria a cada atualização
 * do CLI do cliente — que não é uma versão que possamos fixar.
 */
const findSdkConfig = (value: unknown): Record<string, string> | null => {
  if (value === null || typeof value !== 'object') return null;

  if (!Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.apiKey === 'string' && typeof record.projectId === 'string') {
      const config: Record<string, string> = {};
      for (const [key, entry] of Object.entries(record)) {
        if (typeof entry === 'string') config[key] = entry;
      }
      return config;
    }
  }

  for (const entry of Array.isArray(value) ? value : Object.values(value as object)) {
    const found = findSdkConfig(entry);
    if (found !== null) return found;
  }

  return null;
};

export const assertFirebaseCli = async (): Promise<string> => {
  const result = await capture(FIREBASE_BIN, ['--version']);
  if (result.code !== 0) {
    throw new Error(
      'The Firebase CLI is required and was not found.\n'
      + 'Install it with: npm install -g firebase-tools',
    );
  }
  return result.stdout.trim().split('\n')[0];
};

export const assertLoggedIn = async (): Promise<void> => {
  const result = await capture(FIREBASE_BIN, ['login:list']);
  const output = `${result.stdout}${result.stderr}`;

  if (result.code !== 0 || /no authorized accounts/i.test(output)) {
    throw new Error('You are not signed in to Firebase. Run: firebase login');
  }
};

export const listWebApps = async (projectId: string): Promise<WebAppSummary[]> => {
  const result = await capture(FIREBASE_BIN, ['apps:list', 'WEB', '--project', projectId, '--json']);

  if (result.code !== 0) {
    throw new Error(
      `Cannot reach Firebase project "${projectId}".\n`
      + 'Check that the project id is correct and that the signed-in account has access to it.\n'
      + `${result.stderr.trim()}`,
    );
  }

  const parsed = parseJson(result.stdout) as { result?: unknown };
  const apps = Array.isArray(parsed.result) ? parsed.result : [];

  return apps
    .filter((app): app is Record<string, unknown> => app !== null && typeof app === 'object')
    .map((app) => ({
      appId: String(app.appId ?? ''),
      displayName: String(app.displayName ?? ''),
    }))
    .filter((app) => app.appId !== '');
};

export const createWebApp = async (projectId: string, displayName: string): Promise<string> => {
  const stdout = await captureOrThrow(
    FIREBASE_BIN,
    ['apps:create', 'WEB', displayName, '--project', projectId, '--json'],
  );
  const config = findSdkConfig(parseJson(stdout));
  if (config !== null && config.appId !== undefined) return config.appId;

  const parsed = parseJson(stdout) as { result?: { appId?: unknown } };
  const appId = parsed.result?.appId;
  if (typeof appId !== 'string') throw new Error('Firebase did not return an app id for the new web app.');
  return appId;
};

export const webAppSdkConfig = async (
  projectId: string,
  appId: string,
): Promise<Record<string, string>> => {
  const stdout = await captureOrThrow(
    FIREBASE_BIN,
    ['apps:sdkconfig', 'WEB', appId, '--project', projectId, '--json'],
  );

  const config = findSdkConfig(parseJson(stdout));
  if (config === null) {
    throw new Error(`Could not read the web SDK configuration for app ${appId}.`);
  }
  return config;
};
