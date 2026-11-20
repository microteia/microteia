import type { PdfTextItem } from '../schema/pdfText';

/** O PDF aberto: quantas páginas ele tem, e os trechos de texto de cada uma, sob pedido. */
export interface OpenedPdf {
  pageCount: number;
  pageItems(pageNumber: number): Promise<PdfTextItem[]>;
  /** Obrigatório, num `finally`: a instância abre um PDF por vez, e o que não fecha prende a fila. */
  close(): Promise<void>;
}

/** O PDF pede senha — o passo não tem como pedi-la a ninguém. */
export class PdfPasswordError extends Error {
  constructor() {
    super('pdf-password');
    this.name = 'PdfPasswordError';
  }
}

/** O arquivo não é um PDF que se consiga abrir. */
export class PdfUnreadableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'PdfUnreadableError';
  }
}

/**
 * A camada de texto de um PDF. Porta, e não chamada direta à biblioteca, porque a biblioteca só existe
 * como ESM e o caso de uso precisa ser testável sem ela.
 */
export interface IPdfTextExtractor {
  open(data: Uint8Array): Promise<OpenedPdf>;
}
