import { useCallback, useMemo, useState } from 'react';
import { useRecordListViewModel } from '../../../../shared/entityScreen/useRecordListViewModel';
import { useCardTemplateResolvers } from '../../../../shared/entityScreen/useCardTemplateResolvers';
import type { CardTemplateResolvers } from '../../../../shared/entityScreen/resolveCardTemplate';
import { useT } from '../../../../shared/i18n/useT';
import { CARD_DESIGNER_VOCABULARY } from '../../../../shared/templateDesigner/cardDesignerVocabulary';
import type { TemplateVocabulary } from '../../../../shared/templateDesigner/templateVocabulary';
import { DEFAULT_CARD_BODY } from '../../../../../domain/schema/ui/cardTemplate';
import type { CardLayout, CardNode, CardWidth } from '../../../../../domain/schema/ui/cardTemplate';
import type { CardTemplateFieldInfo, CardTemplateIssue } from '../../../../../domain/schema/ui/cardTemplateIssues';
import type { EntityRecord } from '../../../../../domain/entities';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';
import type { TemplateDesignerOption } from '../../../../components/ui/TemplateDesigner';
import {
  cardTemplateFormIssues,
  defaultCardTemplateSource,
  previewCardTemplate,
} from './screenCardTemplateForm';
import type { CardTemplateFormState } from './screenCardTemplateForm';

export interface CardTemplatePanelField extends CardTemplateFieldInfo {
  /** Rótulo declarativo do campo, para a paleta e os seletores do modo visual. */
  label: string;
}

export interface ScreenCardTemplatePanelProps {
  screenKey: string;
  form: CardTemplateFormState;
  fields: readonly CardTemplatePanelField[];
  /** A tela veio de uma extensão: o cartão que ela declarar vence na próxima atualização. */
  fromExtension: boolean;
  onChange: (patch: Partial<CardTemplateFormState>) => void;
}

export interface ScreenCardTemplatePanelViewModel {
  form: CardTemplateFormState;
  fromExtension: boolean;
  layoutOptions: { value: string; label: string }[];
  widthOptions: { value: string; label: string }[];
  vocabulary: TemplateVocabulary;
  defaultSource: string;
  /** Os problemas como o portão os aponta — o editor os põe no nó e na propriedade. */
  designIssues: CardTemplateIssue[];
  actionOptions: TemplateDesignerOption[];
  previewBody: readonly CardNode[];
  previewRecord: EntityRecord | null;
  previewRecordId: string;
  previewRecordOptions: SearchSelectOption[];
  previewResolvers: CardTemplateResolvers;
  previewAccent: string | undefined;
  screenIcon: string;
  setLayout: (value: string) => void;
  setMinWidth: (value: string) => void;
  setCustom: (custom: boolean) => void;
  setSource: (source: string) => void;
  setPreviewRecordId: (id: string) => void;
  ignoreOpen: () => void;
}

const noop = (): void => undefined;

/** Registros oferecidos na escolha da pré-visualização — é uma amostra, não a lista. */
const PREVIEW_RECORD_LIMIT = 50;

export const useScreenCardTemplatePanelViewModel = ({
  screenKey,
  form,
  fields,
  fromExtension,
  onChange,
}: ScreenCardTemplatePanelProps): ScreenCardTemplatePanelViewModel => {
  const t = useT('core.records');
  const [previewRecordId, setPreviewRecordId] = useState('');
  const listVm = useRecordListViewModel({
    screenKey,
    savedFiltersKey: `card-template-preview:${screenKey}`,
    ignoreNavigationIntent: true,
  });
  const resolvers = useCardTemplateResolvers(listVm);
  const { getCardActions } = listVm;

  // A pré-visualização é INERTE: um clique numa ação ali excluiria um registro de verdade.
  const previewResolvers = useMemo<CardTemplateResolvers>(() => ({
    ...resolvers,
    actions: (record) => resolvers.actions(record).map((action) => ({ ...action, onClick: noop })),
  }), [resolvers]);

  const designIssues = useMemo(() => cardTemplateFormIssues(form, fields), [form, fields]);

  const template = useMemo(() => previewCardTemplate(form), [form]);
  const previewRecord = useMemo(
    () => listVm.records.find((record) => record.id === previewRecordId) ?? listVm.records[0] ?? null,
    [listVm.records, previewRecordId],
  );
  const previewRecordOptions = useMemo<SearchSelectOption[]>(
    () => listVm.records.slice(0, PREVIEW_RECORD_LIMIT).map((record) => ({ value: record.id, label: resolvers.title(record) || record.id })),
    [listVm.records, resolvers],
  );
  const accentField = template?.accent?.field;

  // A chave estável da ação: a da plataforma, ou a `key`/`sourceId` da do escritório — nunca o id
  // instalado, que muda quando o mesmo pacote é instalado noutro escritório.
  const actionOptions = useMemo<TemplateDesignerOption[]>(
    () => (previewRecord ? getCardActions(previewRecord) : []).map((action) => ({
      value: action.refs[1] ?? action.refs[0] ?? action.key,
      label: action.title,
    })),
    [previewRecord, getCardActions],
  );

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
  // Ligar com o editor vazio começa do cartão padrão: um cartão em branco não ensina nada.
  const setCustom = useCallback(
    (custom: boolean) => onChange(custom && !form.source.trim() ? { custom, source: defaultCardTemplateSource() } : { custom }),
    [onChange, form.source],
  );

  return {
    form,
    fromExtension,
    layoutOptions,
    widthOptions,
    vocabulary: CARD_DESIGNER_VOCABULARY,
    defaultSource: defaultCardTemplateSource(),
    designIssues,
    actionOptions,
    previewBody: template?.body ?? DEFAULT_CARD_BODY,
    previewRecord,
    previewRecordId: previewRecord?.id ?? '',
    previewRecordOptions,
    previewResolvers,
    previewAccent: previewRecord && accentField ? listVm.getCardAccentColor(previewRecord, accentField) : undefined,
    screenIcon: listVm.definition?.icon ?? '',
    setLayout,
    setMinWidth,
    setCustom,
    setSource,
    setPreviewRecordId,
    ignoreOpen: noop,
  };
};
