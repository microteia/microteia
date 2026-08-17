/**
 * Saída do Console. Ela é lida por QUEM INSTALA — que pode não ser quem empacotou, e pode não estar
 * no Brasil —, então é em inglês, pela mesma razão que o diagnóstico de boot em
 * `infrastructure/firebase/config.ts` é. Comentário continua em português.
 */

const RULE = '─'.repeat(64);

export const heading = (text: string): void => {
  process.stdout.write(`\n${text}\n${RULE}\n`);
};

export const info = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

export const step = (index: number, total: number, text: string): void => {
  process.stdout.write(`\n[${index}/${total}] ${text}\n`);
};

export const success = (text: string): void => {
  process.stdout.write(`  ok    ${text}\n`);
};

export const warn = (text: string): void => {
  process.stderr.write(`  warn  ${text}\n`);
};

export const failure = (text: string): void => {
  process.stderr.write(`  fail  ${text}\n`);
};

export const bullets = (items: string[]): void => {
  for (const item of items) process.stdout.write(`  - ${item}\n`);
};

export const blank = (): void => {
  process.stdout.write('\n');
};
