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
  agent: 'The smallest first-party extension there is, and the one that shows what `manifest.backend` is FOR: it contributes one settings toggle and claims three Cloud Functions of the platform. Claiming them is what takes them out of the package baseline, so they are deployed only in the projects of offices that installed it — read it when your extension needs a backend artifact that no declaration can replace, and for how a `prerequisites` entry says what only a person can do in the Google console.',
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
  'report-example': 'The four shapes a report can take, over one anonymous screen: a grouped list with '
    + 'subtotals, a summary bucketed by month with a chart, a pivot, and one that filters by an expression over '
    + 'each row and asks the reader a question first. Read it for the three layers of a `ReportSpec` and for why '
    + '`requires` is derived rather than written.',
  'widget-example': 'Every surface an extension can fill without shipping code: two cards on the dashboard, two marks in the shell and a tab in the organization settings, each one a Widget DSL tree. Read it for what a surface NAME buys you, and for why a package with no code needs no trust gesture.',
  'access-example': 'Authorisation by PERMISSION, never by role. Read it for the three things that are declared and the one that is free: a screen collection yields its four CRUD permissions on its own, while a resource names what is NOT a collection and each declared permission carries the closure it drags along.',
  'backend-example': 'The only example with Cloud Functions of its own: a callable, a Firestore trigger and a nightly run, each born with the guard its shape requires. Read it for why a function of the PROJECT needs to be told which organizations installed you, and for everything `manifest.backend` asks of a Firebase project.',
  'library-example': 'The PUBLISHING half of cooperation, and the only example with no interface at all: it declares an extension point of its own, names a script and a flow in `exports`, and offers a capability. Read it with `consumer-example` — neither half teaches the subject alone.',
  'consumer-example': 'The CONSUMING half: it fills the point the library opened, points a step at the library script by qualified name instead of by id, widens a permission it does not own, and asks for a capability. Read it for why a cross-extension reference travels as a NAME and resolves at execution time.',
  'patch-example': 'The two things done to data that is not new: a `screenPatch` that adds a field to a screen ANOTHER extension owns, targeted by `sourceId` rather than by collection name, and a migration that runs once per office to fill what older records never had. Read it for why a migration addresses its collection through `input.collections` and never by name.',
  'theme-example': 'The two appearance points, and why they are two: a palette that declares only what differs from the base it extends, and the colour tokens of the vocabulary THIS package owns. Read it for the ownership rule — a token has one owner, and a palette carrying somebody else vocabulary has to win an install-order race.',
  'auth-example': 'The only example of `auth.provider`, the point that accepts NO implementation — which is what makes single sign-on something an office declares instead of something we build. Read it for why `password` is in the same list, and for why installing is not enough on the sign-in screen.',
  'command-example': 'The two ways to add a gesture, and why there are two: a user-menu line that is DECLARED, and a command palette entry and an @ mention that cannot be, because both have to search as the person types. Read it for what `startup` is for, and for why `ui.command` in a manifest is a closed road for a third party.',
  'settings-example': 'One settings section with each kind of property the editor draws, in both scopes, plus the licence terms a package asks the office to accept. Read it for the two-scope resolution and for why a value under an unknown key is preserved rather than dropped.',
  'record-tab-example': 'A tab of its own inside the record of a screen: a timeline drawn by a code view that receives the open record (`RecordTabProps`), and a declarative tab beside it, both on `recordSurface(<screen sourceId>)`. Read it for why the tab is addressed by `sourceId`, for `useEntityList(..., { parent })` locking the list to the open record, and for why the screen it lists is deliberately NOT a child screen.',
  news: 'The one with `startup` code — a function that runs when the extension loads and registers services, '
    + 'returning its own teardown. It also pairs a parent screen with a child one, and carries an option list, '
    + 'a tag list and two code views.',
};

/** A nota do exemplo, ou `null`. `null` é dito como "sem nota", nunca preenchido com prosa genérica. */
export const exampleNote = (folder: string): string | null => EXAMPLE_NOTES[folder] ?? null;
