import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

/**
 * O tamanho e a impressão digital de um arquivo, que juntos são a única garantia que um artefato
 * BAIXADO oferece de ser o que foi empacotado.
 *
 * Enquanto o tarball chegava à mão — anexo de e-mail, pendrive, Drive —, o transporte era confiável por
 * construção e o pacote não carregava hash nenhum. Baixado de uma URL, não é: um download interrompido
 * produz um `.tgz` menor que o `tar` recusa com uma mensagem sobre formato, e a pessoa vai procurar o
 * defeito no pacote em vez de na rede.
 *
 * O `bytes` vem junto de propósito. Ele não acrescenta segurança nenhuma ao `sha256`, mas é o que
 * permite dizer "veio pela metade" em vez de "não confere" — e essas duas frases mandam procurar em
 * lugares diferentes.
 */
export interface FileDigest {
  bytes: number;
  sha256: string;
}

/**
 * Lê por stream, e não com `readFile`: o tarball do kernel passa de 7 MB e cresce a cada versão, e
 * carregar o arquivo inteiro na memória para depois descartá-lo não tem motivo.
 */
export const digestOfFile = async (path: string): Promise<FileDigest> => {
  const hash = createHash('sha256');
  const stream = createReadStream(path);

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', (error) => reject(error));
    stream.on('end', () => resolve());
  });

  const { size } = await stat(path);
  return { bytes: size, sha256: hash.digest('hex') };
};

/**
 * O que está errado num arquivo que devia casar com um digest, em prosa que diz onde procurar.
 *
 * Devolve `null` quando confere. A ordem importa: o tamanho é conferido primeiro porque é o caso
 * comum e o que tem conserto óbvio (baixar de novo), e um `sha256` divergente com o tamanho certo é a
 * situação grave — ali o arquivo não é o que o índice diz que é.
 */
export const digestMismatch = (expected: FileDigest, actual: FileDigest): string | null => {
  if (actual.bytes !== expected.bytes) {
    return `it has ${actual.bytes} bytes and should have ${expected.bytes} — the download did not finish.`;
  }
  if (actual.sha256 !== expected.sha256) {
    return `its sha256 is ${actual.sha256} and should be ${expected.sha256}.`;
  }
  return null;
};
