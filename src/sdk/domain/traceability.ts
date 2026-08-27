import type { BusinessRule } from './businessRule';

/**
 * A RASTREABILIDADE — o vínculo entre a regra e o que ELA gerou, e a decisão de onde ele mora.
 *
 * Havia duas saídas, e elas não custam o mesmo:
 *
 * (a) **carimbar o `ruleId` dentro do artefato instalado.** Exigiria uma propriedade nova em
 *     `ScreenModuleTemplate`, em `ActionModuleTemplate` e em `WorkflowModuleTemplate` — a FORMA do
 *     pacote muda, e o `KERNEL_VERSION` se move com ela. Em troca, o vínculo viajaria para o
 *     escritório e sobreviveria a este diretório.
 * (b) **um arquivo de trabalho no workspace**, ao lado do `plugin.ts`, com `ruleId` -> artefatos
 *     produzidos. Não toca o kernel, não toca o pacote, não move versão nenhuma.
 *
 * **É (b).** O argumento é sobre de quem é a pergunta. "Que telas esta regra gerou?" é uma pergunta de
 * AUTORIA: quem a faz está com o `plugin.ts` aberto, decidindo o que muda agora que a regra mudou.
 * O escritório nunca a faz — para ele a tela é uma tela, e a origem dela não muda nada do que ele pode
 * fazer com ela. Carimbar o vínculo no artefato instalado seria pôr uma resposta de autoria dentro de
 * todo documento de todo escritório, para sempre, e mover o contrato Kernel↔plugins para isso — quando
 * o único leitor está aqui. É o mesmo veredito que `CatalogException` já recebeu, pelo mesmo motivo, e
 * a consequência dele também é a mesma: o vínculo é do workspace, e um workspace novo não o tem. Vale,
 * porque um workspace novo também não tem o `plugin.ts` que a regra gerou.
 *
 * O que a rastreabilidade compra é uma coisa só, e é grande: quando a regra muda, o plano é o DIFF
 * daquilo que ela gerou. Sem isso, a segunda passada da regra alterada é uma segunda leva de telas
 * parecidas — e a decisão "isto substitui aquilo" fica com quem lembrar.
 */

export const RULE_LEDGER_FILE = 'business-rules.json';
/**
 * A forma do arquivo. Continua em 1 depois de o livro passar a registrar a identidade das telas porque
 * a adição é ADITIVA nos dois sentidos: um leitor antigo ignora o campo novo, e um leitor novo lê a
 * ausência dele como "não registrado", que é o que ela significa num livro escrito antes. Subir a
 * versão sem que nada leia a diferença seria uma distinção que ninguém usa.
 */
export const RULE_LEDGER_VERSION = 1;

export interface RuleLedgerEntry {
  ruleId: string;
  /** O enunciado como estava quando esta leva foi produzida. É contra ele que a próxima é um diff. */
  statement: string;
  /** Impressão digital do enunciado mais a leitura dele: igual = a mesma regra, não uma parecida. */
  fingerprint: string;
  /** Quando a leva foi produzida. Quem grava o arquivo carimba; este módulo não olha relógio. */
  producedAt?: string;
  /** As coleções de tela que esta regra fez existir. */
  screens: string[];
  /** As listas de opções que ela fez existir. */
  lists: string[];
  /** As chaves das ações de registro que ela pediu. */
  actions: string[];
  /** Os nomes das transições que viraram automação. */
  transitions: string[];
  /** As permissões que ela exige. */
  permissions: string[];
  /**
   * O id UNIVERSAL de cada tela desta leva, por coleção — e é a razão pela qual este livro deixou de
   * ser só um registro de proveniência.
   *
   * O `sourceId` é por onde a atualização RECONHECE a tela. Errar entre duas versões do mesmo pacote
   * não falha em lugar nenhum: instala uma segunda tela ao lado da primeira, em todo escritório. Então
   * o valor não pode ser recalculado por quem escreve a versão seguinte — ele é LIDO daqui, e o que
   * está aqui tem precedência sobre o pacote e sobre qualquer derivação, para sempre.
   *
   * Ausente num livro escrito antes disto: significa "não registrado", e aí vale o que o pacote
   * declara. Nunca "nenhuma tela tem identidade" — por isso a leitura devolve `{}` e não erro.
   */
  screenSourceIds: Record<string, string>;
}

export interface RuleLedger {
  version: number;
  rules: RuleLedgerEntry[];
}

export const emptyRuleLedger = (): RuleLedger => ({ version: RULE_LEDGER_VERSION, rules: [] });

/**
 * FNV-1a de 32 bits, em hexadecimal. Escrito aqui e não importado: `src/sdk/domain/` é puro por
 * desenho — `sdkPurity.test.ts` percorre o fechamento de imports —, e `node:crypto` não entra. O que
 * se pede desta função é ser DETERMINÍSTICA, não ser resistente a colisão maliciosa: ela responde "é
 * a mesma regra ou é outra?", e quem a escreve é quem também a lê.
 */
const digest = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

/**
 * O separador é `\u0000` porque ele é o único caractere que não pode aparecer dentro de nenhuma das
 * listas: com espaço, duas leituras diferentes da mesma frase — um invariante partido em dois, dois
 * juntados num — dariam a MESMA impressão digital, e a regra alterada passaria por inalterada. Vem
 * escrito como escape, e não como o byte cru: um NUL no meio do arquivo faz o git tratar o fonte como
 * binário e o diff da revisão desaparece.
 */
export const ruleFingerprint = (rule: BusinessRule): string => digest([
  rule.statement,
  ...rule.actors,
  ...rule.concepts,
  ...rule.invariants,
  ...rule.processes,
  ...rule.acceptance,
].join('\u0000'));

export interface LedgerProduced {
  screens: string[];
  lists: string[];
  actions: string[];
  transitions: string[];
  permissions: string[];
}

const sorted = (values: readonly string[]): string[] => [...new Set(values)].sort();

/**
 * A leva pronta para gravar. `screenSourceIds` entra por fora de `LedgerProduced` de propósito: ele
 * não é uma LISTA do que a regra produziu — é a identidade de cada tela, e um diff sobre ela não faz
 * sentido nenhum (uma identidade que "mudou" é o defeito, não uma alteração a propor).
 */
export const ruleLedgerEntry = (
  rule: BusinessRule,
  produced: LedgerProduced,
  screenSourceIds: Readonly<Record<string, string>> = {},
): RuleLedgerEntry => ({
  ruleId: rule.id,
  statement: rule.statement,
  fingerprint: ruleFingerprint(rule),
  screens: sorted(produced.screens),
  lists: sorted(produced.lists),
  actions: sorted(produced.actions),
  transitions: sorted(produced.transitions),
  permissions: sorted(produced.permissions),
  screenSourceIds: Object.fromEntries(Object.entries(screenSourceIds).sort(([a], [b]) => a.localeCompare(b))),
});

/** O que o livro registra como identidade das telas desta regra, na forma que o plano consome. */
export const registeredScreenSourceIds = (entry: RuleLedgerEntry | undefined): Map<string, string> =>
  new Map(Object.entries(entry?.screenSourceIds ?? {}));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Só os pares em que as duas pontas são texto: um valor torto é ausência, não uma identidade meia-boca. */
const strMap = (value: unknown): Record<string, string> => {
  if (!isRecord(value)) return {};
  const pairs = Object.entries(value)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
    .map(([key, held]) => [key.trim(), held.trim()] as const)
    .filter(([key]) => key !== '');
  return Object.fromEntries(pairs);
};

const strList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .filter((one): one is string => typeof one === 'string')
    .map((one) => one.trim())
    .filter((one) => one !== '');

/**
 * Leitura tolerante, e ela devolve um livro VAZIO em vez de erro quando o arquivo está torto. Perder o
 * vínculo de ontem é ruim; não conseguir planejar nada hoje é pior — e é a mesma escolha que
 * `exceptionsFrom` já faz com um `domain-model.json` ilegível.
 */
export const parseRuleLedger = (raw: unknown): RuleLedger => {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return emptyRuleLedger();
    }
  }
  if (!isRecord(value) || !Array.isArray(value.rules)) return emptyRuleLedger();

  const rules = value.rules.flatMap((one): RuleLedgerEntry[] => {
    if (!isRecord(one) || typeof one.ruleId !== 'string' || one.ruleId.trim() === '') return [];
    return [{
      ruleId: one.ruleId.trim(),
      statement: typeof one.statement === 'string' ? one.statement : '',
      fingerprint: typeof one.fingerprint === 'string' ? one.fingerprint : '',
      ...(typeof one.producedAt === 'string' ? { producedAt: one.producedAt } : {}),
      screens: strList(one.screens),
      lists: strList(one.lists),
      actions: strList(one.actions),
      transitions: strList(one.transitions),
      permissions: strList(one.permissions),
      screenSourceIds: strMap(one.screenSourceIds),
    }];
  });

  return { version: typeof value.version === 'number' ? value.version : RULE_LEDGER_VERSION, rules };
};

export const ledgerEntryOf = (ledger: RuleLedger | undefined, ruleId: string): RuleLedgerEntry | undefined =>
  ledger?.rules.find((one) => one.ruleId === ruleId);

/** O livro com esta leva no lugar da anterior da mesma regra. Quem grava o arquivo serializa isto. */
export const withRuleEntry = (ledger: RuleLedger | undefined, entry: RuleLedgerEntry): RuleLedger => {
  const base = ledger ?? emptyRuleLedger();
  const others = base.rules.filter((one) => one.ruleId !== entry.ruleId);
  return {
    version: RULE_LEDGER_VERSION,
    rules: [...others, entry].sort((a, b) => a.ruleId.localeCompare(b.ruleId)),
  };
};

export interface RuleDelta {
  /** `true` quando a regra é literalmente a mesma de antes: nada a propor. */
  unchanged: boolean;
  /** O que esta leva acrescenta ao que a regra já tinha produzido. */
  added: LedgerProduced;
  /** O que a regra produziu antes e esta leva não pede mais. NUNCA se exclui — ver `PlannedDeactivation`. */
  dropped: LedgerProduced;
}

const difference = (before: readonly string[], after: readonly string[]): string[] => {
  const held = new Set(after);
  return before.filter((one) => !held.has(one));
};

/**
 * O que MUDOU no que esta regra gera. É a peça que faz a reaplicação valer: a mesma regra duas vezes
 * não propõe nada, a regra alterada propõe só o delta, e a regra que perdeu uma entidade propõe
 * desativar o que sobrou — nunca excluir.
 */
export const ruleDelta = (previous: RuleLedgerEntry | undefined, next: RuleLedgerEntry): RuleDelta => {
  if (previous === undefined) {
    return {
      unchanged: false,
      added: {
        screens: next.screens,
        lists: next.lists,
        actions: next.actions,
        transitions: next.transitions,
        permissions: next.permissions,
      },
      dropped: { screens: [], lists: [], actions: [], transitions: [], permissions: [] },
    };
  }

  return {
    unchanged: previous.fingerprint === next.fingerprint
      && difference(previous.screens, next.screens).length === 0
      && difference(next.screens, previous.screens).length === 0
      && difference(previous.actions, next.actions).length === 0
      && difference(next.actions, previous.actions).length === 0,
    added: {
      screens: difference(next.screens, previous.screens),
      lists: difference(next.lists, previous.lists),
      actions: difference(next.actions, previous.actions),
      transitions: difference(next.transitions, previous.transitions),
      permissions: difference(next.permissions, previous.permissions),
    },
    dropped: {
      screens: difference(previous.screens, next.screens),
      lists: difference(previous.lists, next.lists),
      actions: difference(previous.actions, next.actions),
      transitions: difference(previous.transitions, next.transitions),
      permissions: difference(previous.permissions, next.permissions),
    },
  };
};

/**
 * A INTEGRIDADE DO LIVRO, agora que ele é dependência.
 *
 * Ele é escrito pelo AGENTE, não por uma tool — e isso era aceitável enquanto ele só respondia "que
 * telas esta regra gerou". Agora ele é a fonte de uma chave de identidade: uma linha que escorregou
 * não produz sintoma nenhum hoje e produz, na próxima passada, exatamente a segunda tela que o
 * `sourceId` existe para evitar.
 *
 * As duas direções que se pode conferir sem adivinhar, e nada além delas:
 *
 * - o plano produziu um artefato que JÁ EXISTIA aqui e o livro não menciona. Não é a regra crescendo
 *   (aí o artefato é criado agora, e a entrada nova já o traz): é uma passada anterior que gerou o
 *   artefato e não gravou o livro — e é o caso em que a identidade se perde.
 * - o livro menciona um artefato que não existe em lugar nenhum: nem neste plano, nem no catálogo. O
 *   livro afirma uma proveniência que nada sustenta.
 *
 * O que ela NÃO afirma: nada sobre ação, fluxo ou permissão. O plano não vê action instalada — ele lê
 * declaração de pacote e, quando há, um retrato do escritório —, e uma verificação que adivinha vale
 * menos que a ausência dela.
 */
export interface LedgerReality {
  /** Coleções de tela que este plano produz e que já existiam antes dele. */
  producedScreensAlreadyThere: readonly string[];
  /** Toda coleção de tela que existe aqui: as do catálogo mais as que este plano planeja. */
  knownScreens: readonly string[];
  /** Listas de opções que este plano produz e que já existiam. */
  producedListsAlreadyThere: readonly string[];
  knownLists: readonly string[];
}

/**
 * O que não fecha entre o livro e a realidade. Vazio é o caso normal — inclusive na PRIMEIRA leva de
 * uma regra, quando não há entrada anterior para conferir contra.
 */
export const ledgerFindings = (
  previous: RuleLedgerEntry | undefined,
  reality: LedgerReality,
): string[] => {
  if (previous === undefined) return [];
  const findings: string[] = [];
  const mentionedScreens = new Set(previous.screens);
  const mentionedLists = new Set(previous.lists);

  for (const collection of reality.producedScreensAlreadyThere) {
    if (mentionedScreens.has(collection)) continue;
    findings.push(`the screen "${collection}" already exists here and this rule produces it, and the ledger entry `
      + `for "${previous.ruleId}" does not mention it — so nothing records its identity`);
  }
  for (const collection of reality.producedListsAlreadyThere) {
    if (mentionedLists.has(collection)) continue;
    findings.push(`the option list "${collection}" already exists here and this rule produces it, and the ledger `
      + `entry for "${previous.ruleId}" does not mention it`);
  }
  const knownScreens = new Set(reality.knownScreens);
  for (const collection of previous.screens) {
    if (knownScreens.has(collection)) continue;
    findings.push(`the ledger records the screen "${collection}" for "${previous.ruleId}", and nothing here has it: `
      + 'neither this plan nor the catalog');
  }
  const knownLists = new Set(reality.knownLists);
  for (const collection of previous.lists) {
    if (knownLists.has(collection)) continue;
    findings.push(`the ledger records the option list "${collection}" for "${previous.ruleId}", and nothing here `
      + 'has it');
  }

  const registered = Object.keys(previous.screenSourceIds);
  for (const collection of registered) {
    if (mentionedScreens.has(collection)) continue;
    findings.push(`the ledger registers a sourceId for "${collection}" and does not list it among the screens of `
      + `"${previous.ruleId}" — the entry disagrees with itself`);
  }
  if (registered.length > 0) {
    for (const collection of previous.screens) {
      if (previous.screenSourceIds[collection] !== undefined) continue;
      findings.push(`the ledger lists the screen "${collection}" for "${previous.ruleId}" with no sourceId, while `
        + 'registering one for the others — the next pass derives one for it alone');
    }
  }
  return findings;
};
