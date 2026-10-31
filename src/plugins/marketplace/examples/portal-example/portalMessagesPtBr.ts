import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { PORTAL_EXAMPLE_NAMESPACE } from './portalMessages';

/** **Portuguese (Brazil) for the Portal example** — the translation travels inside the package. */
const PORTAL_EXAMPLE_PT_BR: Record<string, string> = {
  'package.name': 'Portal, pelo exemplo',
  'package.category': 'Interface',
  'package.description':
    'Os clientes veem os próprios pedidos no portal, e fazem pedidos novos — numa página da extensão, e não na padrão.',
  'package.summary':
    'Como uma extensão abre parte do escritório a pessoas de FORA dele. Cada Cliente recebe convidados; os Pedidos apontam para o cliente, então cada convidado vê só os pedidos do próprio cliente, e faz pedidos novos ali. O registro do Cliente no portal é uma view deste pacote, escrita com @microteia/portal — a única API que uma view de portal alcança.',

  'screen.client': 'Cliente',
  'screen.client.plural': 'Clientes',
  'screen.order': 'Pedido',
  'screen.order.plural': 'Pedidos',
  'screen.site': 'Local',
  'screen.site.plural': 'Locais',
  'screen.visit': 'Visita',
  'screen.visit.plural': 'Visitas',
  'screen.contact': 'Contato',
  'screen.contact.plural': 'Contatos',

  'field.name': 'Nome',
  'field.city': 'Cidade',
  'field.client': 'Cliente',
  'field.item': 'Item',
  'field.quantity': 'Quantidade',
  'field.notes': 'Observações',
  'field.internal': 'Nota interna',
  'field.confirmed': 'Confirmado',
  'field.email': 'E-mail',
  'field.portalAccess': 'Acesso ao portal',
  'field.site': 'Local',
  'field.date': 'Data',
  'field.summary': 'Resumo',
  'field.officeOnly': 'Só do escritório — nunca aparece no portal',
  'field.urgency': 'Urgência',

  'lookup.urgencies': 'Urgências do pedido',
  'urgency.routine': 'Rotina',
  'urgency.soon': 'Em breve',
  'urgency.urgent': 'Urgente',

  'portal.orders': 'Seus pedidos',
  'portal.orders.empty': 'Nenhum pedido ainda.',
  'portal.orders.new': 'Fazer um pedido',
  'portal.orders.edit': 'Editar',
  'portal.orders.quantity': '{count} × {item}',
  'portal.widget.orders': 'Seus pedidos',
  'portal.widget.orders.caption': 'pedidos feitos pelo portal',
  'portal.widget.attention': 'Precisa de atenção',
  'portal.widget.attention.caption': 'pedidos urgentes',
  'portal.widget.attention.empty': 'Nada urgente agora.',
  'portal.widget.attention.clients': 'Pedidos por cliente',

  'workflow.visit-scheduled': 'Avisar o cliente de uma visita nova',
  'workflow.visit-scheduled.description': 'Quando uma visita é agendada, avisa os convidados do portal do cliente por e-mail e no sino do portal.',
  'workflow.order-confirmed': 'Liberar os documentos de um pedido confirmado',
  'workflow.order-confirmed.description': 'Quando um pedido é confirmado, compartilha todos os documentos dele com os convidados do portal do cliente.',
  'workflow.contact-access': 'Convidar o contato para o portal',
  'workflow.contact-access.description': 'Quando um contato ganha acesso ao portal, convida-o para o cliente dele no portal.',
  'workflow.contact-access-removed': 'Retirar o acesso do contato ao portal',
  'workflow.contact-access-removed.description': 'Quando um contato perde o acesso ao portal, retira o acesso dele ao cliente no portal.',
  'workflow.contact-deleted': 'Retirar o acesso do contato excluído',
  'workflow.contact-deleted.description': 'Quando um contato é excluído, retira o acesso dele ao cliente no portal.',
  'notify.visit.title': 'Uma visita foi agendada',
  'notify.visit.message': 'Abra no portal para ver a data e o resumo.',
};

export const portalExamplePtBrContribution = (): Contribution =>
  messageBundleContribution({ locale: 'pt-BR', namespace: PORTAL_EXAMPLE_NAMESPACE, messages: PORTAL_EXAMPLE_PT_BR });
