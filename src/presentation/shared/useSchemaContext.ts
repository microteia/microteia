import { useMemo } from 'react';
import { useScreenDefinitions } from '../../stores/useScreenDefinitions';
import { useLookups } from '../../stores/useLookups';
import { useTags } from '../../stores/useTags';
import { toSchemaScreens } from '../../data/utils/recordRulesGate';
import { createSchemaContext, type SchemaContext } from '../../domain/schema/pathResolver';

/**
 * O contexto de schema que a TELA enxerga, e ele passa pela MESMA tradução da gravação
 * (`toSchemaScreens`) — não por uma cópia dela.
 *
 * Aqui morava a segunda cópia, campo a campo, com um comentário dizendo que era "a mesma tradução".
 * Não era: uma propriedade nova entrava numa e não na outra, e o sintoma nascia longe — a tela
 * resolvia sem aquilo, a gravação com. Foi o que aconteceu com as chaves, que a tela não via.
 */
export const useSchemaContext = (): SchemaContext => {
  const { definitions } = useScreenDefinitions();
  const { availableLookups } = useLookups();
  const { availableTagLists } = useTags();
  return useMemo(
    () => createSchemaContext(toSchemaScreens(definitions), availableLookups, availableTagLists),
    [definitions, availableLookups, availableTagLists],
  );
};
