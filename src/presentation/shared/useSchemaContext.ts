import { useMemo } from 'react';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useLookups } from '../../stores/useLookups';
import { useTags } from '../../stores/useTags';
import { createSchemaContext, type SchemaContext } from '../../domain/schema/pathResolver';

export const useSchemaContext = (): SchemaContext => {
  const { definitions } = useScreenDefinitions();
  const { availableLookups } = useLookups();
  const { availableTagLists } = useTags();
  return useMemo(
    () =>
      createSchemaContext(
        definitions.map((definition) => ({
          id: definition.id,
          titleSingular: definition.titleSingular,
          titlePlural: definition.titlePlural,
          titleFieldKey: definition.titleFieldKey,
          fields: definition.fields,
          tagCollection: definition.tagCollection,
        })),
        availableLookups,
        availableTagLists,
      ),
    [definitions, availableLookups, availableTagLists],
  );
};
