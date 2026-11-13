export const CORE_ASSISTANT: Record<string, string> = {
  'error.not-enabled': 'O assistente de IA não está habilitado neste escritório.',
  'error.provider-unsupported': 'A conexão de IA configurada ({provider}) não consegue conversar.',
  'error.provider': 'O provedor de IA retornou um erro: {detail}',
  'error.busy': 'Esta conversa ainda está respondendo. Aguarde terminar, ou interrompa, e tente de novo.',
  'error.not-found': 'Conversa não encontrada.',
  'error.invalid-request': 'O pedido ao assistente está incompleto.',
  'error.message-too-long': 'A mensagem é longa demais — no máximo {max} caracteres.',
  'error.title-invalid': 'O título deve ter entre 1 e {max} caracteres.',
  'error.nothing-pending': 'Não há nada aguardando a sua aprovação nesta conversa.',
  'error.nothing-to-compact': 'Ainda não há o que resumir.',

  'notice.max-steps': 'O assistente parou depois de {count} passos. Peça para continuar se ainda houver o que fazer.',
  'notice.truncated': 'A resposta atingiu o limite de tamanho da conexão de IA e foi cortada.',
  'notice.refused': 'A IA se recusou a responder a este pedido.',
  'notice.compacted': 'A parte anterior da conversa foi resumida para caber no tamanho configurado.',
  'notice.interrupted': 'A resposta foi interrompida antes de terminar.',
};
