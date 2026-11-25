export interface ResolvedActor {
  name: string;
  photoURL: string;
}

/**
 * O autor da linha de Auditoria que ninguém praticou — gatilho do servidor sem `updatedBy`, falha do
 * próprio pipeline. É REFERÊNCIA, nunca a palavra: gravada como dado, "Sistema" aparecia em português
 * para todo leitor (#30). Quem mostra o autor o resolve como resolve `@core.workspace/user.unknown`.
 */
export const SYSTEM_ACTOR_NAME = '@core.admin/audit.entity.system';

export interface IUserProfileLookupService {
  /** O autor para a Auditoria: o nome efetivo, ou uma REFERÊNCIA de mensagem quando não há pessoa. */
  resolveActor(uid: string): Promise<ResolvedActor>;
  /**
   * O nome efetivo e a foto, SEM substituto: `name` vazio quando a pessoa não tem nome nenhum, que é
   * o que o front grava nesse caso. É a forma que vai para dentro de um registro (`createdByName`), onde
   * uma referência de mensagem como "usuário desconhecido" seria texto do produto gravado como dado.
   */
  resolveIdentity(uid: string): Promise<ResolvedActor>;
}
