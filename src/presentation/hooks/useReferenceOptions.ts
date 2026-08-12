import { useMemo } from 'react';
import { useRecords } from '../../stores/useRecords';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useTenant } from '../../stores/useTenant';
import { screenDataCollection } from '../../domain/services/screenDataCollection';
import { readRecordText, resolveRecordTitle } from '../../domain/services/customFieldValues';
import type { ScreenDefinition } from '../../domain/entities';

export interface ReferenceOption {
  value: string;
  label: string;
  meta?: string;
}

export const useReferenceOptions = (): Record<string, ReferenceOption[]> => {
  const { recordsByCollection } = useRecords();
  const { dynamicScreens } = useScreenDefinitions();
  const { members } = useTenant();

  /**
   * A tela que descreve cada COLEÇÃO — e não a que tem o nome dela.
   *
   * A chave da tela e a coleção divergem sempre que a tela vem de uma extensão: `processos` descreve
   * `cases`, `prazos` descreve `deadlines`. Procurar a tela pelo nome da coleção não achava nenhuma,
   * e todo registro referenciado virava "Sem título" — no cartão, no filtro e no formulário.
   *
   * Duas telas podem apontar para a mesma coleção (uma visão sobre a outra); vale a que a possui.
   */
  const definitionByCollection = useMemo(() => {
    const map = new Map<string, ScreenDefinition>();
    dynamicScreens.forEach((definition) => {
      const collection = screenDataCollection(definition);
      const current = map.get(collection);
      if (!current || definition.id === collection) map.set(collection, definition);
    });
    return map;
  }, [dynamicScreens]);

  return useMemo(() => {
    // Só o que NÃO é tela do escritório fica nomeado aqui. Toda coleção descrita por uma tela entra
    // pelo caminho genérico abaixo: o rótulo sai do campo-título e o complemento, do subtítulo.
    const map: Record<string, ReferenceOption[]> = {
      members: members
        .map((m) => ({ value: m.userId, label: m.displayName }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
    Object.entries(recordsByCollection).forEach(([collection, records]) => {
      const definition = definitionByCollection.get(collection);
      const titleFieldKey = definition?.titleFieldKey ?? '';
      const subtitleFieldKey = definition?.subtitleFieldKey ?? '';
      map[collection] = records
        .map((r) => ({
          value: r.id,
          label: resolveRecordTitle(r, titleFieldKey),
          meta: readRecordText(r, subtitleFieldKey) || undefined,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    });

    // A CHAVE da tela também responde, ao lado da coleção. Quem aponta para uma entidade grava a
    // coleção — mas declarações antigas guardaram a chave da tela (`processos` no lugar de `cases`),
    // e uma referência gravada assim ficava com a lista vazia, sem nada a escolher. Aqui ela volta a
    // achar os registros; o autor não precisa reabrir o que já declarou.
    dynamicScreens.forEach((definition) => {
      const collection = screenDataCollection(definition);
      if (definition.id !== collection && map[collection] && !map[definition.id]) {
        map[definition.id] = map[collection];
      }
    });
    return map;
  }, [recordsByCollection, definitionByCollection, dynamicScreens, members]);
};
