import type { ActorVia, WorkflowActor } from '../../domain/entities/WorkflowContext';
import { getDI } from '../di/container';

/**
 * O ator completo de uma execução que uma PESSOA causou: o uid e as permissões que a porta de entrada
 * já conferiu, mais o nome efetivo e a foto — pela mesma regra que o formulário usa para gravar
 * `createdByName`, para que o registro tenha a mesma forma qualquer que seja o caminho.
 */
export const identifyActor = async (
  userId: string,
  via: ActorVia,
  permissions: string[],
): Promise<WorkflowActor> => {
  const identity = await getDI().getUserProfileLookupService().resolveIdentity(userId);
  return { userId, name: identity.name, photoURL: identity.photoURL, via, permissions };
};
