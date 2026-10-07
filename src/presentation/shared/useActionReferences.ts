import { useCallback, useMemo } from 'react';
import { useTenant } from '../../stores/useTenant';
import { useAuthorization } from '../../stores/useAuthorization';
import { useDI } from '../../infrastructure/di/useDI';
import { makeGetRecordByIdUseCase } from '../../domain/usecases/records/GetRecordByIdUseCase';
import { collectionPermissionId } from '../../domain/schema/access';
import type { ReferenceLookup, ReferenceNavigator } from '../../domain/schema/referenceScope';
import { useRecordResolver } from './useRecordResolver';
import { useSchemaContext } from './useSchemaContext';

/**
 * Como uma expressão de AÇÃO chega ao registro que uma referência aponta: pela memória dos stores
 * (`lookup`, síncrono, para o que é desenhado em cada cartão) ou pelo repositório (`fetch`, para o
 * formulário de parâmetros, que pode esperar).
 *
 * As duas portas passam pelo MESMO portão: o registro de uma coleção que quem olha não pode ler não
 * existe para a expressão — nem na memória, nem buscado. Sem isso, um `parameterDefaults` seria um
 * jeito de mostrar num formulário o campo de um registro que a pessoa não abriria.
 */
export const useActionReferences = (): ReferenceNavigator => {
  const schema = useSchemaContext();
  const resolve = useRecordResolver();
  const { can } = useAuthorization();
  const { currentTenant } = useTenant();
  const { recordRepository } = useDI();
  const getById = useMemo(() => makeGetRecordByIdUseCase(recordRepository), [recordRepository]);

  const readable = useCallback(
    (collection: string) => can(collectionPermissionId(collection, 'read')),
    [can],
  );

  const lookup = useCallback<ReferenceLookup>(
    (collection, id) => (readable(collection) ? resolve(collection, id) : null),
    [readable, resolve],
  );

  const fetch = useCallback(async (collection: string, id: string) => {
    if (!currentTenant || !readable(collection)) return null;
    const record = await getById.execute(currentTenant.id, collection, id);
    return record ? (record as unknown as Record<string, unknown>) : null;
  }, [currentTenant, readable, getById]);

  return useMemo(() => ({ schema, lookup, fetch }), [schema, lookup, fetch]);
};
