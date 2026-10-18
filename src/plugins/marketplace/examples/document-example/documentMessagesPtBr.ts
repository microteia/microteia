import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { DOCUMENT_NAMESPACE } from './documentMessages';

/**
 * **Portuguese (Brazil) for the Documents example** — the translation travels INSIDE the extension that
 * owns the text.
 */
const DOCUMENT_PT_BR: Record<string, string> = {
  'package.name': 'Documentos, pelo exemplo',
  'package.category': 'Documentos',
  'package.description':
    'Um modelo de documento sobre duas telas pequenas: um acordo e as parcelas dele, gerado em PDF ou Word e anexado ao acordo.',
  'package.summary':
    'O que um modelo de documento consegue dizer, sem negócio no caminho. Instala uma tela de acordo com a aba Documentos, uma tela de parcelas ligada a ela, e um modelo que lê campos, formata datas e valores, repete as parcelas numa tabela e inclui uma linha só quando uma condição vale. Gere-o a partir do acordo, ou de uma automação com o passo "Gerar Documento". Um segundo modelo lê dados em vez de um registro — o recibo de uma parcela —, e a automação que o acompanha o gera e o anexa ao acordo.',

  'screen.agreement': 'Acordo',
  'screen.agreement.plural': 'Acordos',
  'screen.installment': 'Parcela',
  'screen.installment.plural': 'Parcelas',
  'field.party': 'Parte',
  'field.signedOn': 'Assinado em',
  'field.total': 'Total',
  'field.agreement': 'Acordo',
  'field.amount': 'Valor',
  'field.dueDate': 'Vencimento',
  'field.paid': 'Pago',
  'field.paidOn': 'Pago em',
  'field.note': 'Observação',

  'template.payment-plan': 'Plano de pagamento',
  'template.installment-receipt': 'Recibo de parcela',

  'workflow.receipt': 'Gerar recibo de parcela',
  'workflow.receipt.description':
    'Gera o recibo de um pagamento a partir dos dados que recebe e o anexa à aba Documentos do acordo para o qual os dados apontam.',
};

export const documentPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: DOCUMENT_NAMESPACE,
    messages: DOCUMENT_PT_BR,
  });
