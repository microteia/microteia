import { useCallback, useMemo } from 'react';
import { usePointContributions } from '../../../shared/extensions/usePointContributions';
import { useLabel } from '../../../shared/i18n/useT';
import { useRecordTabCatalog } from '../../../shared/settings/useRecordTabCatalog';
import { UI_TAB_POINT, recordSurfaceSourceId } from '../../../../domain/schema/ui/uiExtensionPoints';

import {
  resolveContributionLayout,
  type ContributionLayoutDefaults,
  type ContributionLayoutEntry,
} from '../../../../domain/schema/settings';

export interface ContributionListEditorProps {
  point: string;
  /**
   * Restringe a lista às contribuições daquela SUPERFÍCIE, quando o ponto tem mais de uma (as abas
   * de `tenant-settings` e as de outra tela chegam pelo mesmo ponto). Ausente, o ponto inteiro.
   */
  surface?: string;
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

/** Um item que a lista pode mostrar — de uma contribuição, ou do catálogo da faixa de um registro. */
interface ContributionListOption extends ContributionLayoutDefaults {
  title: string;
  description?: string;
  icon?: string;
  pluginId: string;
}

/**
 * O editor de uma configuração `contributions`. Não conhece ponto nenhum: lê o que está registrado
 * naquele ponto e deixa o escritório escolher quem participa e em que ordem — o mesmo desenho do
 * editor de widgets, sem a largura.
 */
export const useContributionListEditorViewModel = (
  props: ContributionListEditorProps,
): ContributionListEditorViewModel => {
  const { point, surface, value, onChange } = props;
  const registered = usePointContributions(point);
  // O editor lista contribuições de QUALQUER ponto — nativas, que declaram referência, e de
  // extensão, que trazem o texto do autor. `label` é o caminho único que serve às duas.
  const label = useLabel();

  /**
   * A faixa do detalhe de um registro é a única lista que não é feita só de contribuições: as abas de
   * telas-filhas entram nela com a mesma chave que o detalhe usa. Ler o catálogo da faixa — e não as
   * contribuições do ponto — é o que faz o escritório ver aqui exatamente as abas que verá lá.
   */
  const recordSourceId = point === UI_TAB_POINT && surface !== undefined ? recordSurfaceSourceId(surface) : null;
  const recordCatalog = useRecordTabCatalog(recordSourceId ?? '');

  const options = useMemo<ContributionListOption[]>(() => {
    if (recordSourceId) return recordCatalog;
    return registered
      .filter((contribution) => surface === undefined || contribution.metadata.surface === surface)
      .map((contribution) => ({
        key: text(contribution.metadata.key) ?? contribution.id,
        defaultEnabled: contribution.metadata.defaultEnabled !== false,
        order: typeof contribution.metadata.order === 'number' ? contribution.metadata.order : 0,
        title: text(contribution.metadata.title) ?? '',
        description: text(contribution.metadata.description),
        icon: text(contribution.metadata.icon),
        pluginId: contribution.pluginId,
      }));
  }, [recordSourceId, recordCatalog, registered, surface]);

  const entries = useMemo(() => resolveContributionLayout(value, options), [value, options]);

  const items = useMemo<ContributionListItem[]>(() => {
    const byKey = new Map(options.map((option) => [option.key, option]));
    return entries.map((entry, index) => {
      const option = byKey.get(entry.key);
      return {
        ...entry,
        title: label(option?.title) || entry.key,
        description: label(option?.description) || undefined,
        icon: option?.icon,
        pluginId: option?.pluginId ?? '',
        isFirst: index === 0,
        isLast: index === entries.length - 1,
      };
    });
  }, [entries, options, label]);

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
