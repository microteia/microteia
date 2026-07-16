import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import type { PushMovement } from '../../../domain/entities/Push';

/**
 * Parser específico para emails do PJe dos Tribunais Regionais do Trabalho (TRT)
 * Remetente: nao-responda-pje@trtX.jus.br (onde X é o número da região)
 * Padrão válido para todos os TRTs (TRT1, TRT2, TRT3, TRT4, TRT5, etc.)
 */
export class TRTEmailParser implements IEmailParser {
  readonly name = 'TRT';

  tryParse(emailText: string, emailHtml?: string): Array<Omit<ParsedEmailData, 'parsedByAI'>> {
    const textContent = emailText || '';
    const htmlContent = emailHtml ? this.cleanHtml(emailHtml) : '';
    const content = `${textContent}\n${htmlContent}`;

    if (!this.isTRTEmail(content)) {
      console.log('TRTEmailParser: conteúdo não corresponde ao padrão esperado.');
      return [];
    }

    const result: Omit<ParsedEmailData, 'parsedByAI'> = {};

    // Número do processo TRT: XXXXXXX-XX.YYYY.5.XX.XXXX (5 = Justiça do Trabalho)
    const processNumberMatch = content.match(/(\d{7}-\d{2}\.\d{4}\.5\.\d{2}\.\d{4})/);
    if (processNumberMatch) {
      result.processNumber = processNumberMatch[1];
    }

    // Classe Judicial
    const legalClassMatch = content.match(/Classe Judicial:\s*([^\n]+)/i);
    if (legalClassMatch) {
      result.legalClass = legalClassMatch[1].trim();
    }

    // Órgão Julgador
    const courtMatch = content.match(/Órgão Julgador:\s*([^\n]+)/i);
    if (courtMatch) {
      result.court = courtMatch[1].trim();
    }

    // Data de Autuação: DD/MM/YYYY HH:MM:SS
    const filingDateMatch = content.match(/Data de Autuação:\s*(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/i);
    if (filingDateMatch) {
      const [day, month, year] = filingDateMatch[1].split('/');
      const [hour, minute, second] = filingDateMatch[2].split(':');
      result.filingDate = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second)
      );
    }

    // Autor (polo ativo)
    const authorMatch = content.match(/Autor:\s*([^\n]+)/i);
    if (authorMatch) {
      result.activeParty = authorMatch[1].trim();
    }

    // Réu (polo passivo)
    const defendantMatch = content.match(/Réu:\s*([^\n]+)/i);
    if (defendantMatch) {
      result.passiveParty = defendantMatch[1].trim();
    }

    // Parse de movimentos/eventos
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
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|tr|td|th)[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&ccedil;/gi, 'ç')
      .replace(/&atilde;/gi, 'ã')
      .replace(/&aacute;/gi, 'á')
      .replace(/&eacute;/gi, 'é')
      .replace(/&iacute;/gi, 'í')
      .replace(/&oacute;/gi, 'ó')
      .replace(/&uacute;/gi, 'ú')
      .replace(/&agrave;/gi, 'à')
      .replace(/&acirc;/gi, 'â')
      .replace(/&ecirc;/gi, 'ê')
      .replace(/&ocirc;/gi, 'ô')
      .replace(/&Aacute;/gi, 'Á')
      .replace(/&Eacute;/gi, 'É')
      .replace(/&Iacute;/gi, 'Í')
      .replace(/&Oacute;/gi, 'Ó')
      .replace(/&Uacute;/gi, 'Ú')
      .replace(/&Ccedil;/gi, 'Ç')
      .replace(/&Atilde;/gi, 'Ã')
      .replace(/\n\s*\n/g, '\n');
  }

  /**
   * Verifica se o email é de um TRT
   */
  private isTRTEmail(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    // Verifica padrões específicos do TRT
    const hasTRTDomain = /nao-responda-pje@trt\d+\.jus\.br/.test(lowerText);
    const hasTRTReference = 
      lowerText.includes('tribunal regional do trabalho') ||
      /\btrt\d+\b/.test(lowerText) ||
      lowerText.includes('justiça do trabalho');
    const hasPJePush = 
      (lowerText.includes('[trt') && lowerText.includes('[push]')) ||
      lowerText.includes('processo judicial eletrônico') ||
      (lowerText.includes('pje') && lowerText.includes('push'));
    const hasTRTProcessNumber = /\d{7}-\d{2}\.\d{4}\.5\.\d{2}\.\d{4}/.test(text);
    
    // Deve ter pelo menos:
    // - O domínio do TRT, OU
    // - Referência ao TRT E PJe Push, OU
    // - Número de processo com código 5.XX (Justiça do Trabalho)
    return hasTRTDomain || 
           (hasTRTReference && hasPJePush) ||
           hasTRTProcessNumber;
  }

  /**
   * Extrai eventos da tabela HTML
   * Padrão TRT: tabela com colunas Data e Evento
   */
  private parseMovements(text: string): PushMovement[] {
    const movements: PushMovement[] = [];

    // Padrão 1: Tabela HTML parseada (já convertida para texto)
    // Formato: DD/MM/YYYY HH:MM | Descrição do evento
    const tablePattern = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+([^\n]+)/g;
    
    let match;
    while ((match = tablePattern.exec(text)) !== null) {
      const [, dateStr, timeStr, description] = match;
      
      // Ignora linhas de cabeçalho
      if (description.toLowerCase().includes('evento') || description.toLowerCase().includes('data')) {
        continue;
      }

      const [day, month, year] = dateStr.split('/');
      const [hour, minute] = timeStr.split(':');
      
      movements.push({
        date: new Date(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hour),
          Number(minute)
        ),
        type: 'Movimentação',
        description: description.trim(),
      });
    }

    return movements;
  }
}
