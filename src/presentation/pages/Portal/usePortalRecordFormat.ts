import { useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useLocaleFormat, useT } from '../../shared/i18n/useT';
import { resolveColor } from '../../../shared/styles/colorUtils';
import type { PortalRecord, PortalScreenInfo } from '../../../domain/entities/Portal';
import type { PortalFieldView, PortalRecordCard } from './Portal.viewmodel';

const SUMMARY_FIELDS = 3;

const optionOf = (field: PortalScreenInfo['fields'][number], key: unknown) =>
  field.options?.find((option) => option.key === key);

const optionLabel = (field: PortalScreenInfo['fields'][number], key: unknown): string =>
  optionOf(field, key)?.label ?? String(key);

/**
 * Como um registro do portal vira texto: o valor de cada campo exposto, no idioma de quem lê, e o
 * cartão da lista com os primeiros campos. Um só lugar, para a lista de topo e a de filhos dizerem o
 * mesmo do mesmo registro.
 */
export const usePortalRecordFormat = () => {
  const t = useT('core.tenant');
  const { formatDate, formatMoney, formatNumber } = useLocaleFormat();
  const theme = useTheme();

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

  const cardOf = useCallback((screen: PortalScreenInfo, record: PortalRecord): PortalRecordCard => ({
    collection: screen.collection,
    id: record.id,
    title: record.title || t('portal.record.untitled'),
    summary: screen.fields
      .map((field) => formatValue(field, record))
      .filter((field) => field.value !== '' && field.href === null)
      .slice(0, SUMMARY_FIELDS)
      .map((field) => `${field.label}: ${field.value}`)
      .join(' · '),
    updatedAt: record.updatedAt ? t('portal.record.updated', { date: formatDate(record.updatedAt) }) : '',
  }), [formatValue, formatDate, t]);


  return { formatValue, cardOf };
};
