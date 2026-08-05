import React from 'react';
import { RunModal } from '../RunModal';
import type { ActionParameterPromptController } from '../../../shared/entityScreen/useActionParameterPrompt';

/**
 * O formulário de uma ação que PERGUNTA antes de executar. É o mesmo modal da execução manual de um
 * fluxo, em modo de coleta: confirma, fecha, e o resultado segue pelo caminho de sempre da Action —
 * mensagem na tela e os comandos que o fluxo devolver.
 *
 * Nada aqui é do Push nem de nenhuma tela: quem diz que a ação pergunta, e com o que os campos
 * abrem, é a declaração da própria Action.
 */
export const ActionParametersModal: React.FC<{ controller: ActionParameterPromptController }> = ({
  controller,
}) => {
  const { pending } = controller;
  if (!pending) return null;
  return (
    <RunModal
      title={pending.action.title}
      parameters={pending.parameters}
      initialValues={pending.initialValues}
      collectOnly
      runLabel={pending.action.title}
      onClose={controller.cancel}
      onRun={async (params) => { controller.confirm(params); }}
    />
  );
};
