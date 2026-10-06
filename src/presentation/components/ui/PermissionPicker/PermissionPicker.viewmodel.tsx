import { useCallback, useMemo, useState } from 'react';
import { useAuthorization } from '../../../../stores/useAuthorization';
import type { CatalogPermission } from '../../../../domain/schema/access';
import { requiredBySelection, withDependencies } from '../../../../domain/schema/access';
import { useLabel, useT } from '../../../shared/i18n/useT';

export interface PermissionRow {
  id: string;
  name: string;
  description: string | null;
  checked: boolean;
  /**
   * Os nomes das permissões SELECIONADAS que exigem esta.
   *
   * Marcada, é a explicação de por que ela entrou. Desmarcada, é o aviso de que o teto está mais
   * estreito do que algo selecionado precisa — que continua sendo uma escolha possível, e deixa de
   * ser uma escolha por engano.
   */
  requiredBy: string[];
}

export interface PermissionGroupRow {
  resource: string;
  name: string;
  rows: PermissionRow[];
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  expanded: boolean;
}

export interface PermissionPickerViewModel {
  groups: PermissionGroupRow[];
  query: string;
  setQuery: (value: string) => void;
  totalOfferable: number;
  totalSelected: number;
  hasOfferable: boolean;
  noMatches: boolean;
  togglePermission: (id: string, checked: boolean) => void;
  toggleGroup: (resource: string, checked: boolean) => void;
  toggleExpanded: (resource: string) => void;
  clearAll: () => void;
}

export interface PermissionPickerInput {
  selected: string[];
  onChange: (ids: string[]) => void;
}

/**
 * O seletor de teto de permissões, compartilhado pela aba de Agentes de IA e pelo consentimento.
 *
 * Ele existe porque as duas telas faziam a mesma pergunta por uma lista chapada de oitenta itens, em
 * que marcar "tudo de Prazos" eram quatro cliques e descobrir que Criar precisa de Visualizar era
 * tentativa e erro. Agrupar por RECURSO não é decoração: é a mesma estrutura que o catálogo já tem
 * (`resource` + `resourceLabels`) e a mesma que a tela de Perfis mostra — três telas perguntando a
 * mesma coisa de três jeitos era o defeito.
 *
 * A diferença em relação a Perfis é deliberada e está em `permissionSelection.ts`: aqui a dependência
 * é acrescentada ao marcar e AVISADA ao faltar, nunca travada. Teto de agente admite "escreve e nunca
 * lê"; perfil de pessoa, não.
 */
export const usePermissionPickerViewModel = (
  input: PermissionPickerInput,
): PermissionPickerViewModel => {
  const { catalog, effectivePermissions, isUnrestricted } = useAuthorization();
  const label = useLabel();
  const t = useT('core.access');

  const [query, setQuery] = useState('');
  /**
   * O que a PESSOA abriu ou fechou, por recurso.
   *
   * Só a divergência mora aqui; a ausência é o padrão calculado — grupo com algo marcado nasce
   * aberto. Guardar o estado de todos os grupos obrigaria a semeá-lo quando o catálogo chega, e a
   * semeadura é o que faz um grupo recém-marcado continuar fechado.
   */
  const [openedByUser, setOpenedByUser] = useState<Record<string, boolean>>({});

  const { selected, onChange } = input;

  /**
   * O que esta pessoa pode OFERECER: nunca mais do que ela própria tem.
   *
   * A mesma conta que `issueAgentGrant` refaz no servidor. Aqui ela existe para a tela não oferecer
   * o que seria recusado, e não como garantia — a garantia é a de lá.
   */
  const offerable = useMemo<CatalogPermission[]>(() => {
    const held = new Set(effectivePermissions);
    return catalog.list.filter((permission) => isUnrestricted || held.has(permission.id));
  }, [catalog, effectivePermissions, isUnrestricted]);

  const resourceName = useCallback(
    (resource: string): string => {
      const declared = catalog.resourceLabels.get(resource);
      return declared ? label(declared.name, declared.nameParams) : resource;
    },
    [catalog, label],
  );

  /**
   * O nome QUALIFICADO — "Criar — Prazos", e não só "Criar".
   *
   * É o que o aviso de dependência precisa: a exigida pode morar noutro grupo, e "Visualizar é
   * exigida por Criar" não diz criar O QUÊ. Mesma chave que a tela de Perfis usa, pelo mesmo motivo.
   */
  const nameOf = useCallback(
    (id: string): string => {
      const permission = catalog.byId.get(id);
      if (!permission) return id;
      return t('role.qualified-name', {
        action: label(permission.name),
        resource: resourceName(permission.resource),
      });
    },
    [catalog, label, resourceName, t],
  );

  const requiredBy = useMemo(() => requiredBySelection(catalog, selected), [catalog, selected]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const allGroups = useMemo<PermissionGroupRow[]>(() => {
    const byResource = new Map<string, CatalogPermission[]>();
    for (const permission of offerable) {
      byResource.set(permission.resource, [...(byResource.get(permission.resource) ?? []), permission]);
    }

    return [...byResource.entries()]
      .map(([resource, permissions]) => {
        const rows = permissions.map<PermissionRow>((permission) => ({
          id: permission.id,
          name: label(permission.name),
          description: permission.description ? label(permission.description) : null,
          checked: selectedSet.has(permission.id),
          requiredBy: (requiredBy.get(permission.id) ?? []).map(nameOf),
        }));
        const selectedCount = rows.filter((row) => row.checked).length;
        return {
          resource,
          name: resourceName(resource),
          rows,
          selectedCount,
          allSelected: selectedCount === rows.length && rows.length > 0,
          someSelected: selectedCount > 0,
          // Fechado por padrão, e é isso que faz a lista caber na tela. Um grupo com algo marcado
          // se abre sozinho: esconder a escolha de alguém atrás de um clique é pior que a lista longa.
          expanded: openedByUser[resource] ?? selectedCount > 0,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [offerable, selectedSet, requiredBy, label, nameOf, resourceName, openedByUser]);

  /** A busca casa com o nome do grupo, o da permissão, o id e a descrição. */
  const groups = useMemo<PermissionGroupRow[]>(() => {
    const term = query.trim().toLowerCase();
    if (term === '') return allGroups;

    const matches = (value: string | null) => value !== null && value.toLowerCase().includes(term);
    return allGroups
      .map((group) => (matches(group.name)
        ? { ...group, expanded: true }
        : {
          ...group,
          rows: group.rows.filter((row) => matches(row.name) || matches(row.id) || matches(row.description)),
          expanded: true,
        }))
      .filter((group) => group.rows.length > 0);
  }, [allGroups, query]);

  const togglePermission = useCallback((id: string, checked: boolean) => {
    // Marcar ARRASTA o que a permissão exige; desmarcar leva só ela. A assimetria é o desenho:
    // completar a escolha é serviço, estreitá-la é decisão de quem está escolhendo.
    onChange(checked
      ? withDependencies(catalog, [...selected, id])
      : selected.filter((one) => one !== id));
  }, [catalog, selected, onChange]);

  const toggleGroup = useCallback((resource: string, checked: boolean) => {
    const ids = offerable.filter((permission) => permission.resource === resource).map((one) => one.id);
    if (!checked) {
      const removing = new Set(ids);
      onChange(selected.filter((one) => !removing.has(one)));
      return;
    }
    onChange(withDependencies(catalog, [...selected, ...ids]));
  }, [catalog, offerable, selected, onChange]);

  const toggleExpanded = useCallback((resource: string) => {
    setOpenedByUser((current) => {
      const group = allGroups.find((one) => one.resource === resource);
      return { ...current, [resource]: !(current[resource] ?? group?.expanded ?? false) };
    });
  }, [allGroups]);

  const clearAll = useCallback(() => onChange([]), [onChange]);

  return {
    groups,
    query,
    setQuery,
    totalOfferable: offerable.length,
    totalSelected: selected.length,
    hasOfferable: offerable.length > 0,
    noMatches: groups.length === 0 && query.trim() !== '',
    togglePermission,
    toggleGroup,
    toggleExpanded,
    clearAll,
  };
};
