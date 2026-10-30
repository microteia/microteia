import { useMemo } from 'react';
import { deriveListRows } from '../deriveEntitySchema';
import { useSchemaContext } from '../useSchemaContext';
import { useListRowResolver } from '../listRows';
import { useLabel } from '../i18n/useT';
import type { EntityRecord } from '../../../domain/entities';
import type { CardTemplateResolvers } from './resolveCardTemplate';
import type { RecordListViewModel } from './useRecordListViewModel';

/**
 * As respostas que um cartão declarado pede, montadas UMA vez por lista a partir do que a listagem já
 * sabe — as mesmas funções que desenham o cartão padrão. É o que garante que `title`, `metaRows` ou
 * `actions` num template mostrem exatamente o que mostrariam no cartão de sempre.
 */
export const useCardTemplateResolvers = (vm: RecordListViewModel): CardTemplateResolvers => {
  const label = useLabel();
  const schemaContext = useSchemaContext();
  const resolveRow = useListRowResolver();
  const subtitleFieldKey = vm.definition?.subtitleFieldKey;
  const fields = vm.definition?.fields;

  const listRows = useMemo(
    () => deriveListRows(schemaContext, vm.collection).filter((row) => row.key !== subtitleFieldKey),
    [schemaContext, vm.collection, subtitleFieldKey],
  );

  return useMemo<CardTemplateResolvers>(() => ({
    title: vm.getCardTitle,
    subtitle: vm.getCardSubtitle,
    subtitleIconKey: vm.cardSubtitleIconKey,
    imageUrl: vm.getCardImageUrl,
    fieldItem: vm.getCardFieldItem,
    fieldLabel: (fieldKey) => {
      const field = fields?.find((candidate) => candidate.key === fieldKey);
      return field ? label(field.listLabel || field.label) : undefined;
    },
    fields: vm.getCardItems,
    metaRows: (record: EntityRecord) => listRows
      .map((row) => ({ key: row.key, iconKey: row.icon, value: resolveRow(record as unknown as Record<string, unknown>, row) }))
      .filter((row) => row.value !== ''),
    tags: (record: EntityRecord) => vm.tags.filter((tag) => record.tagIds?.includes(tag.id)),
    actions: vm.getCardActions,
    isHidden: vm.isCardNodeHidden,
    label: (text: string) => label(text),
  }), [vm.getCardTitle, vm.getCardSubtitle, vm.cardSubtitleIconKey, vm.getCardImageUrl, vm.getCardFieldItem, vm.getCardItems, vm.tags, vm.getCardActions, vm.isCardNodeHidden, fields, label, listRows, resolveRow]);
};
