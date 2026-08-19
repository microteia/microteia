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

/**
 * Uma linha de "começando", para o passo que demora. Existe porque só imprimir o resultado deixa a
 * saída MUDA justamente durante a espera: o primeiro deploy de function leva minutos (o Firebase
 * provisiona build e Artifact Registry na primeira vez), e quem instala não tem como distinguir
 * "trabalhando" de "travado".
 *
 * É uma linha inteira, e não um `\r` reescrito depois: o retorno de carro fica bonito no terminal e
 * vira lixo no arquivo de log — que é justamente o que se cola num pedido de ajuda.
 */
export const pending = (text: string): void => {
  process.stdout.write(`  ...   ${text}\n`);
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
