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

  'field.name': 'Nome',
  'field.city': 'Cidade',
  'field.client': 'Cliente',
  'field.item': 'Item',
  'field.quantity': 'Quantidade',
  'field.notes': 'Observações',
  'field.internal': 'Nota interna',

  'portal.orders': 'Seus pedidos',
  'portal.orders.empty': 'Nenhum pedido ainda.',
  'portal.orders.new': 'Fazer um pedido',
  'portal.orders.edit': 'Editar',
  'portal.orders.quantity': '{count} × {item}',
  'portal.widget.orders': 'Seus pedidos',
  'portal.widget.orders.caption': 'pedidos feitos pelo portal',
};

export const portalExamplePtBrContribution = (): Contribution =>
  messageBundleContribution({ locale: 'pt-BR', namespace: PORTAL_EXAMPLE_NAMESPACE, messages: PORTAL_EXAMPLE_PT_BR });
