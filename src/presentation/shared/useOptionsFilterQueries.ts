import { useEffect, useMemo } from 'react';
import { useRecords } from '../../stores/useRecords';
import { optionsFilterRecordQuery } from '../../domain/services/optionsFilterQuery';
import type { FieldDefinition } from '../../domain/entities';
import type { ResolvedOptionsFilter } from '../../domain/schema/optionsFilter';
import type { RecordQuerySpec } from '../../domain/services/recordListQuery';

/**
 * Mantém assinadas as consultas das referências filtradas enquanto o formulário estiver aberto. O
 * que elas trazem passa a ser CONHECIDO no `RecordStore` — e é daí que o seletor tira as opções.
 */
export const useOptionsFilterQueries = (
  fields: readonly FieldDefinition[],
  filterOf: (field: FieldDefinition) => ResolvedOptionsFilter | null,
): void => {
  const { watchQuery } = useRecords();

  // Serializado para que a mesma consulta, recalculada a cada tecla, não seja solta e pedida de novo.
  const specsKey = useMemo(
    () => JSON.stringify(fields.flatMap((field) => {
      const spec = optionsFilterRecordQuery(field, filterOf(field));
      return spec ? [spec] : [];
    })),
    [fields, filterOf],
  );

  useEffect(() => {
    const specs = JSON.parse(specsKey) as RecordQuerySpec[];
    const releases = specs.map((spec) => watchQuery(spec));
    return () => releases.forEach((release) => release());
  }, [specsKey, watchQuery]);
};
