import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { COMMAND_NAMESPACE } from './commandMessages';

/** **Portuguese (Brazil) for the Gestures example** — the translation travels inside the package. */
const COMMAND_PT_BR: Record<string, string> = {
  'package.name': 'Gestos, pelo exemplo',
  'package.category': 'Interface',
  'package.description':
    'Uma linha no menu do usuário, declarada — e uma entrada na paleta de comandos e uma menção @, registradas na carga porque nenhuma das duas cabe como dado.',
  'package.summary':
    'Os dois jeitos de uma extensão acrescentar um gesto, e por que são dois. Um item de menu é uma linha fixa e cabe numa declaração. Uma entrada da paleta de comandos e uma menção @ precisam BUSCAR conforme a pessoa digita, então nenhuma declaração as expressa: elas são registradas pelo `startup`, a função que roda quando a extensão carrega e devolve a própria desmontagem.',

  'screen.note': 'Nota',
  'screen.note.plural': 'Notas',
  'field.title': 'Título',
  'field.title.placeholder': 'Sobre o que é esta nota',
  'field.note': 'Anotação',

  'menu.guide': 'Sobre os gestos',
  'page.guide': 'Sobre os gestos',

  'command.group': 'Exemplo de gestos',
  'command.guide': 'Abrir o guia de gestos',

  'mention.label': 'Nota',
  'mention.description': 'Ligar uma nota ao texto.',

  'guide.heading': 'Gestos, pelo exemplo',
  'guide.body':
    'Digite **⌘K** e procure por "gestos" — esta página é um dos resultados, e cada nota que você criar é outro. Digite **@note** em qualquer campo de texto rico e os mesmos registros são oferecidos ali.\n\nNenhum dos dois está declarado em lugar nenhum. Nem poderiam: os dois precisam responder a uma consulta que só existe quando alguém digita, e um manifesto é dado. Eles são registrados pelo `startup`, que roda quando esta extensão carrega.\n\nA linha no menu do usuário, ao contrário, é uma linha fixa — então ELA é declarada, e não há código envolvido.',
  'guide.declared': 'Declarado',
  'guide.declared.value': 'A linha do menu do usuário',
  'guide.registered': 'Registrado na carga',
  'guide.registered.value': 'A entrada da paleta e a menção @',
};

export const commandPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: COMMAND_NAMESPACE,
    messages: COMMAND_PT_BR,
  });
