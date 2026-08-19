import { useMemo } from 'react';
import { useContributions, useKernel } from '../../../stores/useKernel';
import { UI_RECORD_ACTION_POINT } from '../../../domain/schema/ui/uiExtensionPoints';
import type { UiRecordActionMetadata } from '../../../domain/schema/ui/uiExtensionPoints';
import type { RecordActionCommand } from './recordActionHost';

export interface ResolvedRecordAction {
  metadata: UiRecordActionMetadata;
  /** O papel que a ação ocupa; duas ações no mesmo slot disputam o mesmo lugar. */
  slot: string;
  run: RecordActionCommand;
}

/**
 * As ações de registro contribuídas, resolvidas e ordenadas. O kernel não conhece nenhuma pelo
 * nome: `copyLink` e `delete` chegam aqui pelo mesmo caminho que a ação de uma extensão.
 */
export const useRecordActions = (): ResolvedRecordAction[] => {
  const { host } = useKernel();
  const contributions = useContributions(UI_RECORD_ACTION_POINT);

  return useMemo(
    () => contributions
      .flatMap((contribution) => {
        if (contribution.impl?.kind !== 'code') return [];
        const run = host.implementations.resolve<RecordActionCommand>(
          contribution.pluginId,
          contribution.impl.key,
        );
        if (typeof run !== 'function') return [];
        const metadata = contribution.metadata as unknown as UiRecordActionMetadata;
        return [{ metadata, slot: metadata.slot ?? metadata.key, run }];
      })
      .sort((a, b) => a.metadata.order - b.metadata.order),
    [contributions, host],
  );
};
