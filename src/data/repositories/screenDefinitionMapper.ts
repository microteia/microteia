import { Timestamp } from 'firebase/firestore';
import type { FieldDefinition, ScreenDefinition } from '../../domain/entities';

const toDate = (v: unknown): Date =>
  v instanceof Timestamp ? v.toDate() : (v as Date);

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
  builtin: (d.builtin as boolean | undefined) ?? false,
  titleSingular: (d.titleSingular as string | undefined) ?? '',
  titlePlural: (d.titlePlural as string | undefined) ?? '',
  icon: (d.icon as string | undefined) ?? 'apps',
  fields: (d.fields as FieldDefinition[] | undefined) ?? [],
  nativeFieldOverrides:
    (d.nativeFieldOverrides as ScreenDefinition['nativeFieldOverrides'] | undefined) ?? null,
  fieldOrderUnified: (d.fieldOrderUnified as boolean | undefined) ?? null,
  titleFieldKey: (d.titleFieldKey as string | undefined) ?? '',
  hasNotes: (d.hasNotes as boolean | undefined) ?? false,
  hasDocuments: (d.hasDocuments as boolean | undefined) ?? false,
  hasTags: (d.hasTags as boolean | undefined) ?? false,
  listActions: (d.listActions as ScreenDefinition['listActions'] | undefined) ?? [],
  viewActionIds: (d.viewActionIds as string[] | undefined) ?? [],
  cardActionIds: (d.cardActionIds as string[] | undefined) ?? [],
  parentEntity: (d.parentEntity as string | null | undefined) ?? null,
  parentFieldKey: (d.parentFieldKey as string | null | undefined) ?? null,
  ownerPluginId: (d.ownerPluginId as string | null | undefined) ?? null,
  managed: (d.managed as boolean | null | undefined) ?? null,
  sidebarOrder: (d.sidebarOrder as number | undefined) ?? 0,
  enabled: (d.enabled as boolean | undefined) ?? true,
  createdAt: toDate(d.createdAt),
  createdBy: (d.createdBy as string | undefined) ?? '',
  updatedAt: toDate(d.updatedAt),
  updatedBy: d.updatedBy as string | undefined,
  updatedByName: d.updatedByName as string | undefined,
  updatedByPhotoURL: d.updatedByPhotoURL as string | undefined,
});
