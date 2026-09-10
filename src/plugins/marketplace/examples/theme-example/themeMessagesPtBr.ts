import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { THEME_NAMESPACE } from './themeMessages';

/** **Portuguese (Brazil) for the Appearance example** — the translation travels inside the package. */
const THEME_PT_BR: Record<string, string> = {
  'package.name': 'Aparência, pelo exemplo',
  'package.category': 'Aparência',
  'package.description':
    'Uma paleta que estende uma base, e os tokens de cor de um vocabulário que é deste pacote — as duas metades da aparência, e por que são duas.',
  'package.summary':
    'Como uma extensão responde pela aparência. Traz uma paleta pequena que declara só o que difere da base que estende e — a metade que ninguém demonstra — os tokens de cor do PRÓPRIO vocabulário. Um token tem um dono, e o dono responde por ele em todo tema; uma paleta que carregasse vocabulário alheio estaria opinando sobre palavra que não é dela, e dependeria de ganhar uma corrida de ordem de instalação para isso.',

  'screen.item': 'Item',
  'screen.item.plural': 'Itens',
  'field.title': 'Título',
  'field.stage': 'Fase',
  'field.stage.draft': 'Rascunho',
  'field.stage.review': 'Em revisão',
  'field.stage.settled': 'Encerrado',

  'theme.name': 'Pergaminho',
};

export const themePtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: THEME_NAMESPACE,
    messages: THEME_PT_BR,
  });
