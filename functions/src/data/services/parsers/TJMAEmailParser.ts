import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import type { PushMovement } from '../../../domain/entities/Push';

/**
 * Parser específico para emails do PJe do Tribunal de Justiça do Maranhão
 * Remetente: contatopje@tjma.jus.br
 */
export class TJMAEmailParser implements IEmailParser {
  readonly name = 'TJMA';

  tryParse(emailText: string): Omit<ParsedEmailData, 'parsedByAI'> | null {
    // Verificar se é realmente do TJMA
    if (!this.isTJMAEmail(emailText)) {
      return null;
    }

    const result: Omit<ParsedEmailData, 'parsedByAI'> = {};

    // Número do processo (formato CNJ)
    const processNumberMatch = emailText.match(/Número do Processo:\s*(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i);
    if (processNumberMatch) {
      result.processNumber = processNumberMatch[1];
    }

    // Polo Ativo
    const activePoleMatch = emailText.match(/Polo Ativo:\s*([^\n]+)/i);
    if (activePoleMatch) {
      result.activeParty = activePoleMatch[1].trim();
    }

    // Polo Passivo
    const passivePoleMatch = emailText.match(/Polo Passivo:\s*([^\n]+)/i);
    if (passivePoleMatch) {
      result.passiveParty = passivePoleMatch[1].trim();
    }

    // Classe Judicial
    const legalClassMatch = emailText.match(/Classe Judicial:\s*([^\n]+)/i);
    if (legalClassMatch) {
      result.legalClass = legalClassMatch[1].trim();
    }

    // Órgão
    const courtMatch = emailText.match(/Órgão:\s*([^\n]+)/i);
    if (courtMatch) {
      result.court = courtMatch[1].trim();
    }

    // Data de Autuação (com hora)
    const filingDateMatch = emailText.match(/Data de Autuação:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/i);
    if (filingDateMatch) {
      const [, day, month, year, hour, minute] = filingDateMatch;
      result.filingDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    }

    // Assunto
    const subjectMatch = emailText.match(/Assunto:\s*([^\n]+)/i);
    if (subjectMatch) {
      result.processSubject = subjectMatch[1].trim();
    }

    // Movimentações
    result.movements = this.parseMovements(emailText);

    if (!result.processNumber) {
      result.parsingError = 'Número do processo não encontrado';
    }

    return result;
  }

  private isTJMAEmail(text: string): boolean {
    return (
      text.includes('TJMA') ||
      text.includes('Maranhão') ||
      text.includes('contatopje@tjma.jus.br') ||
      text.includes('PJe Push') ||
      text.includes('Número do Processo:')
    );
  }

  private parseMovements(text: string): PushMovement[] {
    const movements: PushMovement[] = [];

    // Padrão TJMA: Data - Movimento DD/MM/YYYY HH:MM - descrição
    const movementPattern = /Data - Movimento\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s*-\s*([^\n]+)/gi;

    let match;
    while ((match = movementPattern.exec(text)) !== null) {
      const [, day, month, year, hour, minute, description] = match;

      movements.push({
        date: new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)),
        type: 'Movimentação',
        description: description.trim(),
      });
    }

    return movements;
  }
}
