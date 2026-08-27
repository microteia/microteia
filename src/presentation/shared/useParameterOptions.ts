import { useMemo } from 'react';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useLookups } from '../../stores/useLookups';
import { ENTITY_REGISTRY } from '../../domain/schema/entityRegistry';
import { screenDataCollection } from '../../domain/services/screenDataCollection';
import type { SearchSelectOption } from '../components/ui/SearchSelect';
import { useLabel } from './i18n/useT';

/**
 * As entidades que um parâmetro pode referenciar. O valor é a COLEÇÃO, nunca a chave da tela — é
 * pela coleção que o registro é lido, que o esquema é resolvido e que a lista de escolha é montada.
 *
 * Oferecer a chave da tela deixava o parâmetro apontando para um nome que ninguém responde: a tela
 * de Processos entrava como `processos` enquanto os registros vivem em `cases`, e o campo abria sem
 * nenhuma opção para escolher. Duas telas podem descrever a mesma coleção; entra uma opção só, com
 * o rótulo de quem leva o nome dela.
 */
export const useEntityReferenceOptions = (): SearchSelectOption[] => {
  const { dynamicScreens } = useScreenDefinitions();
  const label = useLabel();

  return useMemo(() => {
    const byCollection = new Map<string, SearchSelectOption>();
    for (const definition of dynamicScreens) {
      const collection = screenDataCollection(definition);
      if (byCollection.has(collection) && definition.id !== collection) continue;
      byCollection.set(collection, { value: collection, label: label(definition.titlePlural) || collection });
    }

    return [
      ...Object.values(ENTITY_REGISTRY)
        .filter((entity) => entity.referenceable)
        .map((entity) => ({ value: entity.collection, label: label(entity.labelPlural) })),
      ...byCollection.values(),
    ];
  }, [dynamicScreens, label]);
};

/**
 * As listas de opções do escritório que um parâmetro pode adotar — as do kernel e as que o tenant
 * declarou, no mesmo seletor do Form Design.
 */
export const useLookupCollectionOptions = (): SearchSelectOption[] => {
  const { availableLookups } = useLookups();
  const label = useLabel();

  return useMemo(
    () => availableLookups.map((lookup) => ({
      value: lookup.collection,
      label: `${label(lookup.label, lookup.labelParams)} (${lookup.collection})`,
    })),
    [availableLookups, label],
  );
};
