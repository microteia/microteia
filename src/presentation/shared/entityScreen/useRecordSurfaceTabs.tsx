import { useMemo } from 'react';
import { recordSurface } from '../../../domain/schema/ui/uiExtensionPoints';
import { useVisibleSurfaceTabs } from '../settings/useSettingValue';
import { RecordSurfaceTab } from '../../components/layout/RecordSurfaceTab';
import type { EntityDetailExtraTab } from '../../components/layout/EntityDetailView';

export interface RecordSurfaceTabsInput {
  /** O `sourceId` da tela — o endereço da superfície. Vazio: a tela ainda não carregou. */
  screenSourceId: string;
  /** O registro aberto. `null` para registro NOVO, que não mostra aba contribuída. */
  record: { id: string } | null;
  collection: string;
}

/** O prefixo que separa a aba contribuída das nativas e das de telas-filhas (`child:`). */
const SURFACE_TAB_PREFIX = 'surface:';

/**
 * As abas que as extensões penduraram no detalhe desta tela (`ui.tab` em `record:<sourceId>`), na
 * ordem e com o liga/desliga que o escritório escolheu em Configurações. Entram DEPOIS das nativas e
 * das de telas-filhas — é quem hospeda a faixa que decide isso, juntando as listas.
 */
export const useRecordSurfaceTabs = (input: RecordSurfaceTabsInput): EntityDetailExtraTab[] => {
  const { screenSourceId, record, collection } = input;
  const { tabs } = useVisibleSurfaceTabs(screenSourceId ? recordSurface(screenSourceId) : '');

  return useMemo(() => {
    if (!record || !screenSourceId) return [];
    const recordProps = {
      recordId: record.id,
      record: record as unknown as Record<string, unknown>,
      collection,
      screenSourceId,
    };
    return tabs.map((tab) => ({
      key: `${SURFACE_TAB_PREFIX}${tab.key}`,
      label: tab.title,
      content: <RecordSurfaceTab tab={tab} recordProps={recordProps} />,
    }));
  }, [tabs, record, collection, screenSourceId]);
};
