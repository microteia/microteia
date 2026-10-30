import { useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useLocaleFormat, useT } from '../../shared/i18n/useT';
import { resolveColor } from '../../../shared/styles/colorUtils';
import { usePortal } from '../../../stores/usePortal';
import { evaluatePortalCondition } from '../../../domain/schema/portal';
import type { PortalRecord, PortalScreenInfo } from '../../../domain/entities/Portal';
import { DEFAULT_PORTAL_CARD_BODY, type PortalTemplateSurface } from '../../../domain/schema/ui/portalTemplate';
import type { PortalFieldView, PortalRecordCard } from './Portal.viewmodel';
import { resolvePortalNodes, type PortalTemplateAnswers } from './resolvePortalTemplate';

const SUMMARY_FIELDS = 3;

const optionOf = (field: PortalScreenInfo['fields'][number], key: unknown) =>
  field.options?.find((option) => option.key === key);

const optionLabel = (field: PortalScreenInfo['fields'][number], key: unknown): string =>
  optionOf(field, key)?.label ?? String(key);

/** O que o registro aberto acrescenta às respostas do cartão: os botões que só ele tem. */
export interface PortalDetailExtras {
  editLabel: string | null;
  hasActions: boolean;
}

/**
 * Como um registro do portal vira texto: o valor de cada campo exposto, no idioma de quem lê, e o
 * cartão da lista com os primeiros campos. Um só lugar, para a lista de topo e a de filhos dizerem o
 * mesmo do mesmo registro — e para o desenho declarado (`portal.template`) responder com as mesmas
 * palavras do padrão.
 */
export const usePortalRecordFormat = () => {
  const t = useT('core.tenant');
  const { formatDate, formatMoney, formatNumber } = useLocaleFormat();
  const theme = useTheme();
  const timeZone = usePortal().context?.timeZone;

  const formatValue = useCallback((field: PortalScreenInfo['fields'][number], record: PortalRecord): PortalFieldView => {
    const raw = record.data[field.key];
    const base = { key: field.key, label: field.label, href: null, color: null };
    if (raw === undefined || raw === null || raw === '') return { ...base, value: '' };
    switch (field.type) {
      case 'reference':
        return { ...base, value: record.labels[field.key] ?? '' };
      case 'select':
        return Array.isArray(raw)
          ? { ...base, value: raw.map((key) => optionLabel(field, key)).join(', ') }
          : { ...base, value: optionLabel(field, raw), color: resolveColor(optionOf(field, raw)?.color, theme, false) ?? null };
      case 'checkbox':
        return { ...base, value: raw === true ? t('portal.value.yes') : t('portal.value.no') };
      case 'date':
        return { ...base, value: formatDate(raw) };
      case 'currency':
        return { ...base, value: typeof raw === 'number' ? formatMoney(raw) : String(raw) };
      case 'number':
        return { ...base, value: typeof raw === 'number' ? formatNumber(raw) : String(raw) };
      case 'file':
        return { ...base, value: t('portal.document.open'), href: typeof raw === 'string' ? raw : null };
      default:
        return { ...base, value: Array.isArray(raw) ? raw.join(', ') : String(raw) };
    }
  }, [t, formatDate, formatMoney, formatNumber, theme]);

  const summaryOf = useCallback((screen: PortalScreenInfo, record: PortalRecord): string => screen.fields
    .map((field) => formatValue(field, record))
    .filter((field) => field.value !== '' && field.href === null)
    .slice(0, SUMMARY_FIELDS)
    .map((field) => `${field.label}: ${field.value}`)
    .join(' · '), [formatValue]);

  const updatedOf = useCallback(
    (record: PortalRecord): string => (record.updatedAt ? t('portal.record.updated', { date: formatDate(record.updatedAt) }) : ''),
    [formatDate, t],
  );

  /**
   * As respostas do desenho para um registro. A condição é avaliada sobre a PROJEÇÃO, no fuso do
   * escritório — o servidor só deixa chegar aqui a que lê campo exposto. No cartão, que inteiro abre o
   * registro, o campo de arquivo é texto, e não um link dentro do botão.
   */
  const answersOf = useCallback((
    screen: PortalScreenInfo,
    record: PortalRecord,
    surface: PortalTemplateSurface,
    extras: PortalDetailExtras = { editLabel: null, hasActions: false },
  ): PortalTemplateAnswers => {
    const view = (field: PortalScreenInfo['fields'][number]): PortalFieldView => {
      const formatted = formatValue(field, record);
      return surface === 'card' ? { ...formatted, href: null } : formatted;
    };
    return {
      title: record.title || t('portal.record.untitled'),
      field: (fieldKey) => {
        const field = screen.fields.find((candidate) => candidate.key === fieldKey);
        return field ? view(field) : null;
      },
      fields: screen.fields.map(view).filter((field) => field.value !== ''),
      summary: summaryOf(screen, record),
      updated: updatedOf(record),
      editLabel: extras.editLabel,
      hasActions: extras.hasActions,
      isHidden: (hiddenWhen) => !!hiddenWhen && evaluatePortalCondition(hiddenWhen, record.data, timeZone),
    };
  }, [formatValue, summaryOf, updatedOf, t, timeZone]);

  const cardOf = useCallback((screen: PortalScreenInfo, record: PortalRecord): PortalRecordCard => {
    const card = screen.template?.card;
    const accentField = card?.accent ? screen.fields.find((field) => field.key === card.accent?.field) : undefined;
    return {
      collection: screen.collection,
      id: record.id,
      title: record.title || t('portal.record.untitled'),
      summary: summaryOf(screen, record),
      updatedAt: updatedOf(record),
      // Com o cartão declarado só pelo arranjo, o conteúdo é o padrão ESCRITO NA DSL: um desenhista só.
      nodes: card ? resolvePortalNodes(card.body ?? DEFAULT_PORTAL_CARD_BODY, answersOf(screen, record, 'card')) : null,
      accentColor: accentField ? formatValue(accentField, record).color : null,
    };
  }, [formatValue, summaryOf, updatedOf, answersOf, t]);

  return { formatValue, cardOf, answersOf };
};
