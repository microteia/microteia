import type { IScreenDefinitionProvider } from './IScreenDefinitionProvider';
import type { SchemaScreen } from '../schema/pathResolver';
import { createSchemaContext } from '../schema/pathResolver';
import type { SchemaLookup } from '../schema/screenEntity';

/**
 * Provider de teste. Existe para que acrescentar um membro à interface não obrigue a reescrever o
 * mesmo objeto literal em cada suíte — foi o que aconteceu quando as listas entraram no contexto.
 */
export const fakeScreenProvider = (
  screens: SchemaScreen[],
  lookups: SchemaLookup[] = [],
): IScreenDefinitionProvider => ({
  getScreens: async () => screens,
  getLookups: async () => lookups,
  getSchemaContext: async () => createSchemaContext(screens, lookups),
});
