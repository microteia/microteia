import {
  A_STATE_IS_A_KEY,
  BEHAVIOR_MECHANISMS,
  RULE_LEDGER_FILE,
  SCREEN_IS_NOT_AN_ENTITY_MODEL,
  SCREEN_PLAN_HUMAN_DECISIONS,
  SCREEN_PLAN_RULES,
  STORAGE_MECHANISMS,
  coverageGaps,
  coverageSummary,
} from '../domain';
import { DOMAIN_MODEL_FILE } from './workspaceCatalog';

/**
 * A CAPABILITY `prompts` — o gesto do editor.
 *
 * Ela existe por uma razão só, e ela é sobre onde a instrução mora. Todo o resto deste servidor
 * responde a uma pergunta que alguém já soube fazer: `validate_domain_model` responde sobre um modelo
 * que já existe, `generate_artifact_plan` sobre um modelo que já passou. Nada aqui responde à primeira
 * coisa que acontece de verdade — alguém cola três linhas de regra de negócio e não sabe que existe
 * uma ORDEM (entender, modelar, validar, planejar) nem que pular a primeira etapa é o defeito mais
 * caro deste subsistema.
 *
 * Essa instrução vivia num parágrafo do `AGENTS.md`, o que significa: vivia em quem tinha lido o
 * `AGENTS.md`. Um prompt nomeado é a mesma instrução como GESTO — o autor escolhe
 * `model_business_rule` no editor, cola o enunciado, e a ordem chega junto.
 *
 * O texto é DERIVADO, e não é economia: é a mesma regra que já vale para o `AUTHORING.md` e para os
 * guias de `extensions/`. Uma segunda redação das mesmas regras é uma segunda fonte de verdade sobre o
 * que a plataforma sabe fazer, e ela envelhece sozinha — o dia em que um armazenamento novo entra em
 * `STORAGE_MECHANISMS`, a cópia em prosa passa a estar incompleta sem reprovar em nada.
 *
 * Em inglês, como todo o resto que é entregue: é superfície de produto, e o autor pode estar em
 * qualquer lugar.
 */

export interface PromptContext {
  /** As ferramentas que este servidor publica. Citadas pelo nome real, nunca por uma cópia. */
  toolNames: readonly string[];
  /** Os recursos que ele publica, pelas URIs que o cliente anexa. */
  resourceUris: readonly string[];
}

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: PromptArgument[];
  render: (args: Record<string, string>, context: PromptContext) => string;
}

const bullets = (lines: readonly string[]): string => lines.map((one) => `- ${one}`).join('\n');

const storageTable = (): string => [
  '| storage | cardinality | you declare | it is stored as |',
  '|---|---|---|---|',
  ...STORAGE_MECHANISMS.map((one) =>
    `| \`${one.storage}\` | ${one.cardinalities.join(', ')} | ${one.declaration} | ${one.storedAs} |`),
].join('\n');

const behaviorTable = (): string => [
  '| declares | mechanism |',
  '|---|---|',
  ...BEHAVIOR_MECHANISMS.map((one) =>
    `| \`${one.declares}\` (${one.concern}) | ${one.supported ? one.mechanism : `**REFUSED.** ${one.mechanism}`} |`),
].join('\n');

const screenRuleTable = (): string => [
  '| what arrives | what the rule decides, with no exception |',
  '|---|---|',
  ...SCREEN_PLAN_RULES.map((one) => `| ${one.subject} | ${one.decides} |`),
].join('\n');

const refusals = (): string => bullets(BEHAVIOR_MECHANISMS
  .filter((one) => !one.supported)
  .map((one) => `\`${one.declares}\`: ${one.mechanism}. ${one.declaredAs}`));

/**
 * A nota do relatório, LIDA da cobertura em vez de reescrita aqui.
 *
 * Uma segunda redação da mesma razão envelhece sozinha — é a regra que já governa as tabelas acima. E
 * este é o item que mais precisa dela: a pergunta de negócio ("quanto vendemos por mês") chega junto
 * com a estrutura, e quem não for avisado a traduz numa tela.
 */
const reportGap = (): string => {
  const note = coverageGaps()
    .find((one) => one.surface === 'package-artifact' && one.id === 'reports')?.note;
  return note === undefined ? 'it is outside this vocabulary.' : `${note.replace(/\s+/g, ' ')}.`;
};

const has = (context: PromptContext, name: string): boolean =>
  context.toolNames.includes(name) || context.resourceUris.includes(name);

const cite = (context: PromptContext, name: string): string =>
  (has(context, name) ? `\`${name}\`` : `\`${name}\` (NOT PUBLISHED by this server — say so instead of pretending)`);

/**
 * O corpo do gesto. Ele CONDUZ: cada etapa diz o que fazer, com que ferramenta, e o que NÃO fazer —
 * porque a etapa que se pula é sempre a primeira, e o custo dela aparece meses depois, no dado gravado.
 */
const modelBusinessRule = (args: Record<string, string>, context: PromptContext): string => {
  const statement = (args.statement ?? '').trim();
  const target = (args.target ?? '').trim();
  const extensionId = (args.extensionId ?? '').trim();
  const gaps = coverageGaps().length;
  const surfaces = coverageSummary().reduce((total, one) => total + one.total, 0);

  return [
    '# Model a business rule, end to end',
    '',
    'A business rule just arrived. Do NOT write a `plugin.ts` yet, and do not open a file. There is an order, and it',
    'is the whole point of this prompt: **understand, model, validate, plan** — then write.',
    '',
    '## The rule',
    '',
    statement === ''
      ? '_No statement was given. Ask for it in the words it arrived in — the sentence somebody actually said — before'
        + ' doing anything else. Everything below is a reading of that sentence, and a reading with no original is'
        + ' traceable to nothing._'
      : `> ${statement.split('\n').join('\n> ')}`,
    '',
    target === '' ? '' : `Target: \`${target}\`${extensionId === '' ? '' : ` (\`${extensionId}\`)`}.`,
    target === '' ? '' : '',
    '## 1. Understand — write the rule down as an artifact',
    '',
    'Before any entity, turn the sentence into a `BusinessRule`, and keep the original words in `statement`:',
    '',
    '```json',
    '{ "id": "<stable-kebab-id>", "statement": "<the sentence, verbatim>",',
    '  "actors": ["who may do something others may not"],',
    '  "concepts": ["the business nouns the sentence uses"],',
    '  "invariants": ["every cannot / must / only in the sentence, one per line"],',
    '  "processes": ["every passage the sentence describes"],',
    '  "acceptance": ["what somebody would DO to see the rule working"] }',
    '```',
    '',
    'Three of those lists are where the reading gets tested later, so do not pad them:',
    '',
    bullets([
      '**actors** are people with a privilege. "The customer receives an email" is not an actor.',
      '**invariants** are what must stay true. Read the sentence for "cannot", "must", "only", "at least", "never".',
      '**acceptance** is the part people skip, and it is the only part that says whether the work landed. Without it,'
      + ' "done" is an opinion.',
    ]),
    '',
    'If the sentence does not answer one of these, ASK. A question now costs one message; the wrong entity costs',
    'every record written into it.',
    '',
    '## 2. Model — structure and behavior, in the same breath',
    '',
    `**${SCREEN_IS_NOT_AN_ENTITY_MODEL}** The fastest reading of any request turns one sentence into one entity`,
    'holding everybody else\'s data. That reading validates, installs and runs, and nothing else in this platform',
    'refuses it. What it costs is paid later and paid forever: a name stored in every record and drifting the day it',
    'is corrected, no list to search, three slots where there will be a fourth, and no total because there are no',
    'child records to add up.',
    '',
    `Start by reading ${cite(context, 'microteia://entities')} — a field called \`customerName\` is a defect`,
    '*because* Customer is a thing, and that resource is how you learn that it is. Then read',
    `${cite(context, 'microteia://domain-model/schema')} for the shape.`,
    '',
    'The relationship is declared from the side that STORES the link, and there are four storages — no more:',
    '',
    storageTable(),
    '',
    '**And the behavior goes in the same model, not in a later request.** The sentence that described the structure',
    'described what happens to it too ("a sale is born as a draft; only the manager cancels an invoiced one"), and',
    'waiting to be asked for "the automation" is waiting for a request that already came.',
    '',
    `**${A_STATE_IS_A_KEY}** Every \`from\` and \`to\` names a key. \`initial\` says where a record is born; \`terminal\``,
    'says where it ends, because "this is the end" and "I forgot the way out" are written the same way.',
    '',
    behaviorTable(),
    '',
    'Read the refusals as answers, not as gaps to route around:',
    '',
    refusals(),
    '',
    'Two more things this model asks for that are easy to leave empty and expensive to leave empty:',
    '',
    bullets([
      'Every `user-action` transition needs a `description` — one business sentence about what the passage does. It'
      + ' becomes the flow\'s description, and the `ai-detect-workflow` step drops every callable flow whose'
      + ' description is empty. Without it the automation works and is invisible to the only surface that would pick'
      + ' it on its own.',
      'The notes, documents and tags tabs are OFF by default. Turning one on is `entity.tabs: [{ kind, because }]`,'
      + ' and the `because` is required: without it, "on purpose" and "out of habit" read the same in six months.',
    ]),
    '',
    '## 3. Validate — the gate, and it is deterministic',
    '',
    `Call ${cite(context, 'validate_domain_model')} with the model. It is not an opinion: every check is a comparison`,
    'over the model, over the real catalog of this installation, and over the mechanism tables above. A model with an',
    `ERROR does not become a plan. ${cite(context, 'microteia://domain-model/rules')} lists every check.`,
    '',
    'Fix the errors and call it again. Do not work around one — each refusal names a mechanism that does not exist,',
    'and a package that pretends otherwise installs, runs, and does nothing, with no error anywhere.',
    '',
    '## 4. Plan — screens included, and the human decisions named',
    '',
    `Call ${cite(context, 'generate_artifact_plan')} with the same model, and pass the \`rule\` from step 1. What comes`,
    'back is what must exist, with every relationship already resolved — read it from there rather than re-reading',
    'the model, because two readings of the same sentence is how they start to disagree.',
    '',
    'The screen half of the plan is decided by rule, not by taste:',
    '',
    screenRuleTable(),
    '',
    'And what the plan deliberately does NOT decide, it hands back:',
    '',
    bullets(SCREEN_PLAN_HUMAN_DECISIONS),
    '',
    'Plus, per action, where it appears: on the list card, in the detail header, or a choice for you — the plan',
    'decides only the part that is derivable, which is legibility (a gesture disabled by a field the card does not',
    'show is a greyed-out button with no visible reason).',
    '',
    '## 5. Then write, and keep both files',
    '',
    bullets([
      `Write the \`plugin.ts\` from the plan, then call ${cite(context, 'validate_plugin')}. The plan says what must`
      + ' exist; that one says whether what you wrote installs.',
      `Save the model as \`<folder>/${DOMAIN_MODEL_FILE}\`. \`source\` and \`reason\` on a snapshot have nowhere to live`
      + ' in an installed field, so without the file the next session reads the catalog, finds the copy, and raises'
      + ' it again. And again.',
      `Save the rule and what it produced as \`<folder>/${RULE_LEDGER_FILE}\` — the plan returns the entry ready to`
      + ' write, under `trace`. It is what makes the NEXT version of this rule a diff of what this one generated,'
      + ' instead of a second batch of screens that look like the first — and it records the universal identity of'
      + ' each screen, which the next version has to reuse exactly instead of deciding again.',
      'Copy each screen\'s `sourceId` from the plan verbatim, and never recompute one. It is how an update'
      + ' recognises the screen: a value that changed between two versions installs a SECOND screen beside the'
      + ' first, in every office, and leaves the records in a collection with no screen over them.',
    ]),
    '',
    '## What this vocabulary does not reach',
    '',
    `Of ${surfaces} mechanisms this platform has, ${gaps} are outside the model's vocabulary — the \`query\` step, the`,
    'clock, every contribution point but `access.permission`, and which record an effect writes. When the',
    'rule needs one of them, say so plainly and hand the decision back. Do not translate it into something that',
    'looks similar: that is the one failure mode this whole subsystem exists to prevent.',
    '',
    `**The report is one of them**, and it is the one that arrives disguised as a rule: ${reportGap()}`,
    'So when the sentence asks how much, how many, by month, by customer — that is not an entity and not an',
    'automation, and no plan will propose it. Declare it by hand from the reports section of AUTHORING.md, and',
    'read that section BEFORE writing the spec: what a report charges in permissions, and how much it is allowed',
    'to scan, are decided by the platform and are not yours to work around.',
    '',
    'Uniqueness is INSIDE the vocabulary, and it is the one rule you declare instead of computing: `entity.keys`, or',
    '`unique: true` on a field. When the rule says "there cannot be two" — one CPF, one code, one item number per',
    'order — that is a key, and the gate refuses it written as an expression, because an expression sees one record',
    'and never queries. Absence is a decision too: an entity with no key accepts duplicates, so if the rule is silent',
    'about it, say so rather than adding one.',
  ].filter((line, index, all) => !(line === '' && all[index - 1] === '')).join('\n');
};

export const MCP_PROMPTS: PromptDefinition[] = [
  {
    name: 'model_business_rule',
    description:
      'Turn a business rule into working software, in the order that matters: understand the rule as an artifact, '
      + 'model the structure AND what happens to it, validate deterministically, then plan the screens. Start here '
      + 'when somebody hands you a sentence of business ("only the manager cancels an invoiced sale") rather than a '
      + 'model — it is the step that gets skipped, and skipping it is the most expensive defect in this subsystem.',
    arguments: [
      {
        name: 'statement',
        description: 'The business rule, in the words it arrived in. Paste the sentence — do not summarise it first.',
        required: true,
      },
      {
        name: 'target',
        description: "Where the artifacts are born: 'extension' (a package) or 'screenDefinitions' (this organization's own screens).",
        required: false,
      },
      {
        name: 'extensionId',
        description: "The extension the plan installs into, when target is 'extension'.",
        required: false,
      },
    ],
    render: modelBusinessRule,
  },
];

export const mcpPromptNames = (): string[] => MCP_PROMPTS.map((one) => one.name);

export const renderMcpPrompt = (
  name: string,
  args: Record<string, string>,
  context: PromptContext,
): { description: string; text: string } => {
  const prompt = MCP_PROMPTS.find((one) => one.name === name);
  if (prompt === undefined) throw new Error(`Unknown prompt "${name}".`);
  return { description: prompt.description, text: prompt.render(args, context) };
};
