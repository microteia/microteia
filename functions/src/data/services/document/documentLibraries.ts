/**
 * As três bibliotecas de documento são módulos `export =` (uma classe ou uma instância), e o backend
 * compila para CommonJS sem `esModuleInterop`: nesse arranjo `import = require` é a única forma que o
 * TypeScript tipa como construtor — `import * as` vira namespace sem assinatura de construção, e no
 * `pdfmake` ainda tiraria o `this` dos métodos da instância. Ficam aqui, num lugar só, para que o
 * resto do código importe de forma ES.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- módulo `export =` sem esModuleInterop; ver o comentário do arquivo.
export import Docxtemplater = require('docxtemplater');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- módulo `export =` sem esModuleInterop; ver o comentário do arquivo.
export import PizZip = require('pizzip');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- módulo `export =` sem esModuleInterop; ver o comentário do arquivo.
export import pdfmake = require('pdfmake');
