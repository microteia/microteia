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
        // Mesma tradução do `toSchemaScreens` da gravação — inclusive `collection`, que faz a tela
        // entrar pela coleção que descreve quando não é a de mesmo nome.
        definitions.map((definition) => ({
          id: definition.id,
          collection: definition.dataCollection ?? undefined,
          titleSingular: definition.titleSingular,
          titlePlural: definition.titlePlural,
          titleFieldKey: definition.titleFieldKey,
          fields: definition.fields,
          tagCollection: definition.tagCollection,
          eventPrefix: definition.eventPrefix,
        })),
        availableLookups,
        availableTagLists,
      ),
    [definitions, availableLookups, availableTagLists],
  );
};
