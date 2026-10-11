import { useCallback } from 'react';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useLabel } from './i18n/useT';
import { screenDataCollection } from '../../domain/services/screenDataCollection';

export interface CollectionIdentity {
  /** A chave da tela que apresenta a coleção hoje. */
  screenKey: string;
  title: string;
  titlePlural: string;
  icon: string | null;
}

/**
 * COMO uma coleção se apresenta — o ícone e o nome da tela que a descreve hoje —, sem saber que tela
 * é essa. O irmão de `useOpenRecord`: aquele abre o registro de uma coleção, este diz de onde ele é.
 *
 * Existe para a superfície que mostra registros de VÁRIAS origens lado a lado (a agenda, um feed) e
 * precisa dizer ao usuário de qual delas cada um veio. A resposta é derivada da tela, então ela muda
 * quando o escritório renomeia a tela ou troca o ícone — e nenhum registro precisa ser regravado.
 *
 * A coleção é procurada também pela CHAVE da tela, pela mesma razão que em `useReferenceOpener`:
 * declarações antigas gravaram a chave onde hoje se grava a coleção. Sem tela nenhuma (extensão
 * desinstalada), `null`.
 */
export const useCollectionIdentity = (): ((collection: string | null | undefined) => CollectionIdentity | null) => {
  const { dynamicScreens } = useScreenDefinitions();
  const label = useLabel();

  return useCallback(
    (collection) => {
      const key = collection?.trim();
      if (!key) return null;
      const screen =
        dynamicScreens.find((definition) => screenDataCollection(definition) === key) ??
        dynamicScreens.find((definition) => definition.id === key);
      if (!screen) return null;
      return {
        screenKey: screen.id,
        title: label(screen.titleSingular),
        titlePlural: label(screen.titlePlural),
        icon: screen.icon ?? null,
      };
    },
    [dynamicScreens, label],
  );
};
