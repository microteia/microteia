import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import type { PushMovement } from '../../../domain/entities/Push';

/**
 * Parser específico para emails do PJe do Tribunal de Justiça do Maranhão
 * Remetente: contatopje@tjma.jus.br
 */
export class TJMAEmailParser implements IEmailParser {
  readonly name = 'TJMA';

  tryParse(emailText: string, emailHtml?: string): Array<Omit<ParsedEmailData, 'parsedByAI'>> {
    const textContent = emailText || '';
    const htmlContent = emailHtml ? this.cleanHtml(emailHtml) : '';
    const content = `${textContent}\n${htmlContent}`;

    if (!this.isTJMAEmail(content)) {
      console.log('TJMAEmailParser: conteúdo não corresponde ao padrão esperado.');
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
