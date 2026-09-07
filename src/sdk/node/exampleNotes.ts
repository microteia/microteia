/**
 * O QUE CADA EXEMPLO ENSINA — a única frase por exemplo que o pacote não responde sozinho.
 *
 * Tudo o mais que se pode querer saber de uma extensão de primeira parte é DADO: o manifest diz o id,
 * a versão, a categoria, os pontos tocados e a superfície exportada; o pacote diz as telas, as listas,
 * os scripts, as views e as migrações; e `description`, `summary` e `overview` já são a nossa prosa
 * curada sobre o que ela faz — traduzidas, e renderizadas na tela de Extensões do escritório.
 *
 * O que nada disso responde é a pergunta da AUTORIA: qual MECANISMO este exemplo é o melhor para ler.
 * "Notícias para o escritório" é o que a extensão faz; "a que tem `startup`, e é onde se aprende a
 * registrar serviço na carga" é por que abrir aquele arquivo. São leitores diferentes, e a segunda
 * frase não cabe na `overview` sem estragá-la.
 *
 * MORA NO SDK, e isso não é preferência: é a regra de que texto que descreve o que o KERNEL sabe fazer
 * viaja no mesmo pacote que a capacidade. Enquanto os guias de `extensions/` saíam do Console, um
 * Console de duas versões atrás escrevia documentação de outro contrato, em silêncio. A chave é o nome
 * da PASTA do exemplo, que é o nome do `.json` sem extensão — e `exampleNotes.test.ts` cobra o par nas
 * duas direções contra `extension-templates/`, para que um sétimo exemplo não chegue ao escritório com
 * a lista incompleta e sem reprovar em nada.
 */
export const EXAMPLE_NOTES: Record<string, string> = {
  'automation-example': 'The complete automation path, and the ONLY example that has one: three workflows, '
    + 'two record actions, and the two screens they act on. Read it before writing a workflow, an action or a '
    + 'condition for the first time.',
  brasil: 'A contribution-only extension: it installs no screen at all. It declares field presets '
    + '(`data.field.preset`) and an external lookup (`data.external.lookup`) — the shape to copy when what you '
    + 'add to the platform is a capability rather than a screen.',
  calendar: 'The only example that DECLARES an extension point of its own (`calendar.moveaction`), so that a '
    + 'third extension can plug into it. It also carries a code view, a nav item, a settings page and two '
    + 'option lists — read it for both halves of the plug: declaring a point and contributing to one.',
  dashboard: 'A code view with a settings page and no collection of its own — the shape of a screen that reads '
    + 'what other extensions already store, instead of storing anything.',
  'locale-pt-br': 'An extension that ONLY translates: a single `i18n.messages` contribution and nothing else. '
    + 'The shape to copy for a language pack, and the proof that translating is a contribution like any other.',
  news: 'The one with `startup` code — a function that runs when the extension loads and registers services, '
    + 'returning its own teardown. It also pairs a parent screen with a child one, and carries an option list, '
    + 'a tag list and two code views.',
};

/** A nota do exemplo, ou `null`. `null` é dito como "sem nota", nunca preenchido com prosa genérica. */
export const exampleNote = (folder: string): string | null => EXAMPLE_NOTES[folder] ?? null;
