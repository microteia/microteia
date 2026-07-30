import type { SchemaContext, SchemaScreen } from '../schema/pathResolver';
import type { SchemaLookup } from '../schema/screenEntity';

/**
 * As declarações do tenant que a camada de schema precisa para resolver uma tabela: as telas e as
 * listas de opções. As duas viajam juntas porque montam o MESMO `SchemaContext` — separá-las faria
 * cada chamador lembrar de buscar as duas, e uma automação gravaria numa lista "inexistente".
 */
export interface IScreenDefinitionProvider {
  getScreens: (tenantId: string) => Promise<SchemaScreen[]>;
  getLookups: (tenantId: string) => Promise<SchemaLookup[]>;
  getSchemaContext: (tenantId: string) => Promise<SchemaContext>;
}
