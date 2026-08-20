import { Timestamp } from 'firebase/firestore';
import type { FieldDefinition, FieldOrigin, ScreenDefinition } from '../../domain/entities';
import { CUSTOM_FIELD_ENABLED_ENTITIES } from '../../domain/entities/entitySchemas';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

const FIELD_ORIGINS: readonly FieldOrigin[] = ['builtin', 'plugin', 'design'];

const isFieldOrigin = (value: unknown): value is FieldOrigin =>
  typeof value === 'string' && FIELD_ORIGINS.includes(value as FieldOrigin);

/**
 * Uma tela cujo id é o de uma entidade fixa É a tela fixa — o `origin` gravado nem precisa ser
 * consultado. Nas demais, quem trouxe a tela grava o `origin`; a extensão é reconhecida pelo
 * `ownerPluginId` quando o campo faltar.
 */
const screenOrigin = (id: string, d: Record<string, unknown>): FieldOrigin => {
  if (CUSTOM_FIELD_ENABLED_ENTITIES.has(id)) return 'builtin';
  if (isFieldOrigin(d.origin)) return d.origin;
  return d.ownerPluginId ? 'plugin' : 'design';
};

const mapFields = (raw: unknown, screenOriginValue: FieldOrigin): FieldDefinition[] =>
  ((raw as FieldDefinition[] | undefined) ?? []).map((field) => ({
    ...field,
    origin: isFieldOrigin(field.origin)
      ? field.origin
      : field.ownerPluginId
        ? 'plugin'
        : screenOriginValue === 'builtin'
          ? 'design'
          : screenOriginValue,
  }));

/**
 * Converte o documento cru do Firestore em `ScreenDefinition`.
 *
 * ATENÇÃO: o mapeamento é campo a campo, então **toda propriedade nova de `ScreenDefinition`
 * precisa ser acrescentada aqui**. Esquecer significa gravar no Firestore e descartar na leitura —
 * o dado existe no banco mas nunca volta, e a tela parece "não ter salvo". `screenDefinitionMapper
 * .test.ts` guarda contra isso.
 */
export const mapScreenDefinition = (
  id: string,
  d: Record<string, unknown>,
  tenantId: string,
): ScreenDefinition => ({
  id,
  tenantId,
  origin: screenOrigin(id, d),
  titleSingular: (d.titleSingular as string | undefined) ?? '',
  titlePlural: (d.titlePlural as string | undefined) ?? '',
  icon: (d.icon as string | undefined) ?? 'apps',
  fields: mapFields(d.fields, screenOrigin(id, d)),
  titleFieldKey: (d.titleFieldKey as string | undefined) ?? '',
  subtitleFieldKey: (d.subtitleFieldKey as string | null | undefined) ?? null,
  imageFieldKey: (d.imageFieldKey as string | null | undefined) ?? null,
  hasNotes: (d.hasNotes as boolean | undefined) ?? false,
  hasDocuments: (d.hasDocuments as boolean | undefined) ?? false,
  hasTags: (d.hasTags as boolean | undefined) ?? false,
  tagCollection: (d.tagCollection as string | null | undefined) ?? null,
  dataCollection: (d.dataCollection as string | null | undefined) ?? null,
  eventPrefix: (d.eventPrefix as string | null | undefined) ?? null,
  recordTabPrefix: (d.recordTabPrefix as string | null | undefined) ?? null,
  writeRoles: (d.writeRoles as string[] | null | undefined) ?? null,
  memberWritableFields: (d.memberWritableFields as string[] | null | undefined) ?? null,
  authorCanDelete: (d.authorCanDelete as boolean | null | undefined) ?? null,
  listActions: (d.listActions as ScreenDefinition['listActions'] | undefined) ?? [],
  viewActionIds: (d.viewActionIds as string[] | undefined) ?? [],
  cardActionIds: (d.cardActionIds as string[] | undefined) ?? [],
  parentEntity: (d.parentEntity as string | null | undefined) ?? null,
  parentFieldKey: (d.parentFieldKey as string | null | undefined) ?? null,
  parentRelation: (d.parentRelation as ScreenDefinition['parentRelation']) ?? null,
  ownerPluginId: (d.ownerPluginId as string | null | undefined) ?? null,
  ownerPluginIds: (d.ownerPluginIds as string[] | null | undefined) ?? null,
  sourceId: (d.sourceId as string | null | undefined) ?? null,
  sourceRev: (d.sourceRev as number | null | undefined) ?? null,
  managed: (d.managed as boolean | null | undefined) ?? null,
  hideFromSidebar: (d.hideFromSidebar as boolean | null | undefined) ?? null,
  hideFromParentTabs: (d.hideFromParentTabs as boolean | null | undefined) ?? null,
  sidebarOrder: (d.sidebarOrder as number | undefined) ?? 0,
  enabled: (d.enabled as boolean | undefined) ?? true,
  createdAt: toDate(d.createdAt),
  createdBy: (d.createdBy as string | undefined) ?? '',
  updatedAt: toDate(d.updatedAt),
  updatedBy: d.updatedBy as string | undefined,
  updatedByName: d.updatedByName as string | undefined,
  updatedByPhotoURL: d.updatedByPhotoURL as string | undefined,
});
