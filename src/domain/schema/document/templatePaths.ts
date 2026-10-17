// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/document/templatePaths.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { extractFieldExpressionPaths } from '../fieldExpression';
import type { PathRoot } from '../pathResolver';
import { parsePath, resolvePath } from '../pathResolver';
import { resolveQueryTable } from '../querySpec';
import { SYSTEM_MANAGED_KEYS } from '../mutationSpec';
import type { SchemaContext } from '../screenEntity';
import type { DocumentTemplateDataset } from './documentTemplate';
import type { TemplateNode } from './templateGrammar';
import { TEMPLATE_LOOP_VARIABLES, parseTemplate } from './templateGrammar';

/**
 * Um caminho que o modelo lê e que a tela não tem.
 *
 * `scope` diz onde ele foi lido: `record` (fora de laço) ou o nome do laço. É AVISO, nunca recusa: a
 * geração é tolerante e um campo que não resolve sai vazio no documento — mas quem escreve o modelo
 * sem ver a tela (um agente de IA) só descobre o erro de digitação depois de gerar, e em silêncio.
 */
export interface TemplatePathIssue {
  path: string;
  scope: string;
  error: string;
  errorParams?: Record<string, string>;
}

/** `null` = um laço sobre algo que não é uma lista declarada: o que se lê dentro dele não se confere. */
type Scope = { name: string; root: PathRoot } | null;

const rootOf = (ctx: SchemaContext, collection: string): PathRoot | null =>
  resolveQueryTable(collection, ctx)?.root ?? null;

/**
 * Confere os caminhos do texto do modelo (e do nome do arquivo) contra o esquema do escritório.
 *
 * `collection` e `datasets[].from` são COLEÇÕES físicas — a forma do modelo resolvido. Dentro de um
 * laço um nome pode ser do item ou do registro de fora (a gramática não distingue), então ele vale
 * se resolver em QUALQUER escopo aberto — a mesma tolerância da hidratação.
 */
export const templatePathIssues = (
  ctx: SchemaContext,
  collection: string,
  datasets: readonly DocumentTemplateDataset[] | undefined,
  texts: readonly string[],
): TemplatePathIssue[] => {
  const recordRoot = rootOf(ctx, collection);
  if (recordRoot === null) return [];

  const datasetRoots = new Map<string, PathRoot | null>(
    (datasets ?? []).map((dataset) => [dataset.name, rootOf(ctx, dataset.from)]),
  );
  const found = new Map<string, TemplatePathIssue>();

  const check = (expr: string, scopes: readonly Scope[]): void => {
    if (scopes.includes(null)) return;
    const open = scopes as readonly { name: string; root: PathRoot }[];
    const paths = extractFieldExpressionPaths(expr)
      .filter((path) => !(TEMPLATE_LOOP_VARIABLES as readonly string[]).includes(path.split('.')[0]))
      .filter((path) => !datasetRoots.has(path.split('.')[0]));
    for (const path of paths) {
      if (SYSTEM_MANAGED_KEYS.has(path.split('.')[0])) continue;
      // O resolvedor responde `unknown` (válido) ao campo que a entidade não tem — é a mesma leitura
      // que faz `mutationSpec` recusar a gravação num campo inexistente.
      const attempts = open.map((scope) => resolvePath(ctx, scope.root, parsePath(path)));
      if (attempts.some((attempt) => attempt.valid && attempt.node.kind !== 'unknown')) continue;
      const innermost = open[open.length - 1];
      const key = `${innermost.name}:${path}`;
      if (found.has(key)) continue;
      const last = attempts[attempts.length - 1];
      found.set(key, {
        path,
        scope: innermost.name,
        error: last?.valid === false && last.error ? last.error : '@core.automation/mutation.path.unknown-field',
        errorParams: last?.valid === false && last.errorParams ? last.errorParams : { path },
      });
    }
  };

  const walk = (nodes: readonly TemplateNode[], scopes: readonly Scope[]): void => {
    for (const node of nodes) {
      if (node.kind === 'text') continue;
      if (node.kind === 'each') {
        const name = node.expr.trim();
        if (datasetRoots.has(name)) {
          const root = datasetRoots.get(name) ?? null;
          walk(node.children, [...scopes, root === null ? null : { name, root }]);
        } else {
          check(node.expr, scopes);
          walk(node.children, [...scopes, null]);
        }
        continue;
      }
      check(node.expr, scopes);
      if (node.kind === 'if') walk(node.children, scopes);
    }
  };

  for (const text of texts) {
    if (text.trim()) walk(parseTemplate(text).nodes, [{ name: 'record', root: recordRoot }]);
  }
  return [...found.values()];
};
