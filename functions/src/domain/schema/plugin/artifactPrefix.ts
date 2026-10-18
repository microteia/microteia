// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/plugin/artifactPrefix.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O PREFIXO de quem cria — o escritório, numa configuração, ou o autor de uma extensão, no manifest.
 *
 * Existe porque o nome de uma coleção é um espaço ÚNICO por escritório, e o identificador universal de
 * um artefato criado à mão é o próprio id (`sourceId ?? id` na exportação). Sem prefixo, duas
 * extensões ou dois escritórios que escolhem `clientes` ou `avisar-cliente` produzem o mesmo nome, e a
 * instalação no destino ou funde os dois ou recusa. Com prefixo, o nome nasce de quem o criou —
 * `abcd_clientes`, `abcd-avisar-cliente` — e é o mesmo em todo escritório em que for instalado.
 *
 * O separador depende do tipo, porque os padrões diferem: a chave de coleção aceita `_` e não `-`; o id
 * de automação, ação, script e a chave de modelo de documento aceitam `-` e não `_`.
 *
 * O prefixo vale só para o que é criado DEPOIS de escolhido: trocar o prefixo de um nome já criado
 * trocaria a coleção (os registros ficariam para trás) e o identificador universal (quem já instalou o
 * que foi exportado deixaria de reconhecê-lo).
 */

/** Minúsculas e dígitos, começando por letra: cabe nos dois padrões de nome. */
export const ARTIFACT_PREFIX_PATTERN = /^[a-z][a-z0-9]{1,7}$/;

export const ARTIFACT_PREFIX_MIN_LENGTH = 2;
export const ARTIFACT_PREFIX_MAX_LENGTH = 8;

/** O tamanho do prefixo SORTEADO na criação do escritório. */
export const GENERATED_PREFIX_LENGTH = 4;

/** A configuração do escritório que guarda o prefixo, em `settings/tenant`. */
export const ARTIFACT_PREFIX_SETTING = 'customization.prefix';

/** O kernel que entende `manifest.prefix`. Um anterior ignora o campo. */
export const ARTIFACT_PREFIX_SINCE_KERNEL = '2.50.0';

/** `collection`: tela, lista de opções, conjunto de etiquetas, campo. `artifact`: automação, ação, script, relatório, modelo. */
export type PrefixedNameKind = 'collection' | 'artifact';

export const isArtifactPrefix = (value: unknown): value is string =>
  typeof value === 'string' && ARTIFACT_PREFIX_PATTERN.test(value);

export const prefixSeparator = (kind: PrefixedNameKind): string => (kind === 'collection' ? '_' : '-');

/** O começo que todo nome desse tipo tem de ter: `abcd_` ou `abcd-`. */
export const prefixHead = (prefix: string, kind: PrefixedNameKind): string => `${prefix}${prefixSeparator(kind)}`;

export const hasArtifactPrefix = (prefix: string, kind: PrefixedNameKind, name: string): boolean =>
  name.startsWith(prefixHead(prefix, kind)) && name.length > prefixHead(prefix, kind).length;

/**
 * O nome com o prefixo. Sem prefixo válido, o nome como veio — o escritório que ainda não tem um não
 * pode ficar impedido de criar. Nome que já começa pelo prefixo não ganha um segundo.
 */
export const withArtifactPrefix = (prefix: unknown, kind: PrefixedNameKind, name: string): string => {
  const trimmed = name.trim();
  if (!isArtifactPrefix(prefix) || trimmed === '' || hasArtifactPrefix(prefix, kind, trimmed)) return trimmed;
  return `${prefixHead(prefix, kind)}${trimmed}`;
};

/** O que vem depois do prefixo — o pedaço que a pessoa digita. */
export const withoutArtifactPrefix = (prefix: unknown, kind: PrefixedNameKind, name: string): string =>
  isArtifactPrefix(prefix) && hasArtifactPrefix(prefix, kind, name) ? name.slice(prefixHead(prefix, kind).length) : name;

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Quatro letras sorteadas. `random` é injetável para o teste; em produção é o `Math.random` de quem cria
 * o escritório — no servidor ou num handler, nunca durante um render.
 */
export const generateArtifactPrefix = (random: () => number = Math.random): string =>
  Array.from({ length: GENERATED_PREFIX_LENGTH }, () => LETTERS[Math.floor(random() * LETTERS.length) % LETTERS.length]).join('');
