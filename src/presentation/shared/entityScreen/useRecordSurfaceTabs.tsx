import { useMemo } from 'react';
import { useAuthorization } from '../../../stores/useAuthorization';
import { screenReadPermission } from '../../../domain/services/screenDataCollection';
import { useRecordTabLayout, type RecordTabCatalogItem } from '../settings/useRecordTabCatalog';
import { ChildRecordList } from '../../components/layout/ChildRecordList';
import { RecordSurfaceTab } from '../../components/layout/RecordSurfaceTab';
import type { EntityDetailExtraTab } from '../../components/layout/EntityDetailView';
import type { RecordTabProps } from '../../../domain/schema/ui/uiExtensionPoints';

export interface RecordSurfaceTabsInput {
  /** O `sourceId` da tela — o endereço da superfície. Vazio: a tela ainda não carregou. */
  screenSourceId: string;
  /** A coleção dos registros desta tela — a que as telas-filhas declaram em `parentEntity`. */
  collection: string;
  /** O registro aberto. `null` para registro NOVO, que não mostra aba nenhuma além de Dados. */
  record: { id: string } | null;
}

/** O prefixo que separa a aba contribuída das de telas-filhas (`child:`) no estado do detalhe. */
const SURFACE_TAB_PREFIX = 'surface:';

/**
 * Sem permissão de ler a coleção da filha, a aba dela não existe — a terceira porta do mesmo defeito
 * depois do menu e do ⌘K: uma aba que só pode mostrar vazio é uma pergunta feita a quem não pode
 * responder. A aba contribuída pede o que ela mesma declarou (uma permissão basta).
 */
const isVisibleTo = (item: RecordTabCatalogItem, can: (p: string) => boolean, canAny: (p: string[]) => boolean): boolean => {
  if (item.childScreen) return can(screenReadPermission(item.childScreen));
  const required = item.tab?.requiredPermissions;
  return !required?.length || canAny(required);
};

/**
 * A faixa de abas do detalhe além de Dados, Anotações e Documentos: telas-filhas e abas contribuídas
 * em `record:<sourceId>`, numa lista SÓ, na ordem e com o liga/desliga de `record:<sourceId>.tabs`.
 * Sem configuração, vale a ordem de sempre — filhas primeiro, contribuídas depois.
 */
export const useRecordSurfaceTabs = (input: RecordSurfaceTabsInput): EntityDetailExtraTab[] => {
  const { screenSourceId, collection, record } = input;
  const { catalog, entries } = useRecordTabLayout(screenSourceId);
  const { can, canAny } = useAuthorization();

  return useMemo(() => {
    if (!record) return [];
    const byKey = new Map(catalog.map((item) => [item.key, item]));
    const recordProps: RecordTabProps = {
      recordId: record.id,
      record: record as unknown as Record<string, unknown>,
      collection,
      screenSourceId,
    };

    return entries
      .filter((entry) => entry.enabled)
      .map((entry) => byKey.get(entry.key))
      .filter((item): item is RecordTabCatalogItem => !!item && isVisibleTo(item, can, canAny))
      .map((item): EntityDetailExtraTab => (item.childScreen
        ? {
            key: item.key,
            label: item.title,
            content: (
              <ChildRecordList
                screenKey={item.childScreen.id}
                parentEntity={collection}
                parentFieldKey={item.childScreen.parentFieldKey as string}
                parentId={record.id}
              />
            ),
          }
        : {
            key: `${SURFACE_TAB_PREFIX}${item.key}`,
            label: item.title,
            content: <RecordSurfaceTab tab={item.tab as NonNullable<RecordTabCatalogItem['tab']>} recordProps={recordProps} />,
          }));
  }, [catalog, entries, record, collection, screenSourceId, can, canAny]);
};
