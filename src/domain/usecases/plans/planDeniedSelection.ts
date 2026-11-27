import type { PermissionCatalog } from '../../schema/access';
import { containedPermissionIds, planDeniedClosure } from '../../schema/access';

/**
 * O que o plano nega depois que o `SYSTEM` muda a seleção no editor — o teto que vai valer, e não um que a
 * materialização corrigiria em silêncio.
 *
 * - Desmarcar uma permissão desmarca o que DEPENDE dela (`planDeniedClosure`).
 * - As negadas que este catálogo não oferece — de uma extensão que não está no escritório aberto —
 *   continuam negadas: o plano é global, e este catálogo, não.
 * - Desmarcar a que CONTÉM outras (`update`) leva também as contidas (#41). A contida que a tela MOSTRA
 *   (declarada por uma extensão) só é arrastada pela negação NOVA, e pode ser marcada de volta —
 *   "bloqueia editar, deixa anexar" é um plano possível. A que a tela NÃO mostra (derivada da coleção)
 *   acompanha a maior nos dois sentidos: ninguém a veria para desfazer.
 */
export const planDeniedSelection = (
  catalog: PermissionCatalog,
  offerableIds: readonly string[],
  allowedIds: readonly string[],
  previouslyDenied: readonly string[],
): string[] => {
  const allowed = new Set(allowedIds);
  const offerable = new Set(offerableIds);
  const before = new Set(previouslyDenied);
  const hiddenOf = (containers: readonly string[]): string[] =>
    containers.flatMap(containedPermissionIds).filter((id) => !offerable.has(id));
  const following = new Set(hiddenOf(offerableIds));

  const explicit = offerableIds.filter((id) => !allowed.has(id));
  const dragged = explicit
    .filter((id) => !before.has(id))
    .flatMap(containedPermissionIds)
    .filter((id) => offerable.has(id));
  const closed = planDeniedClosure(catalog, [...explicit, ...dragged]).filter((id) => offerable.has(id));
  const untouched = previouslyDenied.filter((id) => !offerable.has(id) && !following.has(id));
  return [...new Set([...untouched, ...closed, ...hiddenOf(closed)])].sort();
};
