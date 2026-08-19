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
export const backendFingerprint = (backend?: PluginBackendRequirement): string => JSON.stringify({
  functions: [...(backend?.functions ?? [])].sort(),
  indexes: [...(backend?.indexes ?? [])].map(canonicalIndex).sort(),
  parameters: [...(backend?.parameters ?? [])].sort(),
});

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
        problems.push(`${claim.pluginId} claims function "${name}", which this kernel package does not contain`);
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
