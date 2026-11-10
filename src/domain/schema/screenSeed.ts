import { isLookupSeedMode, type LookupSeedMode } from './lookupSeed';
import { parseMessageRef } from './i18n/messageRef';

/**
 * Registros SEMENTE de uma tela de extensão (`ScreenModuleTemplate.seed`) — o catálogo que a extensão
 * entrega pronto: raças com a espécie, produtos com o preço, tipos de serviço com a duração.
 *
 * É a contrapartida de `lookups[].options` para quando o catálogo tem atributos próprios e por isso é
 * uma TELA, não uma lista. Sem isto, a extensão escolhia entre achatar o catálogo numa lista (sem
 * atributo, sem filtro por tipo) ou escrever à mão uma migração `runOnInstall` — com o teto de 25
 * gravações por rodada, um campo escondido de "código da semente" para reconhecer o registro depois, a
 * lógica de "criar o que falta e nunca ressuscitar o apagado" reescrita por extensão, e os nomes num
 * idioma fixo, porque a migração não enxerga o do escritório.
 *
 * Os modos são os de `lookupSeed.ts`, com o mesmo significado:
 *
 * - `when-empty` (o padrão): só numa coleção VAZIA na primeira vez que a extensão semeia. A decisão é
 *   guardada (`planned`), e uma passada interrompida termina o que decidiu, mesmo com a coleção já não
 *   vazia — é ela mesma que a encheu.
 * - `required`: entra toda semente que esta extensão ainda não entregou. Uma versão nova que acrescenta
 *   entradas ao catálogo entrega só as chaves novas a quem já tinha a extensão.
 *
 * Nas duas, a chave entregue NÃO VOLTA: o registro que o escritório apagou ou renomeou é dele.
 */
export interface ScreenSeedRecord {
  /** Identidade estável da semente dentro da tela. Nunca grava no registro: mora no histórico. */
  key: string;
  /** Os campos do registro, como um `upsert` os receberia. */
  data: Record<string, unknown>;
}

export interface ScreenSeed {
  mode?: LookupSeedMode;
  records: ScreenSeedRecord[];
}

/** O kernel a partir do qual `screens[].seed` é entregue. Um kernel anterior o ignora em silêncio. */
export const SCREEN_SEED_SINCE_KERNEL = '2.106.0';

/**
 * Teto por tela. Um catálogo de referência cabe nisto com folga; acima, o dado já não é "o ponto de
 * partida que a extensão traz", é uma carga — e para carga existe a importação em massa, com relatório.
 * O teto também é o que permite a passada correr numa invocação só, sem cursor nem rodadas.
 */
export const SCREEN_SEED_MAX_RECORDS = 500;

/** A chave de uma semente: o que um autor escreveria num slug. Sem `/`, porque ela compõe caminhos. */
export const SCREEN_SEED_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/**
 * A marca da gravação de semente em `createdVia`. É ela que faz o registro nascer sem `.saved` e sem
 * linha de auditoria própria. Não é forjável: a regra do Firestore só deixa o cliente criar com
 * `createdVia: 'ui'` (`declaresOnlyUiOnCreate`), e nenhuma gravação do cliente altera `createdVia`.
 */
export const RECORD_SEED_VIA = 'extension-seed';

/** O autor carimbado em `createdBy`: a semente é da extensão, não de quem estava no app na hora. */
export const RECORD_SEED_AUTHOR = 'extension-seed';

/**
 * O histórico de cada extensão: `tenants/{id}/extension_seeds/{pluginId}`. Coleção reservada, e
 * sobrevive à desinstalação pelo mesmo motivo de `extension_migrations`: os registros semeados
 * sobrevivem, e reinstalar sem o histórico duplicaria o catálogo inteiro.
 */
export const EXTENSION_SEEDS_COLLECTION = 'extension_seeds';

/**
 * Os tipos em que uma referência de mensagem é TEXTO a resolver no idioma do escritório. Em qualquer
 * outro tipo um `@ns/chave` seria um valor — uma opção, um número — e é recusado no `check`.
 */
export const SCREEN_SEED_TEXT_TYPES: ReadonlySet<string> = new Set(['text', 'textarea', 'markdown']);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A semente de uma tela como a passada a usa: a tela pelo id universal, o modo já resolvido. */
export interface DeclaredScreenSeed {
  /** `sourceId` da tela no pacote (ou a chave, na tela legada) — é por ele que a tela instalada é achada. */
  sourceId: string;
  templateKey: string;
  mode: LookupSeedMode;
  records: ScreenSeedRecord[];
  /** Os campos da tela no pacote: dizem quais valores são texto, e portanto traduzíveis. */
  fields: { key: string; type: string }[];
}

/**
 * As sementes de um pacote INSTALADO, lido do banco. Tolerante de propósito: o `check` já recusou a
 * forma errada na autoria, e o pacote gravado num escritório pode ser de um kernel anterior — o que
 * não tem a forma esperada é ignorado, nunca derruba a passada das outras telas.
 */
export const declaredScreenSeeds = (pkg: unknown): DeclaredScreenSeed[] => {
  if (!isPlainObject(pkg) || !Array.isArray(pkg.screens)) return [];
  const declared: DeclaredScreenSeed[] = [];
  for (const screen of pkg.screens) {
    if (!isPlainObject(screen) || typeof screen.key !== 'string' || !isPlainObject(screen.seed)) continue;
    const { seed } = screen;
    if (!Array.isArray(seed.records)) continue;
    const records = seed.records.filter((record): record is ScreenSeedRecord =>
      isPlainObject(record) && typeof record.key === 'string' && isPlainObject(record.data));
    if (records.length === 0) continue;
    declared.push({
      sourceId: typeof screen.sourceId === 'string' && screen.sourceId ? screen.sourceId : screen.key,
      templateKey: screen.key,
      mode: isLookupSeedMode(seed.mode) ? seed.mode : 'when-empty',
      records: records.slice(0, SCREEN_SEED_MAX_RECORDS),
      fields: (Array.isArray(screen.fields) ? screen.fields : [])
        .filter(isPlainObject)
        .filter((field) => typeof field.key === 'string' && typeof field.type === 'string')
        .map((field) => ({ key: field.key as string, type: field.type as string })),
    });
  }
  return declared;
};

/**
 * O que esta extensão já fez numa tela.
 *
 * `planned` é a decisão do `when-empty`, tomada uma vez: as chaves que a coleção vazia ia receber (ou
 * nenhuma, se ela não estava vazia). `null` no `required`, que não decide nada de antemão.
 */
export interface ScreenSeedEntry {
  planned: string[] | null;
  delivered: string[];
}

/** A semente que não entrou: fica de fora de `delivered` e é tentada de novo na próxima passada. */
export interface ScreenSeedFailure {
  key: string;
  error: string;
  errorParams?: Record<string, string>;
}

export interface ScreenSeedPlan {
  create: ScreenSeedRecord[];
  /** A entrada com a decisão já tomada — gravada antes da primeira semente, para valer numa retomada. */
  entry: ScreenSeedEntry;
}

/**
 * Se a passada precisa saber se a coleção está vazia. Só a PRIMEIRA decisão do `when-empty` pergunta;
 * depois dela, a resposta já está gravada — e o `required` nunca pergunta.
 */
export const needsEmptinessCheck = (mode: LookupSeedMode, entry: ScreenSeedEntry | undefined): boolean =>
  mode === 'when-empty' && entry === undefined;

/**
 * O que semear numa tela, dado o que esta extensão já fez nela. Puro: a leitura da coleção é de quem
 * chama, e só quando `needsEmptinessCheck` diz que é preciso.
 *
 * Trocar de modo entre versões tem o efeito que o nome diz: `when-empty` → `required` passa a entregar
 * o que falta; `required` → `when-empty` para de entregar, porque a coleção já foi semeada.
 */
export const planScreenSeed = (
  mode: LookupSeedMode,
  records: readonly ScreenSeedRecord[],
  entry: ScreenSeedEntry | undefined,
  collectionIsEmpty: boolean,
): ScreenSeedPlan => {
  const delivered = new Set(entry?.delivered ?? []);
  if (mode === 'required') {
    return {
      create: records.filter((record) => !delivered.has(record.key)),
      entry: { planned: entry?.planned ?? null, delivered: [...delivered] },
    };
  }
  if (entry === undefined) {
    const planned = collectionIsEmpty ? records.map((record) => record.key) : [];
    return { create: records.filter((record) => planned.includes(record.key)), entry: { planned, delivered: [] } };
  }
  const planned = new Set(entry.planned ?? []);
  return {
    create: records.filter((record) => planned.has(record.key) && !delivered.has(record.key)),
    entry: { planned: entry.planned, delivered: [...delivered] },
  };
};

/**
 * O valor que vai para o registro: a referência de mensagem num campo de TEXTO vira o texto no idioma
 * do escritório, NESTE momento. Dali em diante é dado como qualquer outro — o escritório o edita, e
 * trocar o idioma depois não o retraduz. Fora dos tipos de texto, nada é tocado.
 */
export const resolveSeedData = (
  data: Readonly<Record<string, unknown>>,
  fields: readonly { key: string; type: string }[],
  resolve: (ref: string) => string,
): Record<string, unknown> => {
  const textFields = new Set(fields.filter((field) => SCREEN_SEED_TEXT_TYPES.has(field.type)).map((field) => field.key));
  return Object.fromEntries(Object.entries(data).map(([key, value]) => {
    const ref = textFields.has(key) ? parseMessageRef(value) : null;
    return [key, ref ? resolve(ref.full) : value];
  }));
};

/**
 * A gravação de semente, reconhecida no gatilho de auditoria e no de eventos: a CRIAÇÃO marcada. Uma
 * alteração posterior não é semente — o cliente carimba `updatedVia: 'ui'`, a automação o dela, e o
 * registro passa a publicar e auditar como qualquer outro.
 */
export const isRecordSeedWrite = (
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): boolean => !before && !!after && after.createdVia === RECORD_SEED_VIA;

/** O histórico gravado, lido com tolerância: documento ausente ou de outra forma é "nada feito ainda". */
export interface ExtensionSeedState {
  screens: Record<string, ScreenSeedEntry>;
  failures: Record<string, ScreenSeedFailure[]>;
  /** Epoch ms até quando uma passada em curso reserva a extensão. */
  leaseUntil: number | null;
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const readExtensionSeedState = (raw: unknown): ExtensionSeedState => {
  const data = isPlainObject(raw) ? raw : {};
  const screens: Record<string, ScreenSeedEntry> = {};
  for (const [sourceId, value] of Object.entries(isPlainObject(data.screens) ? data.screens : {})) {
    if (!isPlainObject(value)) continue;
    screens[sourceId] = {
      planned: Array.isArray(value.planned) ? stringList(value.planned) : null,
      delivered: stringList(value.delivered),
    };
  }
  const failures: Record<string, ScreenSeedFailure[]> = {};
  for (const [sourceId, value] of Object.entries(isPlainObject(data.failures) ? data.failures : {})) {
    if (!Array.isArray(value)) continue;
    failures[sourceId] = value
      .filter(isPlainObject)
      .filter((failure) => typeof failure.key === 'string' && typeof failure.error === 'string')
      .map((failure) => ({
        key: failure.key as string,
        error: failure.error as string,
        ...(isPlainObject(failure.errorParams) ? { errorParams: failure.errorParams as Record<string, string> } : {}),
      }));
  }
  return {
    screens,
    failures,
    leaseUntil: typeof data.leaseUntil === 'number' ? data.leaseUntil : null,
  };
};
