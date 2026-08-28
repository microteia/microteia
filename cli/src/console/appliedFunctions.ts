/**
 * O registro do que o provisionamento já deployou — e de QUEM.
 *
 * Ele morava como uma lista de nomes soltos em `backend.functions` do `microteia.yaml`, e a lista de
 * nomes nunca respondeu à única pergunta que a remoção faz: de quem era esta function? Sem o dono, o
 * relatório de uma órfã é "sobrou `acmeSync`", que não é uma decisão — é um enigma para quem herda a
 * instalação meses depois. Com o dono ele é "`acmeSync` era de `com.acme.crm`, que não está instalada
 * em escritório nenhum", que é.
 *
 * A forma gravada é `nome@pluginId`, separada por vírgula, no mesmo escalar de antes. Uma entrada sem
 * `@` continua sendo lida: é o que uma instalação anterior a este campo gravou, e ela vale — o que
 * falta é o dono, não a function.
 */
export interface AppliedFunction {
  name: string;
  /** O plugin que a reivindicava quando ela subiu. `null` numa instalação anterior ao campo. */
  owner: string | null;
}

export const parseAppliedFunctions = (raw: string | null): AppliedFunction[] => {
  const applied: AppliedFunction[] = [];
  const seen = new Set<string>();

  for (const entry of (raw ?? '').split(',')) {
    const trimmed = entry.trim();
    if (trimmed === '') continue;

    const separator = trimmed.indexOf('@');
    const name = separator === -1 ? trimmed : trimmed.slice(0, separator).trim();
    const owner = separator === -1 ? '' : trimmed.slice(separator + 1).trim();
    if (name === '' || seen.has(name)) continue;

    seen.add(name);
    applied.push({ name, owner: owner === '' ? null : owner });
  }

  return applied;
};

export const serializeAppliedFunctions = (applied: AppliedFunction[]): string | null => {
  const entries = [...applied]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => (entry.owner === null ? entry.name : `${entry.name}@${entry.owner}`));
  return entries.length === 0 ? null : entries.join(',');
};

/** Por que uma function que ninguém exige mais NÃO é órfã. */
export type PreservedReason = 'baseline' | 'unresolved';

export interface PreservedFunction {
  entry: AppliedFunction;
  reason: PreservedReason;
  /** O plugin cuja declaração não pôde ser resolvida — só em `unresolved`. */
  claimant?: string;
}

export interface AppliedClassification {
  /** Alguma extensão instalada continua exigindo. */
  wanted: AppliedFunction[];
  /** Ninguém exige, e nada impede de remover. */
  orphans: AppliedFunction[];
  /** Ninguém exige, e remover seria errado. */
  preserved: PreservedFunction[];
}

/**
 * O que fazer com cada function já aplicada, e a razão de nunca ser só "ninguém pediu".
 *
 * As duas categorias preservadas existem porque "ninguém exige" tem três causas diferentes, e uma
 * delas — a única — autoriza apagar:
 *
 * - `baseline`: a function é da PLATAFORMA. O `deploy` a sobe sempre, independentemente de extensão
 *   nenhuma. Ela só chegou a este registro porque uma extensão reivindicou um nome do kernel, e apagá-la
 *   derrubaria um gatilho do produto num escritório que não fez nada de errado.
 * - `unresolved`: a extensão que a reivindica CONTINUA instalada, e o que falhou foi resolver a
 *   declaração dela — um export renomeado em `extensions/<x>/functions/index.ts`, um upgrade que tirou o
 *   nome do pacote. Apagar aqui é apagar a function de uma extensão viva por causa de um defeito de
 *   configuração que a próxima execução conserta.
 * - órfã de verdade: nome nenhum a reivindica, e nenhuma das duas condições acima vale. Foi
 *   desinstalada de todos os escritórios do projeto.
 */
export const classifyApplied = (input: {
  applied: AppliedFunction[];
  wanted: string[];
  baseline: string[];
  /** Nome de function -> plugin cuja reivindicação foi recusada nesta execução. */
  unresolved: Map<string, string>;
}): AppliedClassification => {
  const wantedNames = new Set(input.wanted);
  const baseline = new Set(input.baseline);
  const classification: AppliedClassification = { wanted: [], orphans: [], preserved: [] };

  for (const entry of input.applied) {
    if (wantedNames.has(entry.name)) {
      classification.wanted.push(entry);
      continue;
    }
    if (baseline.has(entry.name)) {
      classification.preserved.push({ entry, reason: 'baseline' });
      continue;
    }
    const claimant = input.unresolved.get(entry.name);
    if (claimant !== undefined) {
      classification.preserved.push({ entry, reason: 'unresolved', claimant });
      continue;
    }
    classification.orphans.push(entry);
  }

  return classification;
};

/**
 * A lista aplicada CONVERGE para o que ainda é exigido: o que já estava e continua sendo pedido, mais
 * o que subiu agora, mais o órfão que não foi removido, mais o que foi preservado. Reescrevê-la só com
 * o que subiu NESTA execução a esvaziava na segunda passada — e a terceira redeployava tudo, achando
 * que nada havia sido feito.
 *
 * O dono é reconciliado com quem reivindica AGORA: uma function que trocou de extensão entre duas
 * versões fica registrada com a atual, e não com a que a pôs no ar da primeira vez.
 */
export const appliedAfterRun = (input: {
  applied: AppliedFunction[];
  wanted: string[];
  deployed: string[];
  keptOrphans: AppliedFunction[];
  preserved: AppliedFunction[];
  /** Nome de function -> plugin que a reivindica nesta execução. */
  owners: Map<string, string>;
}): AppliedFunction[] => {
  const wanted = new Set(input.wanted);
  const byName = new Map<string, AppliedFunction>();

  const remember = (name: string, recorded: string | null): void => {
    byName.set(name, { name, owner: input.owners.get(name) ?? recorded });
  };

  for (const entry of input.applied) {
    if (wanted.has(entry.name)) remember(entry.name, entry.owner);
  }
  for (const name of input.deployed) remember(name, byName.get(name)?.owner ?? null);
  for (const entry of [...input.keptOrphans, ...input.preserved]) remember(entry.name, entry.owner);

  return [...byName.values()].sort((left, right) => left.name.localeCompare(right.name));
};

/** Como uma function aplicada aparece num relatório: sem dono conhecido, só o nome. */
export const describeApplied = (entry: AppliedFunction): string =>
  entry.owner === null ? entry.name : `${entry.name} (${entry.owner})`;
