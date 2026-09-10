import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { CONSUMER_NAMESPACE } from './consumerMessages';

/** **Portuguese (Brazil) for the Consumer example** — the translation travels inside the package. */
const CONSUMER_PT_BR: Record<string, string> = {
  'package.name': 'Usando outra extensão, pelo exemplo',
  'package.category': 'Cooperação',
  'package.description':
    'A outra metade da cooperação: preenche um ponto que outra extensão abriu, aponta um passo para um script que não é dela, alarga uma permissão e pede uma capacidade.',
  'package.summary':
    'Como uma extensão usa outra sem que nenhuma das duas importe nada. Preenche o ponto de extensão que o exemplo-biblioteca publica, roda um fluxo cujo passo aponta para o script da biblioteca pelo NOME e não pelo id, soma a própria exigência a uma permissão que a biblioteca declarou, e pede a capacidade que a biblioteca provê. Os quatro são declarados, e nenhum deles faz este pacote executar código do outro.',

  'contribution.slug': 'Slug com hifens',
  'contribution.slug.description': 'Formata um código como um slug em minúsculas separado por hifens.',

  'workflow.tidy': 'Arrumar um código',
  'workflow.tidy.description':
    'Roda o script da biblioteca sobre um código e depois chama o fluxo da biblioteca para anunciar o resultado. Nenhum dos dois passos nomeia um id local.',
  'parameter.code': 'Código',

  'resource.consumer': 'Arrumação de códigos',
  'permission.tidy': 'Arrumar códigos',
  'permission.tidy.description': 'Rodar o fluxo de arrumação. Quem usa a biblioteca precisa desta também, porque este pacote contribui dentro dela.',
};

export const consumerPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: CONSUMER_NAMESPACE,
    messages: CONSUMER_PT_BR,
  });
