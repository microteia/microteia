import { useCallback, useMemo } from 'react';
import { useRecordListViewModel } from '../../../../shared/entityScreen/useRecordListViewModel';
import { useCardTemplateResolvers } from '../../../../shared/entityScreen/useCardTemplateResolvers';
import type { CardTemplateResolvers } from '../../../../shared/entityScreen/resolveCardTemplate';
import { useT, useLabel } from '../../../../shared/i18n/useT';
import { DEFAULT_CARD_BODY } from '../../../../../domain/schema/ui/cardTemplate';
import type { CardLayout, CardNode, CardWidth } from '../../../../../domain/schema/ui/cardTemplate';
import type { CardTemplateFieldInfo } from '../../../../../domain/schema/ui/cardTemplateIssues';
import type { EntityRecord } from '../../../../../domain/entities';
import {
  cardTemplateFormIssues,
  defaultCardTemplateSource,
  previewCardTemplate,
} from './screenCardTemplateForm';
import type { CardTemplateFormState } from './screenCardTemplateForm';

export interface ScreenCardTemplatePanelProps {
  screenKey: string;
  form: CardTemplateFormState;
  fields: readonly CardTemplateFieldInfo[];
  /** A tela veio de uma extensão: o cartão que ela declarar vence na próxima atualização. */
  fromExtension: boolean;
  onChange: (patch: Partial<CardTemplateFormState>) => void;
}

export interface ScreenCardTemplatePanelViewModel {
  form: CardTemplateFormState;
  fromExtension: boolean;
  layoutOptions: { value: string; label: string }[];
  widthOptions: { value: string; label: string }[];
  issues: string[];
  previewBody: readonly CardNode[];
  previewRecord: EntityRecord | null;
  previewResolvers: CardTemplateResolvers;
  previewAccent: string | undefined;
  screenIcon: string;
  setLayout: (value: string) => void;
  setMinWidth: (value: string) => void;
  setCustom: (custom: boolean) => void;
  setSource: (source: string) => void;
  resetToDefault: () => void;
  ignoreOpen: () => void;
}

const noop = (): void => undefined;

export const useScreenCardTemplatePanelViewModel = ({
  screenKey,
  form,
  fields,
  fromExtension,
  onChange,
}: ScreenCardTemplatePanelProps): ScreenCardTemplatePanelViewModel => {
  const t = useT('core.records');
  const label = useLabel();
  const listVm = useRecordListViewModel({
    screenKey,
    savedFiltersKey: `card-template-preview:${screenKey}`,
    ignoreNavigationIntent: true,
  });
  const resolvers = useCardTemplateResolvers(listVm);

  // A pré-visualização é INERTE: um clique numa ação ali excluiria um registro de verdade.
  const previewResolvers = useMemo<CardTemplateResolvers>(() => ({
    ...resolvers,
    actions: (record) => resolvers.actions(record).map((action) => ({ ...action, onClick: noop })),
  }), [resolvers]);

  const issues = useMemo(
    () => cardTemplateFormIssues(form, fields).map((issue) => label(issue.message, issue.messageParams)),
    [form, fields, label],
  );

  const template = useMemo(() => previewCardTemplate(form), [form]);
  const previewRecord = listVm.records[0] ?? null;
  const accentField = template?.accent?.field;

  const layoutOptions = useMemo(() => [
    { value: 'grid', label: t('card-template.panel.layout.grid') },
    { value: 'list', label: t('card-template.panel.layout.list') },
  ], [t]);
  const widthOptions = useMemo(() => [
    { value: 'sm', label: t('card-template.panel.width.sm') },
    { value: 'md', label: t('card-template.panel.width.md') },
    { value: 'lg', label: t('card-template.panel.width.lg') },
  ], [t]);

  const setLayout = useCallback((value: string) => onChange({ layout: value as CardLayout }), [onChange]);
  const setMinWidth = useCallback((value: string) => onChange({ minWidth: value as CardWidth }), [onChange]);
  const setSource = useCallback((source: string) => onChange({ source }), [onChange]);
  // Ligar com o editor vazio começa do cartão padrão: um JSON em branco não ensina nada.
  const setCustom = useCallback(
    (custom: boolean) => onChange(custom && !form.source.trim() ? { custom, source: defaultCardTemplateSource() } : { custom }),
    [onChange, form.source],
  );
  const resetToDefault = useCallback(() => onChange({ source: defaultCardTemplateSource() }), [onChange]);

  return {
    form,
    fromExtension,
    layoutOptions,
    widthOptions,
    issues,
    previewBody: template?.body ?? DEFAULT_CARD_BODY,
    previewRecord,
    previewResolvers,
    previewAccent: previewRecord && accentField ? listVm.getCardAccentColor(previewRecord, accentField) : undefined,
    screenIcon: listVm.definition?.icon ?? '',
    setLayout,
    setMinWidth,
    setCustom,
    setSource,
    resetToDefault,
    ignoreOpen: noop,
  };
};
