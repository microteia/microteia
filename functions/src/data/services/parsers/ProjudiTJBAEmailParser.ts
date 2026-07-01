import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import type { PushMovement } from '../../../domain/entities/Push';

/**
 * Parser específico para emails do Projudi do Tribunal de Justiça da Bahia
 * Remetente: projudi@tjba.jus.br
 */
export class ProjudiTJBAEmailParser implements IEmailParser {
  readonly name = 'ProjudiTJBA';

  tryParse(emailText: string): Array<Omit<ParsedEmailData, 'parsedByAI'>> {
    if (!this.isProjudiTJBAEmail(emailText)) {
      return [];
    }

    const result: Omit<ParsedEmailData, 'parsedByAI'> = {};

    const processNumberMatch = emailText.match(/PROCESSO JUDICIAL Nº\s*(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/i);
    if (processNumberMatch) {
      result.processNumber = processNumberMatch[1];
    }

    const distributionMatch = emailText.match(/DISTRIBUIÇÃO:\s*(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\s+às?\s+(\d{1,2}):(\d{2})/i);
    if (distributionMatch) {
      const [, day, monthName, year, hour, minute] = distributionMatch;
      const month = this.parseMonthName(monthName);
      if (month !== -1) {
        result.filingDate = new Date(Number(year), month, Number(day), Number(hour), Number(minute));
      }
    }

    const courtMatch = emailText.match(/JUÍZO:\s*([^\n]+)/i);
    if (courtMatch) {
      result.court = courtMatch[1].trim();
    }

    const legalClassMatch = emailText.match(/TIPO DE AÇÃO:\s*([^\n]+)/i);
    if (legalClassMatch) {
      result.legalClass = legalClassMatch[1].trim();
    }

    const activePartyMatch = emailText.match(/PROMOVENTE\(S\):\s*([^\n]+)/i);
    if (activePartyMatch) {
      result.activeParty = activePartyMatch[1].trim();
    }

    const passivePartyMatch = emailText.match(/PROMOVIDO\(S\):\s*([^\n]+)/i);
    if (passivePartyMatch) {
      result.passiveParty = passivePartyMatch[1].trim();
    }

    result.movements = this.parseMovements(emailText);

    if (!result.processNumber) {
      result.parsingError = 'Número do processo não encontrado';
    }

    return [result];
  }

  private isProjudiTJBAEmail(text: string): boolean {
    // Verifica se contém padrões típicos do Projudi TJBA
    return (
      text.includes('PROCESSO JUDICIAL Nº') ||
      text.includes('PROMOVENTE(S):') ||
      text.includes('PROMOVIDO(S):') ||
      text.includes('projudi@tjba.jus.br')
    );
  }

  private parseMonthName(monthName: string): number {
    const months: Record<string, number> = {
      'janeiro': 0,
      'fevereiro': 1,
      'março': 2,
      'abril': 3,
      'maio': 4,
      'junho': 5,
      'julho': 6,
      'agosto': 7,
      'setembro': 8,
      'outubro': 9,
      'novembro': 10,
      'dezembro': 11,
    };

    return months[monthName.toLowerCase()] ?? -1;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- parâmetro será usado quando implementarmos parsing de movimentações
  private parseMovements(_text: string): PushMovement[] {
    const movements: PushMovement[] = [];

    // TODO: Implementar parsing de movimentações quando tivermos exemplos de emails
    // com movimentações do Projudi TJBA
    // Formato esperado ainda não foi analisado

    return movements;
  }
}
