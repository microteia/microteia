import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import type { PushMovement } from '../../../domain/entities/Push';

/**
 * Parser específico para emails do PJe do Conselho Nacional de Justiça
 * Remetente: g-assistencia.qualidade.pje@cnj.jus.br
 */
export class CNJEmailParser implements IEmailParser {
  readonly name = 'CNJ';

  tryParse(emailText: string, emailHtml?: string): Array<Omit<ParsedEmailData, 'parsedByAI'>> {
    const textContent = emailText || '';
    const htmlContent = emailHtml ? this.cleanHtml(emailHtml) : '';
    const content = `${textContent}\n${htmlContent}`;

    if (!this.isCNJEmail(content)) {
      return [];
    }

    const result: Omit<ParsedEmailData, 'parsedByAI'> = {};

    const processNumberMatch = content.match(/Número do Processo:\s*(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i);
    if (processNumberMatch) {
      result.processNumber = processNumberMatch[1];
    }

    const activePoleMatch = emailText.match(/Polo Ativo:\s*([^\n]+)/i);
    if (activePoleMatch) {
      result.activeParty = activePoleMatch[1].trim();
    }

    const passivePoleMatch = emailText.match(/Polo Passivo:\s*([^\n]+)/i);
    if (passivePoleMatch) {
      result.passiveParty = passivePoleMatch[1].trim();
    }

    const legalClassMatch = emailText.match(/Classe Judicial:\s*([^\n]+)/i);
    if (legalClassMatch) {
      result.legalClass = legalClassMatch[1].trim();
    }

    const courtMatch = emailText.match(/Órgão:\s*([^\n]+)/i);
    if (courtMatch) {
      result.court = courtMatch[1].trim();
    }

    const filingDateMatch = emailText.match(/Data de Autuação:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/i);
    if (filingDateMatch) {
      const [, day, month, year, hour, minute] = filingDateMatch;
      result.filingDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    }

    const subjectMatch = content.match(/Assunto:\s*([^\n]+)/i);
    if (subjectMatch) {
      result.processSubject = subjectMatch[1].trim();
    }

    result.movements = this.parseMovements(content);

    if (!result.processNumber) {
      result.parsingError = 'Número do processo não encontrado';
    }

    return [result];
  }

  private cleanHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?( p|div|tr|td|th)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/\n\s*\n/g, '\n');
  }

  private isCNJEmail(text: string): boolean {
    return (
      text.includes('CNJ') ||
      text.includes('Conselho Nacional de Justiça') ||
      text.includes('g-assistencia.qualidade.pje@cnj.jus.br') ||
      text.includes('Número do Processo:')
    );
  }

  private parseMovements(text: string): PushMovement[] {
    const movements: PushMovement[] = [];

    // Padrão CNJ: após "Data - Movimento", as movimentações vêm em linhas separadas
    // Formato: DD/MM/YYYY HH:MM - descrição
    const movementSectionMatch = text.match(/Data - Movimento\s*([\s\S]*?)(?=\n\n|$)/i);
    if (!movementSectionMatch) {
      return movements;
    }

    const movementSection = movementSectionMatch[1];
    const movementPattern = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s*-\s*([^\n]+)/g;

    let match;
    while ((match = movementPattern.exec(movementSection)) !== null) {
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
