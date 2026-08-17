export interface KernelManifestComponent {
  id: string;
  path: string;
}

export interface KernelPrerequisite {
  id: string;
  title: string;
  detail: string;
  optional: boolean;
}

export interface KernelManifest {
  id: string;
  name: string;
  version: string;
  kernelVersion: string;
  minimumCliVersion: string;
  packagedAt: string;
  components: KernelManifestComponent[];
  requires: {
    functionsRegion: string;
    nodeVersion: string;
  };
  functions: string[];
  manualPrerequisites: KernelPrerequisite[];
}

export const KERNEL_DISTRIBUTION_ID = 'com.microteia.kernel';
export const MINIMUM_CLI_VERSION = '1.0.0';
export const DEFAULT_FUNCTIONS_REGION = 'southamerica-east1';
export const REQUIRED_NODE_VERSION = '22';

export const KERNEL_COMPONENTS: KernelManifestComponent[] = [
  { id: 'hosting', path: 'hosting' },
  { id: 'functions', path: 'functions' },
  { id: 'firestore.rules', path: 'firestore.rules' },
  { id: 'firestore.indexes', path: 'firestore.indexes.json' },
  { id: 'storage.rules', path: 'storage.rules' },
];

/**
 * As armadilhas de projeto novo, que até aqui viviam só como prosa no ARCHITECTURE.md (seção "Ao
 * criar um ambiente do zero"). Elas viajam NO MANIFESTO porque quem instala não tem o ARCHITECTURE.md
 * — e porque cada uma delas já custou um diagnóstico errado: a falta do App Engine aparece como um
 * 404 de autenticação de service agent, que manda procurar no lugar errado.
 */
export const MANUAL_PREREQUISITES: KernelPrerequisite[] = [
  {
    id: 'app-engine',
    title: 'Create the App Engine application before the first deploy',
    detail:
      'Run: gcloud app create --region=<region> --project=<projectId>. Without it the functions deploy '
      + 'fails at generateUploadUrl with a 404 about the gcf-admin-robot service agent, which does not '
      + 'mention App Engine at all. The region is set once and can never be changed — use the same '
      + 'region as the functions.',
    optional: false,
  },
  {
    id: 'firestore-location',
    title: 'Create Firestore in the same region as the functions',
    detail:
      'Firestore triggers do not work across regions. The database location is permanent, so getting '
      + 'this wrong means recreating the project.',
    optional: false,
  },
  {
    id: 'auth-provider',
    title: 'Enable the Google sign-in provider in Firebase Authentication',
    detail: 'Firebase console, Authentication, Sign-in method. Without it nobody can log in.',
    optional: false,
  },
  {
    id: 'audit-ttl',
    title: 'Enable the Firestore TTL policy on auditLogs.expiresAt',
    detail:
      'Firestore console, TTL, collection auditLogs, field expiresAt. It cannot be declared in code or '
      + 'rules. Without it audit logs are never expired and grow without bound.',
    optional: false,
  },
  {
    id: 'gmail-integration',
    title: 'Google OAuth client and Pub/Sub topics, only if the Gmail intake is used',
    detail:
      'Create an OAuth 2.0 Web client and the Pub/Sub topics "gmail" and "gmail-watch-renewal", then '
      + 'fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_GMAIL_TOPIC in functions/.env.<projectId>. '
      + 'Credentials are never shared between installations.',
    optional: true,
  },
];

/**
 * Os nomes das Cloud Functions saem de `functions/src/index.ts`, a mesma fonte e o mesmo parse que
 * `scripts/deployLists.test.ts` já usa para garantir que nenhuma function fique fora dos grupos de
 * deploy. Reaproveitar a fonte guardada evita criar uma terceira lista para desatualizar.
 */
export const exportedFunctionNames = (indexSource: string): string[] =>
  [...indexSource.matchAll(/export\s*\{([^}]+)\}/g)]
    .flatMap((match) => match[1].split(','))
    .map((name) => name.trim())
    .filter((name) => name !== '');

export const parseKernelVersion = (source: string): string => {
  const match = source.match(/KERNEL_VERSION\s*=\s*'([^']+)'/);
  if (match === null) throw new Error('KERNEL_VERSION not found in domain/schema/plugin/kernelVersion.ts');
  return match[1];
};
