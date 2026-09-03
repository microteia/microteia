import { messageBundleContribution } from '../../domain/schema/i18n';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import { AUTOMATION_NAMESPACE } from './automationMessages';

/**
 * **Portuguese (Brazil) for the Automation example** — the translation that travels INSIDE the
 * extension that owns the text. The kernel does not answer for vocabulary it did not declare.
 */
const AUTOMATION_PT_BR: Record<string, string> = {
  'package.name': 'Automação, pelo exemplo',
  'package.category': 'Automação',
  'package.description':
    'Uma automação inteira: fluxo ao salvar, ramificação, consulta, gravação que não duplica, script e um botão que pede um valor.',
  'package.summary':
    'A mecânica da automação, sem negócio no caminho. Instala uma tela e cada tipo de automação que a plataforma executa, para que todos possam ser lidos como fonte: um fluxo que dispara ao salvar, um nó de controle que ramifica, uma consulta que pergunta se o registro já existe, uma gravação que continua idempotente na segunda execução, um script no sandbox, e um botão que pede um valor a uma pessoa antes de disparar o fluxo.',

  'screen.request': 'Solicitação',
  'screen.request.plural': 'Solicitações',
  'section.request': 'Solicitação',
  'section.handling': 'Tratamento',
  'field.title': 'Título',
  'field.title.placeholder': 'O que está sendo pedido',
  'field.amount': 'Valor',
  'field.status': 'Situação',
  'field.status.open': 'Aberta',
  'field.status.approved': 'Aprovada',
  'field.status.rejected': 'Recusada',
  'field.note': 'Observação',

  'workflow.on-save': 'Ao salvar uma solicitação',
  'workflow.on-save.description':
    'Dispara sempre que uma solicitação é gravada. Ramifica conforme ela ser nova ou não, e registra na auditoria o que aconteceu.',
  'workflow.on-save.created.title': 'Solicitação aberta',
  'workflow.on-save.updated.title': 'Solicitação alterada',

  'workflow.review': 'Analisar uma solicitação',
  'workflow.review.description':
    'Chamado pelo botão Analisar. Recebe a decisão e a observação como parâmetros e as grava no registro.',
  'workflow.review.done.title': 'Solicitação analisada',

  'workflow.mirror': 'Manter o resumo em dia',
  'workflow.mirror.description':
    'Fluxo chamado: pergunta se o resumo deste mês já existe e então o atualiza ou o cria. Rodar duas vezes não duplica nada.',
  'workflow.mirror.audit.title': 'Resumo posto em dia',

  'action.review': 'Analisar',
  'action.review.confirm': 'Registrar esta análise na solicitação?',
  'action.mirror': 'Recontar resumo',

  'parameter.decision': 'Decisão',
  'parameter.decision.approve': 'Aprovar',
  'parameter.decision.reject': 'Recusar',
  'parameter.note': 'Observação',

  'script.total': 'Somar os valores',
  'script.total.output.total': 'Total dos valores informados',
  'script.total.output.counted': 'Quantos foram somados',

  'screen.summary': 'Resumo de solicitações',
  'screen.summary.plural': 'Resumos de solicitações',
  'field.period': 'Período',
  'field.openTotal': 'Total em aberto',
  'field.openCount': 'Solicitações em aberto',
};

export const automationPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: AUTOMATION_NAMESPACE,
    messages: AUTOMATION_PT_BR,
  });
