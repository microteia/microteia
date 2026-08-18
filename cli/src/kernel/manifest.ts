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

export interface BackendParameter {
  name: string;
  /** Sem `default` no `defineString`, o firebase-functions EXIGE valor e recusa o deploy sem ele. */
  required: boolean;
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
  /** Ausente nos pacotes anteriores a 7.51.0, que não conheciam a verificação de alcance. */
  callables?: string[];
  backendParameters: BackendParameter[];
  manualPrerequisites: KernelPrerequisite[];
}

export const KERNEL_DISTRIBUTION_ID = 'com.microteia.kernel';
export const MINIMUM_CLI_VERSION = '1.0.0';
export const DEFAULT_FUNCTIONS_REGION = 'southamerica-east1';
/**
 * A região padrão do Google, que NÃO é a nossa. Uma instalação fora dela chama as callables por um
 * host próprio da região, e é lá que a permissão de invocação tem de existir — daí o aviso no
 * `connect`.
 */
export const GOOGLE_DEFAULT_REGION = 'us-central1';
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
    id: 'billing',
    title: 'Put the Firebase project on the Blaze (pay as you go) plan',
    detail:
      'This one comes before everything else: Cloud Functions of the 2nd generation do not exist on the '
      + 'free plan, and neither the App Engine application nor the default Storage bucket can be created '
      + 'without billing. Firebase console, project settings, Usage and billing. Every other step here '
      + 'fails until this is done.',
    optional: false,
  },
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
    id: 'storage-bucket',
    title: 'Set up Cloud Storage for Firebase',
    detail:
      'Firebase console, Storage, "Get Started". Enabling the API is not enough — the default bucket '
      + 'has to be created, and no CLI command does it. Without it the very first deploy stops on the '
      + 'storage rules. Documents attached to records and the cold backup of expired audit logs both '
      + 'live here.',
    optional: false,
  },
  {
    id: 'auth-provider',
    title: 'Enable the Google sign-in provider in Firebase Authentication',
    detail: 'Firebase console, Authentication, Sign-in method. Without it nobody can log in.',
    optional: false,
  },
  {
    id: 'functions-invoker',
    title: 'Allow unauthenticated invocation of the callable functions, if your organization blocks it',
    detail:
      'The deploy grants allUsers the roles/run.invoker role on every callable, and the deploy checks '
      + 'it afterwards. An organization that enforces Domain Restricted Sharing refuses that grant, and '
      + 'then the application loads but every server call fails in the browser with what looks like a '
      + 'CORS error. The fix is one command per function, and the deploy prints the exact list: gcloud '
      + 'run services add-iam-policy-binding <function-name-in-lowercase> --region=<region> '
      + '--project=<projectId> --member=allUsers --role=roles/run.invoker. Unauthenticated invocation '
      + 'is not open access: every callable still rejects callers with no signed-in user.',
    optional: true,
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

/**
 * As callables são as functions que o NAVEGADOR chama. Elas se distinguem das de gatilho por uma
 * razão prática: só elas podem ser verificadas de fora, e só nelas a permissão de invocação pública
 * importa. Sem ela a aplicação abre e toda chamada ao servidor falha — parecendo erro de CORS, que
 * manda procurar no lugar errado.
 */
export const callableFunctionNames = (source: string): string[] =>
  [...source.matchAll(/export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*onCall\b/g)].map((match) => match[1]);

/**
 * Os parâmetros que o backend declara com `defineString`. O `firebase-functions` os valida
 * GLOBALMENTE, e não por function: um parâmetro sem valor e sem default recusa o deploy de TODAS as
 * functions, inclusive as que não têm relação nenhuma com ele. Foi assim que um `GOOGLE_GMAIL_TOPIC`
 * ausente derrubou o deploy de `callAIProxy` numa instalação nova.
 *
 * Por isso a lista é DERIVADA do código, e não copiada de um `.env.example` — que já estava
 * desatualizado quando esta função foi escrita.
 */
export const declaredParametersIn = (source: string): BackendParameter[] =>
  [...source.matchAll(/defineString\(\s*'([A-Z0-9_]+)'\s*(,\s*\{[^}]*\})?\s*\)/g)].map((match) => ({
    name: match[1],
    required: match[2] === undefined || !match[2].includes('default'),
  }));

/** Comparação de versão suficiente para `minimumCliVersion`: três números, sem pré-lançamento. */
export const compareVersions = (left: string, right: string): number => {
  const a = left.split('.').map((part) => Number.parseInt(part, 10));
  const b = right.split('.').map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] || 0) - (b[index] || 0);
    if (difference !== 0) return difference;
  }

  return 0;
};

export const parseKernelVersion = (source: string): string => {
  const match = source.match(/KERNEL_VERSION\s*=\s*'([^']+)'/);
  if (match === null) throw new Error('KERNEL_VERSION not found in domain/schema/plugin/kernelVersion.ts');
  return match[1];
};
