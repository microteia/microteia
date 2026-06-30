import type { PushMovement } from '../../domain/entities/Push';

export interface ParsedEmailData {
  processNumber?: string;
  court?: string;
  activeParty?: string;
  passiveParty?: string;
  legalClass?: string;
  filingDate?: Date;
  distributionType?: string;
  processSubject?: string;
  movements?: PushMovement[];
  parsedByAI: boolean;
  parsingError?: string;
}

export interface IEmailParserService {
  parse(emailText: string, emailHtml?: string): Promise<ParsedEmailData>;
}

export class EmailParserService implements IEmailParserService {
  async parse(emailText: string, emailHtml?: string): Promise<ParsedEmailData> {
    // Tentar parsing com regex primeiro (padrões conhecidos)
    const regexResult = this.parseWithRegex(emailText);
    
    // Se conseguiu extrair dados suficientes com regex, retorna
    if (this.isCompleteEnough(regexResult)) {
      return {
        ...regexResult,
        parsedByAI: false,
      };
    }

    // TODO: Se regex falhou ou ficou incompleto, usar IA (GPT/Claude)
    // Por enquanto, retorna o que conseguiu com regex
    return {
      ...regexResult,
      parsedByAI: false,
      parsingError: regexResult.processNumber ? undefined : 'Número do processo não encontrado',
    };
  }

  private parseWithRegex(text: string): Omit<ParsedEmailData, 'parsedByAI'> {
    const result: Omit<ParsedEmailData, 'parsedByAI'> = {};

    // Número do processo (formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO)
    const processNumberMatch = text.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    if (processNumberMatch) {
      result.processNumber = processNumberMatch[1];
    }

    // Polo Ativo
    const activePoleMatch = text.match(/Polo Ativo:\s*([^\n]+)/i);
    if (activePoleMatch) {
      result.activeParty = activePoleMatch[1].trim();
    }

    // Polo Passivo
    const passivePoleMatch = text.match(/Polo Passivo:\s*([^\n]+)/i);
    if (passivePoleMatch) {
      result.passiveParty = passivePoleMatch[1].trim();
    }

    // Classe Judicial
    const legalClassMatch = text.match(/Classe Judicial:\s*([^\n]+)/i);
    if (legalClassMatch) {
      result.legalClass = legalClassMatch[1].trim();
    }

    // Órgão
    const courtMatch = text.match(/Órgão:\s*([^\n]+)/i);
    if (courtMatch) {
      result.court = courtMatch[1].trim();
    }

    // Data de Autuação
    const filingDateMatch = text.match(/Data de Autuação:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (filingDateMatch) {
      const [day, month, year] = filingDateMatch[1].split('/');
      result.filingDate = new Date(Number(year), Number(month) - 1, Number(day));
    }

    // Tipo de Distribuição
    const distTypeMatch = text.match(/Tipo de Distribuição:\s*([^\n]+)/i);
    if (distTypeMatch) {
      result.distributionType = distTypeMatch[1].trim();
    }

    // Assunto
    const subjectMatch = text.match(/Assunto:\s*([^\n]+)/i);
    if (subjectMatch) {
      result.processSubject = subjectMatch[1].trim();
    }

    // Movimentações
    result.movements = this.parseMovements(text);

    return result;
  }

  private parseMovements(text: string): PushMovement[] {
    const movements: PushMovement[] = [];

    // Padrão: DataMovimentoDocumento DD/MM/YYYY HH:MM Tipo [Link]
    const movementPattern = /DataMovimentoDocumento(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})([^\[]*)\[([^\]]+)\]\(([^)]+)\)/g;
    
    let match;
    while ((match = movementPattern.exec(text)) !== null) {
      const [, dateStr, timeStr, description, docType, url] = match;
      const [day, month, year] = dateStr.split('/');
      const [hour, minute] = timeStr.split(':');
      
      movements.push({
        date: new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)),
        type: docType.trim(),
        description: description.trim(),
        documentUrl: url,
      });
    }

    return movements;
  }

  private isCompleteEnough(data: Omit<ParsedEmailData, 'parsedByAI'>): boolean {
    // Considera completo se pelo menos tem número do processo
    return !!data.processNumber;
  }
}
