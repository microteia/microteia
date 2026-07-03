import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import type { PushMovement } from '../../../domain/entities/Push';

/**
 * Parser específico para emails do PJe do Tribunal de Justiça da Bahia
 * Remetente: pje@tjba.jus.br
 */
export class TJBAEmailParser implements IEmailParser {
  readonly name = 'TJBA';

  tryParse(emailText: string, emailHtml?: string): Array<Omit<ParsedEmailData, 'parsedByAI'>> {
    // Combina emailText e emailHtml para não perder informação
    // Muitos emails só têm HTML, outros só texto, alguns têm ambos
    const textContent = emailText || '';
    const htmlContent = emailHtml ? this.cleanHtml(emailHtml) : '';
    const content = `${textContent}\n${htmlContent}`;

    if (!this.isTJBAEmail(content)) {
      console.log('Email não identificado como TJBA, retornando array vazio.');
      return [];
    }

    const result: Omit<ParsedEmailData, 'parsedByAI'> = {};

    const processNumberMatch = content.match(/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    if (processNumberMatch) {
      result.processNumber = processNumberMatch[1];
    }

    const activePoleMatch = content.match(/Polo Ativo:\s*([^\n]+)/i);
    if (activePoleMatch) {
      result.activeParty = activePoleMatch[1].trim();
    }

    const passivePoleMatch = content.match(/Polo Passivo:\s*([^\n]+)/i);
    if (passivePoleMatch) {
      result.passiveParty = passivePoleMatch[1].trim();
    }

    const legalClassMatch = content.match(/Classe Judicial:\s*([^\n]+)/i);
    if (legalClassMatch) {
      result.legalClass = legalClassMatch[1].trim();
    }

    const courtMatch = content.match(/Órgão:\s*([^\n]+)/i);
    if (courtMatch) {
      result.court = courtMatch[1].trim();
    }

    const filingDateMatch = content.match(/Data de Autuação:\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (filingDateMatch) {
      const [day, month, year] = filingDateMatch[1].split('/');
      result.filingDate = new Date(Number(year), Number(month) - 1, Number(day));
    }

    const distTypeMatch = content.match(/Tipo de Distribuição:\s*([^\n]+)/i);
    if (distTypeMatch) {
      result.distributionType = distTypeMatch[1].trim();
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

  /**
   * Remove tags HTML e converte <br/> em quebras de linha
   */
  private cleanHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')  // <br> → \n
      .replace(/<\/?(p|div|tr|td|th)[^>]*>/gi, '\n')  // tags de bloco → \n
      .replace(/<[^>]+>/g, '')  // remove outras tags
      .replace(/&nbsp;/gi, ' ')  // &nbsp; → espaço
      .replace(/&amp;/gi, '&')   // &amp; → &
      .replace(/&lt;/gi, '<')    // &lt; → <
      .replace(/&gt;/gi, '>')    // &gt; → >
      .replace(/&quot;/gi, '"')  // &quot; → "
      .replace(/\n\s*\n/g, '\n'); // múltiplas linhas vazias → uma
  }

  private isTJBAEmail(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // Verifica se contém padrões específicos do PJe TJBA
    const hasTJBADomain = lowerText.includes('pje@tjba.jus.br');
    const hasTJBAReference = 
      lowerText.includes('tribunal de justiça do estado da bahia') ||
      lowerText.includes('tjba');
    const hasPJePush = lowerText.includes('pje push');
    const hasTJBAProcessNumber = /\d{7}-\d{2}\.\d{4}\.8\.05\.\d{4}/.test(text);
    
    // Deve ter pelo menos:
    // - O domínio do TJBA, OU
    // - Referência ao TJBA E PJe Push, OU
    // - Referência ao TJBA E número de processo com código 8.05 (TJBA)
    return hasTJBADomain || 
           (hasTJBAReference && hasPJePush) ||
           (hasTJBAReference && hasTJBAProcessNumber);
  }

  private parseMovements(text: string): PushMovement[] {
    const movements: PushMovement[] = [];

    // Padrão TJBA: DataMovimentoDocumento DD/MM/YYYY HH:MM Tipo [Link]
    const movementPattern = /DataMovimentoDocumento(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})([^[]*)\[([^\]]+)\]\(([^)]+)\)/g;
    
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
