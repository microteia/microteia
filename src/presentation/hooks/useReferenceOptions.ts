import { useMemo } from 'react';
import { useLookups } from '../../stores/useLookups';
import { useRecords } from '../../stores/useRecords';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useTenant } from '../../stores/useTenant';
import { useLabel, useT } from '../shared/i18n/useT';
import { buildRecordTitleResolver, buildReferenceOptions } from './buildReferenceOptions';
import type { EntityRecord } from '../../domain/entities';
import type { ReferenceOption } from './buildReferenceOptions';

export type { ReferenceOption };

export const useReferenceOptions = (): Record<string, ReferenceOption[]> => {
  const t = useT('core.records');
  const label = useLabel();
  const { getOptions } = useLookups();
  // Os CONHECIDOS, e não só a janela: o registro trazido por id ou achado pela busca no servidor
  // também é opção, e o nome do apontado que ficou fora dos 500 carregados aparece no cartão.
  const { knownRecordsByCollection } = useRecords();
  const { dynamicScreens } = useScreenDefinitions();
  const { members } = useTenant();

  return useMemo(
    () => buildReferenceOptions({
      recordsByCollection: knownRecordsByCollection,
      dynamicScreens,
      members,
      getOptions,
      label,
      untitled: t('record.untitled'),
    }),
    [knownRecordsByCollection, dynamicScreens, members, getOptions, label, t],
  );
};

/**
 * O título legível de um registro, com a mesma resolução das opções de referência — para quem mostra
 * registros pelo título fora de um campo de referência (o ⌘K). Vazio quando ele não tem título.
 */
export const useRecordTitleResolver = (): ((record: EntityRecord) => string) => {
  const t = useT('core.records');
  const label = useLabel();
  const { getOptions } = useLookups();
  const { knownRecordsByCollection } = useRecords();
  const { dynamicScreens } = useScreenDefinitions();
  const { members } = useTenant();

  return useMemo(
    () => buildRecordTitleResolver({
      recordsByCollection: knownRecordsByCollection,
      dynamicScreens,
      members,
      getOptions,
      label,
      untitled: t('record.untitled'),
    }),
    [knownRecordsByCollection, dynamicScreens, members, getOptions, label, t],
  );
};
