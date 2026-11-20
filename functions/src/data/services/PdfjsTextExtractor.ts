import { createRequire } from 'node:module';
import type { IPdfTextExtractor, OpenedPdf } from '../../domain/repositories/IPdfTextExtractor';
import { PdfPasswordError, PdfUnreadableError } from '../../domain/repositories/IPdfTextExtractor';
import type { PdfTextItem } from '../../domain/schema/pdfText';

/** Só o que é usado da biblioteca — os tipos dela são ESM e não resolvem no `tsconfig` CommonJS das functions. */
interface PdfjsModule {
  getDocument(source: {
    data: Uint8Array;
    isEvalSupported: boolean;
    disableFontFace: boolean;
    useSystemFonts: boolean;
    verbosity: number;
  }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
    }>;
    destroy(): Promise<void>;
  };
}

const PDFJS = 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * A `pdfjs-dist` só existe como ESM, e as functions compilam para CommonJS: um `import()` escrito no código
 * viraria `require()` pelo TypeScript. O caminho principal é o `require` de ESM do próprio Node (sem flag desde
 * o 22.12); o `import()` de verdade, guardado numa função para o TypeScript não o reescrever, fica de reserva
 * para um Node anterior. Os dois, e não um só: o segundo não funciona sob o vitest, e o primeiro não existe
 * num Node 22 antigo.
 */
const importEsm = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<unknown>;

let loaded: Promise<PdfjsModule> | null = null;
const pdfjs = (): Promise<PdfjsModule> => {
  loaded ??= (async () => {
    try {
      return createRequire(__filename)(PDFJS) as PdfjsModule;
    } catch {
      return (await importEsm(PDFJS)) as PdfjsModule;
    }
  })();
  return loaded;
};

/**
 * Um PDF aberto por vez na instância. A instância atende várias execuções ao mesmo tempo, e cada PDF
 * aberto pesa o arquivo e o que a biblioteca monta dele: sem a fila, a memória crescia com quantos
 * anexos chegassem juntos — um e-mail com dez PDFs viraria dez leituras simultâneas —, e a instância
 * que estoura não falha a execução: some com ela (issue #6). A leitura é CPU pura, numa vCPU só, e por
 * isso a fila não atrasa o total, só a ordem.
 */
let pdfSlot: Promise<void> = Promise.resolve();

/**
 * A espera pela vez tem fim: um PDF cuja leitura nunca termina prenderia a fila pelo resto da vida da
 * instância — a plataforma encerra a requisição no `timeoutSeconds`, mas a promessa pendente fica. Passado
 * o limite, quem espera segue sem a vez; é o mesmo risco de memória de antes da fila, só que raro.
 */
const PDF_SLOT_MAX_WAIT_MS = 60_000;

const takePdfSlot = async (): Promise<() => void> => {
  let release!: () => void;
  const previous = pdfSlot;
  pdfSlot = new Promise<void>((resolve) => { release = resolve; });
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    previous,
    new Promise<void>((resolve) => { timer = setTimeout(resolve, PDF_SLOT_MAX_WAIT_MS); }),
  ]);
  clearTimeout(timer);
  return release;
};

const asTextItem = (item: unknown): PdfTextItem => {
  if (typeof item !== 'object' || item === null || !('str' in item)) return {};
  const { str, hasEOL } = item as { str: unknown; hasEOL?: unknown };
  return { str: typeof str === 'string' ? str : '', hasEOL: hasEOL === true };
};

/**
 * A mesma biblioteca, e a mesma versão, que o Processador usa no navegador: a junção do texto é
 * compartilhada (`pdfPageText`), mas os trechos que ela recebe são da biblioteca — e um leitor
 * determinístico depende dos dois.
 */
export class PdfjsTextExtractor implements IPdfTextExtractor {
  async open(data: Uint8Array): Promise<OpenedPdf> {
    const release = await takePdfSlot();
    let task: ReturnType<PdfjsModule['getDocument']>;
    let document;
    try {
      const library = await pdfjs();
      // `eval` desligado: o PDF é do escritório, mas chega por e-mail e pelo portal — é conteúdo de fora.
      task = library.getDocument({ data, isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
    } catch (error) {
      release();
      throw error;
    }
    try {
      document = await task.promise;
    } catch (error) {
      await task.destroy().catch(() => undefined);
      release();
      if (error instanceof Error && error.name === 'PasswordException') throw new PdfPasswordError();
      throw new PdfUnreadableError(error instanceof Error ? error.message : String(error));
    }
    const opened = document;
    let closed = false;
    return {
      pageCount: opened.numPages,
      pageItems: async (pageNumber) => {
        const page = await opened.getPage(pageNumber);
        const content = await page.getTextContent();
        return content.items.map(asTextItem);
      },
      close: async () => {
        if (closed) return;
        closed = true;
        try {
          await task.destroy();
        } finally {
          release();
        }
      },
    };
  }
}
