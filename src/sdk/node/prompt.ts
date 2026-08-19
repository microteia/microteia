import { createInterface } from 'node:readline/promises';

/**
 * As perguntas do `create`.
 *
 * Sem dependência de framework de prompt, pelo mesmo motivo do resto: uma ferramenta que se instala na
 * máquina de um escritório é mais confiável quanto menos ela arrasta. `readline/promises` é do Node.
 *
 * Toda pergunta aceita ser respondida por FLAG, e é isso que mantém o comando usável fora de um
 * terminal — em CI, num script, ou por uma IA. Sem terminal e sem flag, o padrão vale; não há como
 * travar esperando alguém digitar.
 */

const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

/**
 * Cada pergunta tem uma CHAVE curta e um texto. A chave é o nome da flag (`--name`, `--entity`); o texto
 * é o que a pessoa lê. Separados de propósito: a primeira versão usava o texto como nome da flag, e
 * `--"an entity (a collection, its fields…)"` não é algo que alguém digite ou roteirize.
 */
export interface Question {
  key: string;
  text: string;
  hint?: string;
}

export interface Asker {
  text: (question: Question, fallback?: string) => Promise<string>;
  confirm: (question: Question, fallback: boolean) => Promise<boolean>;
  choose: (question: Question, choices: { value: string; label: string }[], fallback: string) => Promise<string>;
  note: (line: string) => void;
  close: () => Promise<void>;
}

const truthy = (value: string): boolean => /^(y|yes|s|sim|true|1)$/i.test(value.trim());

/** Responde a partir das flags e dos padrões, sem perguntar nada. */
export const silentAsker = (answers: Map<string, string>): Asker => ({
  text: async (question, fallback) => answers.get(question.key) ?? fallback ?? '',
  confirm: async (question, fallback) => {
    const given = answers.get(question.key);
    return given === undefined ? fallback : truthy(given);
  },
  choose: async (question, _choices, fallback) => answers.get(question.key) ?? fallback,
  note: () => {},
  close: async () => {},
});

export const interactiveAsker = (answers: Map<string, string>): Asker => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const ask = async (label: string, suffix: string): Promise<string> =>
    (await rl.question(`${BOLD}${label}${RESET}${suffix} `)).trim();

  return {
    text: async (question, fallback) => {
      const given = answers.get(question.key);
      if (given !== undefined) return given;
      if (question.hint !== undefined) process.stdout.write(`${DIM}  ${question.hint}${RESET}\n`);
      const suffix = fallback === undefined ? '' : ` ${DIM}[${fallback}]${RESET}`;
      const typed = await ask(question.text, suffix);
      return typed === '' ? fallback ?? '' : typed;
    },
    confirm: async (question, fallback) => {
      const given = answers.get(question.key);
      if (given !== undefined) return truthy(given);
      if (question.hint !== undefined) process.stdout.write(`${DIM}  ${question.hint}${RESET}\n`);
      const typed = await ask(question.text, ` ${DIM}[${fallback ? 'Y/n' : 'y/N'}]${RESET}`);
      if (typed === '') return fallback;
      return truthy(typed);
    },
    choose: async (question, choices, fallback) => {
      const given = answers.get(question.key);
      if (given !== undefined) return given;

      process.stdout.write(`${BOLD}${question.text}${RESET}\n`);
      choices.forEach((choice, index) => {
        const mark = choice.value === fallback ? '*' : ' ';
        process.stdout.write(`  ${mark} ${index + 1}) ${choice.label}\n`);
      });

      const typed = await ask('  pick a number', ` ${DIM}[${choices.findIndex((c) => c.value === fallback) + 1}]${RESET}`);
      if (typed === '') return fallback;
      const picked = choices[Number.parseInt(typed, 10) - 1];
      return picked?.value ?? fallback;
    },
    note: (line) => { process.stdout.write(`${DIM}${line}${RESET}\n`); },
    close: async () => { rl.close(); },
  };
};

/**
 * O interrogador certo para a situação. `--yes` força o silencioso mesmo num terminal, que é como se
 * roteiriza a criação sem perder a possibilidade de perguntar.
 */
export const askerFor = (answers: Map<string, string>, forceSilent: boolean): Asker =>
  forceSilent || !process.stdin.isTTY ? silentAsker(answers) : interactiveAsker(answers);
