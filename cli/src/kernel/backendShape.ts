/**
 * A forma de `manifest.backend` redeclarada do lado do Console, pelo mesmo motivo de
 * `console/runtimeConfigShape.ts`: o Console é publicado sem o `src/` do kernel, então não pode
 * importar o contrato. `backendShape.test.ts` amarra as duas pontas — separadas em silêncio, o Console
 * gravaria um fingerprint que o kernel nunca reconhece, e a extensão ficaria pendente para sempre.
 */
export interface FirestoreIndexField {
  fieldPath: string;
  order?: 'ASCENDING' | 'DESCENDING';
  arrayConfig?: 'CONTAINS';
}

export interface FirestoreIndexSpec {
  collectionGroup: string;
  queryScope: 'COLLECTION' | 'COLLECTION_GROUP';
  fields: FirestoreIndexField[];
}

export interface BackendPrerequisite {
  id: string;
  title: string;
  detail: string;
}

export interface PluginBackendRequirement {
  functions?: string[];
  indexes?: FirestoreIndexSpec[];
  parameters?: string[];
  prerequisites?: BackendPrerequisite[];
}

/** Uma exigência com o dono dela — é o dono que o relatório nomeia, e o dono que fica pendente. */
export interface BackendClaim {
  pluginId: string;
  name: string;
  version: string;
  backend: PluginBackendRequirement;
}

const canonicalIndex = (index: FirestoreIndexSpec): string => JSON.stringify([
  index.collectionGroup,
  index.queryScope,
  index.fields.map((field) => [field.fieldPath, field.order ?? '', field.arrayConfig ?? '']),
]);

/** Cópia byte a byte de `domain/schema/plugin/backendRequirement.ts`. Ver o teste de paridade. */
export const backendFingerprint = (backend?: PluginBackendRequirement, sourceHash?: string): string => JSON.stringify({
  functions: [...(backend?.functions ?? [])].sort(),
  indexes: [...(backend?.indexes ?? [])].map(canonicalIndex).sort(),
  parameters: [...(backend?.parameters ?? [])].sort(),
  ...(sourceHash !== undefined ? { code: sourceHash } : {}),
});

/** Ver `BACKEND_PENDING_REASONS` no kernel — a paridade é cobrada por `backendShape.test.ts`. */
export const BACKEND_PENDING_REASONS = [
  'function-source-missing',
  'function-claim-refused',
  'gate-missing',
  'deploy-failed',
  'awaiting-approval',
  'source-invalid',
] as const;

export type BackendPendingReason = typeof BACKEND_PENDING_REASONS[number];

export const hasBackendRequirement = (backend?: PluginBackendRequirement): boolean =>
  (backend?.functions?.length ?? 0) > 0
  || (backend?.indexes?.length ?? 0) > 0
  || (backend?.parameters?.length ?? 0) > 0;

/** Chave de identidade de um índice, para deduplicar e para casar reivindicação com a raiz. */
export const indexKey = canonicalIndex;

export const claimedFunctions = (claims: BackendClaim[]): string[] =>
  [...new Set(claims.flatMap((claim) => claim.backend.functions ?? []))].sort();

export const claimedIndexes = (claims: BackendClaim[]): FirestoreIndexSpec[] => {
  const seen = new Map<string, FirestoreIndexSpec>();
  for (const claim of claims) {
    for (const index of claim.backend.indexes ?? []) seen.set(indexKey(index), index);
  }
  return [...seen.values()];
};

export const claimedParameters = (claims: BackendClaim[]): string[] =>
  [...new Set(claims.flatMap((claim) => claim.backend.parameters ?? []))].sort();

/**
 * O que o `deploy` sobe sempre: tudo o que foi empacotado menos o que alguma extensão reivindica.
 * A ordem de `index.ts` é preservada — é a ordem em que o deploy uma-a-uma acontece.
 */
export const baselineFunctionsOf = (all: string[], claims: BackendClaim[]): string[] => {
  const claimed = new Set(claimedFunctions(claims));
  return all.filter((name) => !claimed.has(name));
};

export const baselineIndexesOf = (
  rootIndexes: FirestoreIndexSpec[],
  claims: BackendClaim[],
): FirestoreIndexSpec[] => {
  const claimed = new Set(claimedIndexes(claims).map(indexKey));
  return rootIndexes.filter((index) => !claimed.has(indexKey(index)));
};

/**
 * Reivindicar function que não foi empacotada, ou a mesma function por duas extensões.
 *
 * A primeira deixaria o deploy nomeando uma function inexistente; a segunda tornaria a remoção por
 * `--prune` indecidível — ninguém sabe de quem é. Vale nos dois lados: no `pack`, contra os templates;
 * no `provision`, contra o que veio do banco do escritório, que é dado e não código.
 */
export const functionClaimProblems = (
  claims: BackendClaim[],
  packagedFunctions: string[],
): string[] => {
  const problems: string[] = [];
  const packaged = new Set(packagedFunctions);
  const owner = new Map<string, string>();

  for (const claim of claims) {
    for (const name of claim.backend.functions ?? []) {
      if (!packaged.has(name)) {
        problems.push(`${claim.pluginId} claims function "${name}", which is not available to deploy`);
      }
      const previous = owner.get(name);
      if (previous !== undefined && previous !== claim.pluginId) {
        problems.push(`function "${name}" is claimed by both ${previous} and ${claim.pluginId}`);
      }
      owner.set(name, claim.pluginId);
    }
  }

  return problems;
};

/**
 * Reivindicar uma function que a PLATAFORMA sobe sempre.
 *
 * É conferência de PROVISIONAMENTO, não de empacotamento, e a assimetria é da própria definição: no
 * `pack` a baseline é DERIVADA (`todas − reivindicadas`), então reivindicar é o que tira o nome dela e
 * a pergunta não existe. Do lado de quem instala a baseline já está decidida e viaja no manifesto, e
 * aí a reivindicação de um nome dela é uma contradição com duas consequências, nenhuma visível: o
 * `deploy` sobe a function de qualquer jeito, e a desinstalação da extensão faz `--prune` apagar um
 * gatilho do produto num escritório que não fez nada.
 */
export const baselineClaimProblems = (
  claims: BackendClaim[],
  baselineFunctions: string[],
): string[] => {
  const baseline = new Set(baselineFunctions);
  return claims.flatMap((claim) => (claim.backend.functions ?? [])
    .filter((name) => baseline.has(name))
    .map((name) => `${claim.pluginId} claims function "${name}", which the platform itself deploys`));
};

/**
 * Reivindicar uma function COMUM do escritório — a que mora em `functions/`, ao lado do
 * `microteia.yaml`.
 *
 * É o mesmo defeito de reivindicar uma function da plataforma, com o mesmo par de consequências
 * invisíveis, e por isso é conferido no mesmo lugar. A comum não tem dono por construção: ela é o lugar
 * de quem serve várias extensões, nenhuma pode declará-la (duas reivindicando o mesmo nome é recusa), e
 * o `deploy` a sobe SEMPRE. Reivindicá-la, então, não muda nada enquanto a extensão está instalada — e
 * no dia em que ela sai, a function vira órfã, `--prune` a apaga, e o `deploy` seguinte a repõe. As
 * outras extensões que dependiam dela perdem o backend numa janela que nada explica, e a fonte continua
 * intacta em `functions/`, sem nada na árvore que sequer sugira o que aconteceu.
 *
 * A assimetria com o `pack` é a mesma de `baselineClaimProblems`: o pacote do kernel não sabe o que o
 * escritório vai escrever em `functions/`, então a pergunta só existe do lado de quem instala.
 */
export const sharedClaimProblems = (
  claims: BackendClaim[],
  sharedFunctions: string[],
): string[] => {
  const shared = new Set(sharedFunctions);
  return claims.flatMap((claim) => (claim.backend.functions ?? [])
    .filter((name) => shared.has(name))
    .map((name) => `${claim.pluginId} claims function "${name}", which is a shared function of this `
      + 'installation'));
};

/**
 * Índice reivindicado que não existe na raiz. É conferência de EMPACOTAMENTO, não de provisionamento:
 * a raiz é o que roda em `microteia-dev` e `curatino`, então uma declaração que não esteja lá deixaria
 * de criar o índice justamente nos nossos ambientes. Do lado de quem instala a pergunta não faz
 * sentido — lá o índice reivindicado é, por construção, o que o `pack` tirou da baseline.
 */
export const indexDeclarationProblems = (
  claims: BackendClaim[],
  rootIndexes: FirestoreIndexSpec[],
): string[] => {
  const rootKeys = new Set(rootIndexes.map(indexKey));
  return claims.flatMap((claim) => (claim.backend.indexes ?? [])
    .filter((index) => !rootKeys.has(indexKey(index)))
    .map((index) => `${claim.pluginId} claims an index on "${index.collectionGroup}" `
      + `(${index.fields.map((field) => field.fieldPath).join(', ')}) that firestore.indexes.json does not declare`));
};

/** As duas conferências juntas — o que o `pack` exige antes de escrever qualquer coisa. */
export const claimProblems = (
  claims: BackendClaim[],
  packagedFunctions: string[],
  rootIndexes: FirestoreIndexSpec[],
): string[] => [
  ...functionClaimProblems(claims, packagedFunctions),
  ...indexDeclarationProblems(claims, rootIndexes),
];

/** As exigências das extensões de primeira parte, lidas dos `extension-templates/*.json` gerados. */
export const claimsFromTemplates = (
  templates: { manifest?: { id?: string; name?: string; version?: string; backend?: PluginBackendRequirement } }[],
): BackendClaim[] => templates
  .filter((template) => hasBackendRequirement(template.manifest?.backend))
  .map((template) => ({
    pluginId: String(template.manifest?.id),
    name: String(template.manifest?.name ?? template.manifest?.id),
    version: String(template.manifest?.version ?? '0.0.0'),
    backend: template.manifest?.backend as PluginBackendRequirement,
  }))
  .sort((a, b) => (a.pluginId < b.pluginId ? -1 : a.pluginId > b.pluginId ? 1 : 0));
