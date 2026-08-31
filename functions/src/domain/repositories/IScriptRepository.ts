import type { Script } from '../entities/Script';

export interface IScriptRepository {
  findById(tenantId: string, id: string): Promise<Script | null>;
  /**
   * O id local, ou a referência qualificada `<pluginId>/<sourceId>` a um script de outra extensão.
   * É UM método porque quem chama não sabe — nem precisa saber — qual das duas formas o passo
   * guarda; a distinção é do repositório, e é ele que a resolve.
   */
  findByRef(tenantId: string, ref: string): Promise<Script | null>;
}
