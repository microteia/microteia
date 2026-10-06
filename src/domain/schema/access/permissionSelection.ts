import type { PermissionCatalog } from './resolvePermissions';
import { dependenciesOf } from './resolvePermissions';

/**
 * A seleção de permissões de um TETO, e as duas contas que uma tela precisa fazer sobre ela.
 *
 * Teto de agente não é perfil de acesso, e a diferença manda nestas duas funções. No perfil, uma
 * permissão exigida por outra fica TRAVADA: criar-sem-ver não é um perfil mais estreito, é um perfil
 * quebrado. Num teto, "escreve e nunca lê" é um estreitamento legítimo — e deliberado.
 *
 * Por isso a dependência é ACRESCENTADA ao marcar e AVISADA ao faltar, em vez de imposta: quem quis
 * o caso estreito continua podendo tê-lo, e quem não quis não precisa descobrir sozinho que faltava
 * uma permissão para a escolha funcionar.
 */

/**
 * A seleção com tudo o que ela arrasta.
 *
 * Segue o fecho inteiro, atravessando recurso: um `financeiro.create` que exige `pessoa.read` traz a
 * segunda mesmo ela morando noutro grupo da tela. Ids fora do catálogo passam intactos — quem os
 * recusa é a emissão, e descartá-los aqui esconderia o erro de digitação em vez de reportá-lo.
 */
export const withDependencies = (
  catalog: PermissionCatalog,
  ids: readonly string[],
): string[] => {
  const all = new Set(ids);
  for (const id of ids) {
    for (const dependency of dependenciesOf(catalog, id)) all.add(dependency);
  }
  return [...all].sort();
};

/**
 * Para cada permissão, QUEM na seleção a exige.
 *
 * É o que deixa a tela avisar "Visualizar é exigida por Criar" numa linha desmarcada, em vez de
 * deixar o teto sair incoerente em silêncio. O mapa inclui apenas as exigidas, nunca as exigentes.
 */
export const requiredBySelection = (
  catalog: PermissionCatalog,
  selected: readonly string[],
): Map<string, string[]> => {
  const required = new Map<string, string[]>();
  for (const id of selected) {
    for (const dependency of dependenciesOf(catalog, id)) {
      required.set(dependency, [...(required.get(dependency) ?? []), id]);
    }
  }
  return required;
};
