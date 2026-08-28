/**
 * O que o provisionamento deixou para trás no projeto Firebase.
 *
 * O documento é escrito pelo Microteia Console — nunca pela aplicação — a cada `microteia provision`, e
 * é a única forma que a aplicação tem de saber que existe artefato a retirar. A pergunta não pode ser
 * respondida aqui: ela exige varrer TODOS os escritórios do projeto e comparar com o registro de
 * aplicadas, que vive ao lado do `microteia.yaml`.
 *
 * `tenants` e `extensions` são a contagem que SUSTENTA a afirmação. "Ninguém mais exige esta function" é
 * uma frase sobre todos os escritórios do projeto, não sobre o último que foi lido — e quem lê a tela
 * merece poder conferir a afirmação em vez de acreditar nela.
 */
export interface OrphanFunction {
  name: string;
  /** O plugin que a reivindicava quando ela subiu, ou `null` num registro anterior ao dono. */
  owner: string | null;
}

export interface BackendResidue {
  /** Quando a varredura aconteceu, ou `null` quando o Console não gravou a data. */
  scannedAt: Date | null;
  /** A versão do Console que fez a varredura. */
  consoleVersion: string;
  tenants: number;
  extensions: number;
  orphanFunctions: OrphanFunction[];
  /** O índice composto órfão, na mesma forma legível que o Console imprime. */
  orphanIndexes: string[];
}
