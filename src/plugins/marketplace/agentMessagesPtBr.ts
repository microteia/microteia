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

  'overview.body':
    'O **Acesso de Agente de IA** permite que um assistente de IA trabalhe dentro deste escritório, '
    + 'sobre os dados do próprio escritório, sem nenhum acesso ao banco de dados.\n\n'
    + '- Cada pessoa tem **o próprio acesso**, e ele é sempre **dela**: leva o nome dela, as permissões '
    + 'dela e as de mais ninguém.\n'
    + '- O acesso declara **quais permissões pode usar** e, se você quiser, **quando expira**.\n'
    + '- Um acesso **nunca pode mais do que a pessoa que o detém**: perdeu um perfil, e todo acesso seu '
    + 'se estreita na chamada seguinte.\n'
    + '- Qualquer acesso pode ser **revogado a qualquer momento**, e para de funcionar na hora.\n\n'
    + 'Há duas formas de conectar, e o escritório não precisa escolher uma — as duas funcionam ao '
    + 'mesmo tempo, e as duas terminam na mesma lista.\n\n'
    + '**Entrando com a conta.** O assistente pede só o endereço da conexão. A pessoa entra com a '
    + 'própria conta, escolhe quais permissões liberar, e pronto — nenhum token é copiado nem colado. '
    + 'Os clientes que sabem entrar, o Claude na web entre eles, devem usar esta forma: é ela que '
    + 'impede o assistente de uma pessoa de agir como outra.\n\n'
    + '**Um token.** Para um cliente que não sabe entrar, um acesso emitido em Escritório → Agentes de '
    + 'IA gera um token para colar nele. O token é mostrado uma única vez e guardado só como impressão '
    + 'digital, por isso um token perdido é substituído, nunca recuperado.\n\n'
    + 'Uma vez conectado, o assistente descobre as telas que este escritório tem e pode pesquisar '
    + 'registros, cadastrá-los, alterá-los, excluí-los, rodar um relatório e iniciar uma automação — '
    + 'cada uma dessas só quando o acesso a libera.',
  'overview.connection': 'Conexão',
  'overview.connection.value': 'MCP sobre HTTP — nada a instalar na máquina',
  'overview.sign-in': 'Entrar com a conta',
  'overview.sign-in.value': 'OAuth 2.1, cada pessoa com a própria conta — nenhum token para copiar',
  'overview.token': 'Ou um token',
  'overview.token.value': 'Um token de acesso emitido no aplicativo, revogável, mostrado uma única vez',
  'overview.limit': 'Limite',
  'overview.limit.value': 'As permissões de quem o detém, cruzadas com as que o acesso declara',

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
