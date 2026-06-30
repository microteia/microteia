import type { IEmailParser, ParsedEmailData } from '../../domain/services/IEmailParser';
import type { PushMovement } from '../../domain/entities/Push';

/**
 * Parser específico para emails do PJe do Tribunal de Justiça da Bahia
 * Remetente: pje@tjba.jus.br
 */
export class TJBAEmailParser implements IEmailParser {
  readonly name = 'TJBA';

  tryParse(emailText: string, emailHtml?: string): Omit<ParsedEmailData, 'parsedByAI'> | null {
    // Verificar se é realmente do TJBA (padrões conhecidos)
    if (!this.isTJBAEmail(emailText)) {
      return null;
    }

    const result: Omit<ParsedEmailData, 'parsedByAI'> = {};

    // Número do processo (formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO)
    const processNumberMatch = emailText.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
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

    // Data de Autuação
    const filingDateMatch = emailText.match(/Data de Autuação:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (filingDateMatch) {
      const [day, month, year] = filingDateMatch[1].split('/');
      result.filingDate = new Date(Number(year), Number(month) - 1, Number(day));
    }

    // Tipo de Distribuição
    const distTypeMatch = emailText.match(/Tipo de Distribuição:\s*([^\n]+)/i);
    if (distTypeMatch) {
      result.distributionType = distTypeMatch[1].trim();
    }

    // Assunto
    const subjectMatch = emailText.match(/Assunto:\s*([^\n]+)/i);
    if (subjectMatch) {
      result.processSubject = subjectMatch[1].trim();
    }

    // Movimentações
    result.movements = this.parseMovements(emailText);

    // Se não conseguiu extrair pelo menos o número do processo, considera falha
    if (!result.processNumber) {
      result.parsingError = 'Número do processo não encontrado';
    }

    return result;
  }

  private isTJBAEmail(text: string): boolean {
    // Verifica se contém padrões típicos do PJe TJBA
    return (
      text.includes('PJe Push') ||
      text.includes('Tribunal de Justiça') ||
      text.includes('TJBA') ||
      text.includes('pje@tjba.jus.br')
    );
  }

  private parseMovements(text: string): PushMovement[] {
    const movements: PushMovement[] = [];

    // Padrão TJBA: DataMovimentoDocumento DD/MM/YYYY HH:MM Tipo [Link]
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
}
