export interface ResolvedActor {
  name: string;
  photoURL: string;
}

export interface IUserProfileLookupService {
  resolveActor(uid: string): Promise<ResolvedActor>;
  /**
   * O nome efetivo e a foto, SEM substituto: `name` vazio quando a pessoa não tem nome nenhum, que é
   * o que o front grava nesse caso. É a forma que vai para dentro de um registro (`createdByName`), onde
   * uma referência de mensagem como "usuário desconhecido" seria texto do produto gravado como dado.
   */
  resolveIdentity(uid: string): Promise<ResolvedActor>;
}
