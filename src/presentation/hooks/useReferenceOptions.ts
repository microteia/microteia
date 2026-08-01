import { useMemo } from 'react';
import { useDeadlineStore } from '../../stores/useDeadlineStore';
import { useRecords } from '../../stores/useRecords';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useTenant } from '../../stores/useTenant';
import { readRecordText, resolveRecordTitle } from '../../domain/services/customFieldValues';

export interface ReferenceOption {
  value: string;
  label: string;
  meta?: string;
}

export const useReferenceOptions = (): Record<string, ReferenceOption[]> => {
  const { deadlines } = useDeadlineStore();
  const { recordsByCollection } = useRecords();
  const { getDefinition } = useScreenDefinitions();
  const { members } = useTenant();

  return useMemo(() => {
    // Só o que NÃO é tela do escritório fica nomeado aqui. `persons`, `contracts`, `cases` e
    // `financials` entram pelo caminho genérico abaixo, como qualquer coleção descrita por uma tela:
    // o rótulo sai do campo-título e o complemento, do subtítulo.
    const map: Record<string, ReferenceOption[]> = {
      members: members
        .map((m) => ({ value: m.userId, label: m.displayName }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      deadlines: deadlines
        .map((d) => ({ value: d.id, label: d.type }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    };
    // Toda coleção descrita por uma tela do escritório entra pelo mesmo caminho: o rótulo sai do
    // campo-título e o complemento do campo-subtítulo, ambos declarados na tela.
    Object.entries(recordsByCollection).forEach(([collection, records]) => {
      const definition = getDefinition(collection);
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
    return map;
  }, [deadlines, recordsByCollection, getDefinition, members]);
};
