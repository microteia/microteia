import { useMemo } from 'react';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { createSchemaContext, type SchemaContext } from '../../domain/schema/pathResolver';

export const useSchemaContext = (): SchemaContext => {
  const { definitions } = useScreenDefinitions();
  return useMemo(
    () =>
      createSchemaContext(
        definitions.map((definition) => ({
          id: definition.id,
          titleSingular: definition.titleSingular,
          titlePlural: definition.titlePlural,
          titleFieldKey: definition.titleFieldKey,
          fields: definition.fields,
        })),
      ),
    [definitions],
  );
};
