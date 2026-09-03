import { useCallback } from 'react';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useWorkspace } from '../../stores/useWorkspace';
import { useAuthorization } from '../../stores/useAuthorization';
import { screenDataCollection, screenReadPermission } from '../../domain/services/screenDataCollection';
import { recordTabKeyOf } from '../../shared/constants/dynamicScreenKeys';

export type ReferenceOpener = (recordId: string) => void;

/**
 * O ATALHO para o registro que um campo referencia — e o `null` que diz que não há para onde ir.
 *
 * `useOpenRecord` abre; este resolve ANTES se existe destino, que é o que um controle precisa saber
 * para decidir se mostra o gesto. Um campo só ganha o atalho quando três coisas valem juntas: a
 * referência aponta para uma coleção, alguma tela DESCREVE essa coleção, e quem está olhando pode
 * lê-la. Sem as três, nada aparece — lista de opções, lookup e texto livre não referenciam registro
 * nenhum, e oferecer o gesto ali abriria aba morta ou uma tela que o servidor mantém vazia.
 *
 * A coleção é procurada também pela CHAVE da tela, pela mesma razão que em `useReferenceOptions`:
 * declarações antigas gravaram a chave (`processos`) onde hoje se grava a coleção (`cases`), e quem
 * já declarou assim não precisa reabrir o que fez para ganhar o atalho.
 */
export const useReferenceOpener = (): ((collection: string | null | undefined) => ReferenceOpener | null) => {
  const { dynamicScreens } = useScreenDefinitions();
  const { openTab } = useWorkspace();
  const { can } = useAuthorization();

  return useCallback(
    (collection) => {
      const key = collection?.trim();
      if (!key) return null;
      const screen =
        dynamicScreens.find((definition) => screenDataCollection(definition) === key) ??
        dynamicScreens.find((definition) => definition.id === key);
      if (!screen || !can(screenReadPermission(screen))) return null;
      return (recordId: string) => {
        if (recordId) openTab(recordTabKeyOf(screen, screen.id, recordId));
      };
    },
    [dynamicScreens, openTab, can],
  );
};
