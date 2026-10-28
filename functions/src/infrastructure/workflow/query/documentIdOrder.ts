/**
 * A ordem em que o Firestore entrega os documentos de uma coleção: o id comparado pelos bytes UTF-8.
 *
 * A leitura em páginas depende dela em dois lugares que não passam pelo banco — a leitura por id e a
 * união das varreduras de quem a visibilidade restringe. A comparação de texto do JavaScript (unidades
 * UTF-16) discorda dela fora do ASCII, e um cursor que discorda do banco pula ou repete registros.
 */
export const compareDocumentIds = (left: string, right: string): number =>
  Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
