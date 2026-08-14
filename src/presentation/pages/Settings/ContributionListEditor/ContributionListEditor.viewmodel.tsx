import { useCallback, useMemo } from 'react';
import { usePointContributions } from '../../../shared/extensions/usePointContributions';
import { useLabel } from '../../../shared/i18n/useT';

import {
  resolveContributionLayout,
  type ContributionLayoutDefaults,
  type ContributionLayoutEntry,
} from '../../../../domain/schema/settings';

export interface ContributionListEditorProps {
  point: string;
  value: unknown;
  disabled?: boolean;
  onChange: (entries: ContributionLayoutEntry[]) => void;
}

export interface ContributionListItem extends ContributionLayoutEntry {
  title: string;
  description?: string;
  icon?: string;
  pluginId: string;
  isFirst: boolean;
  isLast: boolean;
}

export interface ContributionListEditorViewModel {
  items: ContributionListItem[];
  toggle: (key: string) => void;
  move: (key: string, direction: -1 | 1) => void;
}

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * O editor de uma configuração `contributions`. Não conhece ponto nenhum: lê o que está registrado
 * naquele ponto e deixa o escritório escolher quem participa e em que ordem — o mesmo desenho do
 * editor de widgets, sem a largura.
 */
export const useContributionListEditorViewModel = (
  props: ContributionListEditorProps,
): ContributionListEditorViewModel => {
  const { point, value, onChange } = props;
  const contributions = usePointContributions(point);
  // O editor lista contribuições de QUALQUER ponto — nativas, que declaram referência, e de
  // extensão, que trazem o texto do autor. `label` é o caminho único que serve às duas.
  const label = useLabel();

  const available = useMemo<ContributionLayoutDefaults[]>(
    () => contributions.map((contribution) => ({
      key: text(contribution.metadata.key) ?? contribution.id,
      defaultEnabled: contribution.metadata.defaultEnabled !== false,
      order: typeof contribution.metadata.order === 'number' ? contribution.metadata.order : 0,
    })),
    [contributions],
  );

  const entries = useMemo(() => resolveContributionLayout(value, available), [value, available]);

  const items = useMemo<ContributionListItem[]>(() => {
    const byKey = new Map(
      contributions.map((contribution) => [text(contribution.metadata.key) ?? contribution.id, contribution]),
    );
    return entries.map((entry, index) => {
      const contribution = byKey.get(entry.key);
      return {
        ...entry,
        title: label(text(contribution?.metadata.title)) || entry.key,
        description: label(text(contribution?.metadata.description)) || undefined,
        icon: text(contribution?.metadata.icon),
        pluginId: contribution?.pluginId ?? '',
        isFirst: index === 0,
        isLast: index === entries.length - 1,
      };
    });
  }, [entries, contributions, label]);

  const commit = useCallback((next: ContributionLayoutEntry[]) => {
    onChange(next.map(({ key, enabled }) => ({ key, enabled })));
  }, [onChange]);

  const toggle = useCallback((key: string) => {
    commit(entries.map((entry) => (entry.key === key ? { ...entry, enabled: !entry.enabled } : entry)));
  }, [entries, commit]);

  const move = useCallback((key: string, direction: -1 | 1) => {
    const index = entries.findIndex((entry) => entry.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  }, [entries, commit]);

  return { items, toggle, move };
};
