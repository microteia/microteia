import type { SchemaScreen } from '../schema/pathResolver';

export interface IScreenDefinitionProvider {
  getScreens: (tenantId: string) => Promise<SchemaScreen[]>;
}
