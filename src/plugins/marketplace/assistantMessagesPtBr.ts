import { messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import { ASSISTANT_NAMESPACE } from './assistantMessages';

/** **Portuguese (Brazil) for AI Assistant** — the translation that travels inside the extension. */
const ASSISTANT_PT_BR: Record<string, string> = {
  'package.name': 'Assistente de IA',
  'package.category': 'Produtividade',
  'package.description':
    'Um chat fixado ao lado do espaço de trabalho que responde perguntas e trabalha nos dados deste escritório, com as permissões de quem pergunta.',
  'package.summary':
    'Acrescenta um assistente de IA ao lado do espaço de trabalho. Pergunte em linguagem comum e ele pesquisa registros, roda relatórios e, se o escritório permitir, cadastra e altera dados — sempre com as permissões de quem pergunta, nunca mais. Ele usa a conexão de IA que o escritório já configurou.',

  'overview.body':
    'O **Assistente de IA** deixa uma conversa com a conexão de IA do escritório a um atalho de distância, ao '
    + 'lado do que você estiver fazendo.\n\n'
    + '- Ele **usa a conexão de IA que o escritório já tem** — OpenAI, Anthropic, Google, Mistral ou Cohere. '
    + 'Nada mais a configurar.\n'
    + '- Ele age com as **permissões de quem pergunta**: vê o que a pessoa vê e altera só o que ela poderia '
    + 'alterar.\n'
    + '- **Alterações esperam a sua aprovação** por padrão. O escritório pode deixá-las rodar direto, ou '
    + 'transformar o assistente em somente leitura.\n'
    + '- As respostas chegam **enquanto são escritas**, e conversas longas são **resumidas automaticamente** '
    + 'para manter o custo sob controle.\n'
    + '- Cada pessoa tem as **próprias conversas**; ninguém mais as lê.',
  'overview.connection': 'Conexão de IA',
  'overview.connection.value': 'A conexão de IA padrão do escritório',
  'overview.limit': 'Limite',
  'overview.limit.value': 'As permissões de quem pergunta',
  'overview.changes': 'Alterações nos dados',
  'overview.changes.value': 'Aprovadas uma a uma, executadas direto ou não permitidas — o escritório decide',

  'permission.use': 'Usar o assistente de IA',
  'permission.use.description': 'Abrir o assistente e conversar com ele. O que ele pode fazer continua limitado pelas demais permissões da pessoa.',

  'settings.section.title': 'Assistente de IA',
  'settings.section.description': 'Como o assistente se comporta neste escritório.',
  'settings.write-mode': 'Alterações nos dados',
  'settings.write-mode.description':
    'O que acontece quando o assistente quer criar, alterar ou excluir algo, ou rodar uma automação.',
  'settings.write-mode.confirm': 'Pedir aprovação a cada vez',
  'settings.write-mode.auto': 'Executar direto',
  'settings.write-mode.off': 'Não permitir — somente leitura',
  'settings.context-tokens': 'Tamanho da conversa antes de resumir',
  'settings.context-tokens.description':
    'Em tokens. Quando uma conversa chega perto deste tamanho, a parte anterior é resumida antes da próxima pergunta. Maior guarda mais detalhe e custa mais por pergunta.',
};

export const assistantPtBrContribution = (): Contribution =>
  messageBundleContribution({ locale: 'pt-BR', namespace: ASSISTANT_NAMESPACE, messages: ASSISTANT_PT_BR });
