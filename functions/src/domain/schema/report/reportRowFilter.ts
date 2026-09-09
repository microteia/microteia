// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/reportRowFilter.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportRowFilter.ts
// é GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { evaluateFieldExpression, extractFieldExpressionPaths } from '../fieldExpression';
import { getValueAtPath, parsePath } from '../pathResolver';
import type { ReportSpec } from './reportSpec';

export interface ReportRowFilterInput {
  spec: ReportSpec;
  /** As linhas já varridas, hidratadas e materializadas — as mesmas que o agregador recebe. */
  rows: Record<string, unknown>[];
  /** A coleção-fonte: é ela que `<entity>` vira dentro de `hasPermission`. */
  entity?: string;
  /**
   * As permissões EFETIVAS de quem executa o relatório.
   *
   * Sem elas, `hasPermission` responde NÃO a tudo — e num filtro de linha isso não é um botão que
   * some, é uma linha que sai da conta. O relatório roda como o USUÁRIO, então é o conjunto dele que
   * entra aqui.
   */
  permissions?: readonly string[];
  /** O instante que `today()` e `now()` respondem. Um só para o relatório inteiro. */
  now?: Date;
}

export type ReportRowFilterOutcome =
  | { ok: true; rows: Record<string, unknown>[] }
  /** `error` é uma REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  | { ok: false; error: string; errorParams?: Record<string, string> };

interface PathTree { [segment: string]: PathTree }

const treeOf = (paths: string[]): PathTree => {
  const root: PathTree = {};
  for (const path of paths) {
    let node = root;
    for (const segment of path.split('.')) {
      if (segment === '') continue;
      node[segment] = node[segment] ?? {};
      node = node[segment];
    }
  }
  return root;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);

const nodeOf = (
  row: Record<string, unknown>,
  prefix: string[],
  tree: PathTree,
): Record<string, unknown> => {
  const node: Record<string, unknown> = {};

  for (const [segment, children] of Object.entries(tree)) {
    const path = [...prefix, segment];
    const raw = getValueAtPath(row, parsePath(path.join('.')));

    if (Object.keys(children).length === 0) {
      node[segment] = raw === undefined ? null : raw;
      continue;
    }

    // O registro apontado inteiro, mais a garantia de que o que a expressão cita dele EXISTE. Sem o
    // espalhamento, `isNotNull(cliente)` deixaria de ver os outros campos do apontado; sem a
    // sobreposição, `cliente.cidade` de um cliente sem cidade voltaria a estourar.
    node[segment] = {
      ...(isPlainObject(raw) ? raw : {}),
      ...nodeOf(row, path, children),
    };
  }

  return node;
};

/**
 * O ESCOPO em que o filtro de linha é avaliado — montado a partir dos caminhos que a própria
 * expressão cita, e por isso TOTAL: todo nome que ela usa existe, valendo `null` quando o registro
 * não o tem.
 *
 * Sem isto, a avaliação não é conservadora, é imprevisível: o `expr-eval` ESTOURA ao ler um nome que
 * não está no escopo, e um campo nunca preenchido simplesmente não existe no documento do Firestore.
 * Um relatório sobre uma coleção em que metade dos registros não tem `situacao` derrubaria a
 * expressão em metade das linhas — e o resultado seria um número menor, com o mesmo rótulo.
 *
 * A lista de caminhos é a MESMA que `reportPaths` entrega à hidratação e ao RBAC: uma derivação,
 * três usos, e nenhuma chance de o escopo pedir o que a varredura não trouxe.
 */
export const reportRowScope = (
  row: Record<string, unknown>,
  paths: string[],
): Record<string, unknown> => nodeOf(row, [], treeOf(paths));

/**
 * As linhas que o filtro por expressão MANTÉM.
 *
 * Devolve um resultado, e não uma lista, porque uma expressão que estoura não pode virar linha
 * descartada. Este é o único lugar do relatório em que "na dúvida, exclua" produziria um total menor
 * sem uma palavra em lugar nenhum — e um total menor é exatamente o defeito que o leitor não tem como
 * notar. A regra da camada já diz o que fazer: `dataset` é a verdade do número, e o que ela não
 * consegue responder é RECUSA nomeada.
 *
 * Roda em memória, depois da varredura, e por isso ela apenas RESTRINGE: nada aqui amplia o que foi
 * lido, e o teto de varredura continua valendo com o mesmo significado.
 */
export const filterReportRows = (input: ReportRowFilterInput): ReportRowFilterOutcome => {
  const expression = (input.spec.dataset.includeWhen ?? '').trim();
  if (expression === '') return { ok: true, rows: input.rows };

  const paths = extractFieldExpressionPaths(expression);
  const kept: Record<string, unknown>[] = [];

  for (const row of input.rows) {
    const scope = reportRowScope(row, paths);
    try {
      const answer = evaluateFieldExpression(expression, {
        // Uma linha de relatório não tem "valor próprio", então `value` (e o apelido `self`) vale o
        // CAMPO de mesmo nome, quando a coleção tem um. O escopo do avaliador sobrescreve os dois
        // sempre, e vem do REGISTRO e não do escopo montado porque `value` é nome reservado — ele não
        // sai da extração de caminhos. Sem isto, uma coleção com um campo `value` veria toda
        // comparação sobre ele responder sobre nulo, e o total sairia menor sem uma palavra na tela.
        value: row.value ?? null,
        data: scope,
        entity: input.entity,
        permissions: input.permissions,
        at: input.now,
      });
      if (answer) kept.push(row);
    } catch (caught) {
      return {
        ok: false,
        error: '@core.reports/filter.failed',
        errorParams: { detail: caught instanceof Error ? caught.message : String(caught) },
      };
    }
  }

  return { ok: true, rows: kept };
};
