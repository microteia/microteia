import { messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import { AGENT_NAMESPACE } from './agentMessages';

/**
 * **Portuguese (Brazil) for AI Agent Access** — the translation that travels INSIDE the extension
 * that owns the text.
 *
 * Same mechanism as every other extension: an `i18n.messages` contribution under the OWNER's
 * namespace. Being here is what makes the extension readable in Portuguese with no language package
 * installed at all.
 */
const AGENT_PT_BR: Record<string, string> = {
  'package.name': 'Acesso de Agente de IA',
  'package.category': 'Produtividade',
  'package.description':
    'Permite que um agente de IA leia e altere os dados deste escritório, com as permissões que cada pessoa liberar e nada além.',
  'package.summary':
    'Liga uma conexão que um agente de IA pode usar para trabalhar dentro deste escritório — pesquisar registros, cadastrar, alterar, rodar um relatório ou uma automação — sem nenhum acesso ao banco de dados. Cada pessoa emite o próprio acesso, escolhe quais permissões ele pode usar e por quanto tempo, e o revoga quando quiser. Um acesso nunca pode mais do que a pessoa que o emitiu.',

  'settings.section.title': 'Acesso de agente de IA',
  'settings.section.description': 'Como os acessos são emitidos neste escritório.',
  'settings.self-service': 'Todo membro pode emitir o próprio acesso',
  'settings.self-service.description':
    'Ligado, qualquer pessoa emite um acesso para si — o que não concede nada de novo, já que um '
    + 'acesso nunca excede as permissões que ela já tem. Desligado, emitir um passa a exigir a '
    + 'permissão de gerenciar acessos de agente de IA.',
};

export const agentPtBrContribution = (): Contribution =>
  messageBundleContribution({ locale: 'pt-BR', namespace: AGENT_NAMESPACE, messages: AGENT_PT_BR });
