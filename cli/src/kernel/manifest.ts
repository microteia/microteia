import type { FirestoreIndexSpec } from './backendShape.js';

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
  /**
   * TODAS as functions que existem no pacote. Continua sendo a lista completa porque é a fronteira de
   * validação: uma extensão só pode reivindicar o que foi empacotado.
   */
  functions: string[];
  /**
   * As que o `deploy` sobe SEMPRE. O que sobra é reivindicado por extensão (`manifest.backend`) e só
   * sobe quando ela está instalada — empacotar não é deployar.
   */
  baselineFunctions: string[];
  /**
   * Os índices compostos que o pacote já traz. O que uma extensão reivindica saiu daqui, e é esta
   * lista que dá ao `provision` a referência exata do que é do kernel — sem ela, distinguir índice do
   * kernel de índice de extensão desinstalada exigiria adivinhar.
   */
  baselineIndexes: FirestoreIndexSpec[];
  /** Ausente nos pacotes anteriores a 7.51.0, que não conheciam a verificação de alcance. */
  callables?: string[];
  /**
   * Os pontos de extensão que fazem efeito ANTES do login. É contra esta lista que o `deploy` decide
   * se um pacote carimbado tem o que fazer no boot — carimbar um que não contribua para nenhum deles
   * o carregaria sem efeito, e quem o carimbou acreditaria que está no ar.
   *
   * Ela é DERIVADA do kernel e viaja no manifesto justamente para o Console não a conhecer de cor: o
   * Console é versionado separadamente, e uma cópia aqui passaria a descrever o contrato de outra
   * versão em silêncio. Ausente nos pacotes anteriores às extensões carimbadas.
   */
  preLoginPoints?: string[];
  backendParameters: BackendParameter[];
  manualPrerequisites: KernelPrerequisite[];
  /**
   * O SDK de autoria que este pacote carrega, quando carrega. Está aqui para que o `plugin-init`
   * saiba a versão e ache o tarball sem desempacotar nada duas vezes — e para que um pacote
   * ANTERIOR ao SDK seja reconhecido pela ausência, em vez de gerar um `package.json` apontando
   * para um arquivo que não existe.
   */
  sdk?: KernelSdk;
  /**
   * De que commit do repositório-fonte o pacote saiu. É lido pelo `pack` ANTES de qualquer build, e é
   * o que o `publish` marca com a tag `kernel-<versão>` no repositório-fonte — sem ele, saber de que
   * código veio um kernel publicado exigia adivinhar pelo histórico do `package.json`.
   *
   * Ausente nos pacotes anteriores a este campo e nos montados fora de um checkout git.
   */
  source?: KernelSource;
  /**
   * O tamanho e a impressão digital do tarball, presentes SÓ na cópia externa do manifesto — a que fica
   * ao lado do `.tgz` e é publicada com ele. A cópia de dentro do tarball não pode carregá-los: ela
   * entra no arquivo cujo hash seria descrito, e nenhum dos dois números existiria ainda.
   *
   * É a única diferença entre as duas cópias, e é o que permite ao `unpack` conferir o que baixou.
   * Ausente nos pacotes anteriores ao canal de distribuição, e ausente também quando o pacote chegou
   * por caminho de arquivo — ali a conferência não tem contra o que ser feita.
   */
  tarball?: KernelTarball;
}

export interface KernelSource {
  commit: string;
  /**
   * Havia alteração não commitada quando o pacote foi montado. Nesse caso nenhum commit é a fonte do
   * pacote, e o `publish` não marca nenhum: uma tag que aponta para código diferente do publicado é
   * pior que tag nenhuma.
   */
  dirty: boolean;
}

export interface KernelTarball {
  /** O nome do arquivo, não um caminho: onde ele fica é decisão de quem publica. */
  name: string;
  bytes: number;
  sha256: string;
}

export interface KernelSdk {
  version: string;
  /** O contrato Kernel↔plugins contra o qual o autor escreve. */
  kernelVersion: string;
  /** Caminho do tarball dentro do pacote, SEM número de versão — ver `pluginWorkspaceTemplates`. */
  path: string;
}

export const KERNEL_DISTRIBUTION_ID = 'com.microteia.kernel';
/**
 * O Console mínimo que consegue instalar um pacote montado hoje. Sobe junto com uma mudança que o
 * pacote PASSA A DEPENDER.
 *
 * Em `2.0.0`: o arquivo de configuração de backend na raiz da instalação. Um Console `1.0.0`
 * desempacotaria este pacote e escreveria a credencial em `.microteia/install/functions/`, que o upgrade
 * seguinte apaga — recusar é mais barato que isso.
 *
 * Em `2.1.0`: as Cloud Functions do ESCRITÓRIO. O pacote carrega o SDK cujo `create function` gera uma
 * extensão que declara a própria function em `manifest.backend.functions`, e um Console anterior monta
 * essa function dentro do pacote e nunca a deploya — a extensão fica "Backend pendente" para sempre,
 * com a mensagem errada ("this kernel package does not contain"), apontando para o lugar errado. Foi
 * exatamente o que aconteceu quando um `microteia` de PATH, linkado a um Console antigo, provisionou uma
 * instalação montada por um Console novo: nada no relato dizia que o problema era a ferramenta.
 */
export const MINIMUM_CLI_VERSION = '2.1.0';
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
      + 'is not open access: reaching a function is not the same as being allowed to use it. A callable '
      + 'rejects any caller with no signed-in user, and an HTTP endpoint authenticates every request '
      + 'with the credential it was given and refuses everything else.',
    optional: true,
  },
  {
    id: 'portal-identity-signing',
    title: 'Let the functions sign, if an organization signs portal guests in with an identity provider, requires two-step verification or gives guests short-lived document links',
    detail:
      'Two features open a session the server mints with createCustomToken, which signs with the service '
      + 'account the functions run as: a portal guest who signs in through an OpenID Connect provider '
      + 'configured in Settings > Portal > Sign-in, and a member who confirms the code of two-step '
      + 'verification (Organization > Security) — the session that carries the proof. Without the '
      + 'permission the provider confirms the guest, or the code is right, and entering still fails, with '
      + '"iam.serviceAccounts.signBlob" denied in the log of completePortalSignIn or secondFactor. An '
      + 'organization cannot lock itself out by turning two-step verification on before this is done: '
      + 'saving a rule that reaches the person saving it requires that person to have proved the code in '
      + 'that session, which already needs the signature. A third feature signs with the same account: a '
      + 'portal screen that declares documentLinks hands guests signed links that expire in minutes, and '
      + 'without the permission the guest cannot open its documents ("signBlob" denied in the log of '
      + 'getPortalDocumentUrl). With Console 2.31.0 or newer, run microteia '
      + 'grant-signing: it reads the account the functions actually run as, shows what it would change and '
      + 'asks before changing it (--check only reads), and microteia deploy reports when it is missing. By '
      + 'hand: enable the IAM Service Account Credentials API '
      + '(gcloud services enable iamcredentials.googleapis.com --project=<projectId>) and grant the '
      + 'runtime service account the Service Account Token Creator role on itself: gcloud iam '
      + 'service-accounts add-iam-policy-binding <projectNumber>-compute@developer.gserviceaccount.com '
      + '--member=serviceAccount:<projectNumber>-compute@developer.gserviceaccount.com '
      + '--role=roles/iam.serviceAccountTokenCreator --project=<projectId>. Signing in by e-mail link '
      + 'does not need it.',
    optional: true,
  },
  {
    id: 'audit-archive-bucket',
    title: 'Create a bucket with locked retention, if an organization must keep its audit trail as evidence',
    detail:
      'The audit trail stays available for 30 days unless an organization raises it, and an organization '
      + 'can also turn on a daily archive with a hash chain (Audit trail > Retention and archive). The archive '
      + 'needs a bucket of its own, never the default one: gcloud storage buckets create '
      + 'gs://<bucket> --project=<projectId> --location=<region> --uniform-bucket-level-access '
      + '--enable-per-object-retention --retention-period=5y, then gcloud storage buckets update gs://<bucket> '
      + '--lock-retention-period (irreversible: from then on nobody, project owners included, can delete or '
      + 'overwrite an archived day before it is five years old, or shorten the period). Use the longest '
      + 'period any organization here is legally bound to; each organization can lock its own days for '
      + 'longer. Grant the functions\' runtime service account roles/storage.admin on THAT bucket only (it '
      + 'reads the bucket\'s retention settings and sets each day\'s retention, which the object roles '
      + 'do not cover), write AUDIT_ARCHIVE_BUCKET=<bucket> in .env.<projectId> '
      + 'and run microteia deploy --only functions (provision does not carry the platform\'s own settings). What it protects against, and what it does not: a locked bucket stops '
      + 'deletion and rewriting of what was already archived; the chain makes any change visible on '
      + 'verification. A project owner can still alter or delete an audit line in Firestore BEFORE its day '
      + 'is exported (the export runs hourly, about an hour after midnight UTC), turn the archive off (that '
      + 'itself is a CRITICAL audit entry, and the gap shows in the chain), or delete the whole project. '
      + 'Against a rewrite of an unlocked bucket, only the last day\'s hash kept OUTSIDE the project proves '
      + 'anything — the organization can copy it from the archive screen. Without this setting nothing '
      + 'changes for anyone.',
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
 * As functions que o mundo de FORA chama — e é isso que a lista significa, não o construtor delas.
 *
 * Elas se distinguem das de gatilho por uma razão prática: só elas podem ser verificadas de fora, e
 * só nelas a permissão de invocação pública importa. Sem ela a aplicação abre e toda chamada ao
 * servidor falha — parecendo erro de CORS, que manda procurar no lugar errado.
 *
 * `onRequest` entra pela MESMA razão, e não por generosidade: um endpoint HTTP é ainda mais
 * dependente da invocação pública que uma callable, porque quem o consome pode não ser um navegador
 * nosso — é o caso do endpoint MCP, que um cliente de IA chama. O preflight de `callableAccess`
 * serve os dois sem mudar uma linha: ele pergunta `OPTIONS` e confere o cabeçalho de CORS, que um
 * `onRequest` com `cors: true` responde igual.
 *
 * O que NÃO se confunde com isto é o portão de instalação (`functionGate`): lá a distinção entre
 * `onCall` e `onRequest` importa muito, porque uma tem escritório no chamador e a outra não.
 */
export const callableFunctionNames = (source: string): string[] =>
  [...source.matchAll(/export\s+const\s+([a-zA-Z0-9_]+)\s*=\s*(?:onCall|onRequest)\b/g)]
    .map((match) => match[1]);

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

/**
 * Os pontos que valem antes do login, lidos de `domain/schema/plugin/preLoginPoints.ts`. Lista vazia é
 * recusada em vez de aceita: um pacote sem nenhum ponto pré-login recusaria todo carimbo, e a causa
 * (o parser não achou nada) não teria nada a ver com o sintoma.
 */
export const parsePreLoginPoints = (source: string): string[] => {
  const block = source.match(/PRE_LOGIN_POINTS[^=]*=\s*\[([^\]]*)\]/);
  if (block === null) {
    throw new Error('PRE_LOGIN_POINTS not found in domain/schema/plugin/preLoginPoints.ts');
  }
  const points = [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  if (points.length === 0) {
    throw new Error('PRE_LOGIN_POINTS is empty in domain/schema/plugin/preLoginPoints.ts');
  }
  return points;
};

export const parseKernelVersion = (source: string): string => {
  const match = source.match(/KERNEL_VERSION\s*=\s*'([^']+)'/);
  if (match === null) throw new Error('KERNEL_VERSION not found in domain/schema/plugin/kernelVersion.ts');
  return match[1];
};
