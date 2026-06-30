import type { ParsedEmailData } from '../../domain/services/IEmailParser';
import type { IEmailParser } from '../../domain/services/IEmailParser';
import { TJBAEmailParser } from './parsers/TJBAEmailParser';
import { TJMAEmailParser } from './parsers/TJMAEmailParser';

export interface IEmailParserService {
  parse(emailText: string, emailFrom: string, emailHtml?: string): Promise<ParsedEmailData>;
}

/**
 * Serviço de parsing de emails com padrão Strategy.
 * Mantém múltiplos parsers (um por tribunal) e escolhe o mais adequado.
 */
export class EmailParserService implements IEmailParserService {
  private parsers: IEmailParser[];
  private parserByEmail: Map<string, IEmailParser>;

  constructor() {
    // Registrar todos os parsers disponíveis
    this.parsers = [
      new TJBAEmailParser(),
      new TJMAEmailParser(),
      // TODO: Adicionar mais parsers conforme necessário
      // new TRTEmailParser(),
      // new TRFEmailParser(),
    ];

    // Mapa de email → parser para lookup rápido
    this.parserByEmail = new Map([
      ['pje@tjba.jus.br', this.parsers.find(p => p.name === 'TJBA')!],
      ['contatopje@tjma.jus.br', this.parsers.find(p => p.name === 'TJMA')!],
      // TODO: Adicionar mais mapeamentos
    ]);
  }

  async parse(emailText: string, emailFrom: string, emailHtml?: string): Promise<ParsedEmailData> {
    // Normalizar email (extrair domínio)
    const normalizedFrom = this.normalizeEmail(emailFrom);
    
    // Estratégia 1: Tentar parser específico baseado no remetente
    const specificParser = this.parserByEmail.get(normalizedFrom);
    if (specificParser) {
      console.log(`Usando parser específico: ${specificParser.name}`);
      const result = specificParser.tryParse(emailText, emailHtml);
      if (result) {
        return {
          ...result,
          parsedByAI: false,
        };
      }
    }

    // Estratégia 2: Fallback - tentar todos os parsers disponíveis
    console.log('Parser específico não encontrado ou falhou, tentando fallback...');
    for (const parser of this.parsers) {
      const result = parser.tryParse(emailText, emailHtml);
      if (result && result.processNumber) {
        console.log(`Parsing bem-sucedido com parser: ${parser.name}`);
        return {
          ...result,
          parsedByAI: false,
        };
      }
    }

    // Estratégia 3: Se nenhum parser funcionou, tentar IA (TODO)
    console.warn('Nenhum parser conseguiu extrair dados, tentando IA...');
    // TODO: Implementar parsing com IA (GPT/Claude)
    
    // Por enquanto, retorna vazio com erro
    return {
      parsedByAI: false,
      parsingError: 'Nenhum parser compatível encontrado para este email',
    };
  }

  /**
   * Extrai o email completo do campo "from" (remove nome se houver)
   * Exemplo: "PJe TJBA <pje@tjba.jus.br>" → "pje@tjba.jus.br"
   */
  private normalizeEmail(from: string): string {
    const emailMatch = from.match(/<(.+?)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
    return emailMatch ? emailMatch[1].toLowerCase() : from.toLowerCase();
  }
}

export { ParsedEmailData };
