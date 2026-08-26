import type { AICredentials } from '../../../domain/entities/AICredentials';
import type { AIStepDeps } from '../stepDeps';

/**
 * A conexão de IA de um passo: a que ele nomeia, ou a padrão do escritório quando ele não nomeia
 * nenhuma.
 *
 * O padrão é o caso normal, e é por isso que o input é opcional: a automação declarada não deve
 * carregar o id de uma conexão que quem instala o pacote nem criou ainda. Nomear uma conexão é para
 * quando o escritório tem mais de uma e quer que ESTE passo use um modelo específico.
 */
export const resolveAICredentials = async (
  deps: AIStepDeps,
  tenantId: string,
  connectionId: unknown,
): Promise<AICredentials> => {
  const id = connectionId ? String(connectionId).trim() : '';
  return id
    ? deps.aiConnectionRepository.getCredentialsById(tenantId, id)
    : deps.aiConnectionRepository.getDefaultCredentials(tenantId);
};
