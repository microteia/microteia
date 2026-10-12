import type { PathRoot, SchemaContext } from '../../domain/schema/pathResolver';
import { parsePath, resolvePath } from '../../domain/schema/pathResolver';
import type { QuerySpec } from '../../domain/schema/querySpec';
import { resolveQueryTable } from '../../domain/schema/querySpec';
import { reportPaths } from '../../domain/schema/report/reportSpec';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';

/**
 * O CAMINHO QUE NENHUM CAMPO DECLARA — o erro de digitação que a validação da plataforma não pega.
 *
 * `resolvePath` aceita qualquer segmento desconhecido sobre uma entidade (`kind: 'unknown'`, válido),
 * e isso está CERTO onde ele roda: no designer e na execução, o escritório pode ter criado o campo no
 * Form Design, e recusá-lo quebraria o relatório que ele montou. Num pacote é o contrário. Quando a
 * coleção é de uma tela que o autor ENXERGA — a do próprio pacote, a de uma irmã escrita no mesmo
 * diretório, a do retrato da instalação —, um campo que nenhuma delas declara é, quase sempre, um nome
 * escrito errado: `responsibleLawyerId.nomeQueNaoExiste` passava no `check` e o relatório saía com a
 * coluna vazia no escritório.
 *
 * Por isso a resposta é AVISO e mora aqui, na autoria, e não no validador do kernel: o kernel continua
 * aceitando o campo do escritório, e quem conhece o conjunto de telas visíveis é quem pergunta.
 *
 * A pergunta é feita ao PRÓPRIO `resolvePath`, prefixo a prefixo, e não a um segundo andador de
 * caminho: `contract` por `contractId`, a lista atravessada sem posição e o salto de referência são
 * regras dele, e uma cópia divergiria na primeira regra nova.
 */
export interface UndeclaredPath {
  path: string;
  /** A coleção sobre a qual o caminho saiu do esquema. */
  collection: string;
  /** O segmento que nenhum campo dela declara. */
  segment: string;
}

/**
 * `declared` é o conjunto de coleções cuja lista de campos se toma por COMPLETA. Ausente, valem as
 * telas do contexto — que é o que quem monta o contexto à mão, num teste de extensão, quer dizer. As
 * entidades do kernel ficam de fora mesmo então: elas não vêm de tela nenhuma que o autor tenha em mãos.
 */
const declaredOf = (ctx: SchemaContext, declared?: ReadonlySet<string>): ReadonlySet<string> =>
  declared ?? new Set(ctx.screens.keys());

const collectionOfNode = (node: ReturnType<typeof resolvePath>['node']): string | null =>
  node.kind === 'entity' || node.kind === 'entityList' ? node.collection : null;

export const undeclaredPathSegment = (
  ctx: SchemaContext,
  root: PathRoot,
  path: string,
  declared?: ReadonlySet<string>,
): UndeclaredPath | null => {
  const complete = declaredOf(ctx, declared);
  const segments = parsePath(path);
  let collection: string | null = root.kind === 'entity' ? root.entityKey : null;

  for (let index = 0; index < segments.length; index += 1) {
    const resolution = resolvePath(ctx, root, segments.slice(0, index + 1));
    // O caminho INVÁLIDO é da validação da plataforma, que já o recusa com a frase dela.
    if (!resolution.valid) return null;
    if (resolution.node.kind === 'unknown') {
      const segment = segments[index];
      if (collection === null || segment.kind !== 'key' || !complete.has(collection)) return null;
      return { path, collection, segment: segment.name };
    }
    collection = collectionOfNode(resolution.node);
  }
  return null;
};

const undeclaredOnTable = (
  ctx: SchemaContext,
  table: string,
  paths: readonly string[],
  declared?: ReadonlySet<string>,
): UndeclaredPath[] => {
  const resolved = resolveQueryTable(table, ctx);
  if (resolved === null) return [];
  return paths
    .map((path) => undeclaredPathSegment(ctx, resolved.root, path, declared))
    .filter((found): found is UndeclaredPath => found !== null);
};

/** Os caminhos do relatório são os de `reportPaths` — a mesma lista que a hidratação traz e o RBAC cobra. */
export const undeclaredReportPaths = (
  spec: ReportSpec,
  ctx: SchemaContext,
  declared?: ReadonlySet<string>,
): UndeclaredPath[] => undeclaredOnTable(ctx, spec.dataset.table, reportPaths(spec), declared);

export const queryPaths = (spec: QuerySpec): string[] => [
  ...new Set([
    ...(spec.where ?? []).map((predicate) => predicate.path),
    ...(spec.orderBy ?? []).map((order) => order.path),
    ...(spec.projections ?? []),
  ].map((path) => path.trim()).filter((path) => path !== '')),
];

export const undeclaredQueryPaths = (
  spec: QuerySpec,
  ctx: SchemaContext,
  declared?: ReadonlySet<string>,
): UndeclaredPath[] => undeclaredOnTable(ctx, spec.table, queryPaths(spec), declared);
