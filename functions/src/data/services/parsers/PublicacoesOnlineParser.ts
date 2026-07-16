import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import type { PushMovement } from '../../../domain/entities/Push';
import {
  decodeHtmlEntities,
  formatCNJ,
  htmlToText,
  labeledValue,
  normalizeWhitespace,
  parseBrDate,
} from './emailParsingUtils';

/**
 * Parser do "Publicações Online" (OAB-BA) — remetente suporte@publicacoesonline.com.br.
 * Um e-mail lista N intimações, cada uma numa tabela iniciada por "Advogado de Origem".
 */
export class PublicacoesOnlineParser implements IEmailParser {
  readonly name = 'PUBLICACOES_ONLINE';

  tryParse(emailText: string, emailHtml?: string): Array<Omit<ParsedEmailData, 'parsedByAI'>> {
    const source = emailHtml
      ? htmlToText(emailHtml)
      : normalizeWhitespace(decodeHtmlEntities(emailText || ''));

    if (!this.matches(source)) {
      console.log('PublicacoesOnlineParser: conteúdo não corresponde ao padrão esperado.');
      return [];
    }

    return source
      .split(/(?=Advogado de Origem)/i)
      .map((block) => this.parseBlock(block))
      .filter((r): r is Omit<ParsedEmailData, 'parsedByAI'> => r !== undefined);
  }

  private matches(source: string): boolean {
    return (
      source.includes('publicacoesonline.com.br') ||
      /Relat.rio de Intima/i.test(source) ||
      (/Advogado de Origem/i.test(source) && /N. de Processo/i.test(source))
    );
  }

  private parseBlock(block: string): Omit<ParsedEmailData, 'parsedByAI'> | undefined {
    const processValue = labeledValue(block, 'Nº de Processo');
    if (!processValue) return undefined;

    const result: Omit<ParsedEmailData, 'parsedByAI'> = {
      processNumber: formatCNJ(processValue),
      court: labeledValue(block, 'Vara') ?? labeledValue(block, 'Órgão'),
      activeParty: this.joinParties(block, 'POLO ATIVO'),
      passiveParty: this.joinParties(block, 'POLO PASSIVO'),
    };

    const detail = block.match(/Processo:\s*\d+\s*\n([^\n]+)\n([^\n]+)\n([^\n]+)/i);
    if (detail) {
      result.legalClass = detail[2].trim();
      result.processSubject = detail[3].trim();
    }

    const publicacao = labeledValue(block, 'Publicação do Jornal') ?? labeledValue(block, 'Disponibilização do Jornal');
    const movementDate = publicacao ? parseBrDate(publicacao) : undefined;
    const documentUrl = block.match(/Inteiro\s+Teor:\s*(https?:\/\/\S+)/i)?.[1];

    if (movementDate || documentUrl) {
      const movement: PushMovement = {
        date: movementDate ?? new Date(),
        type: result.processSubject ?? 'Intimação',
        documentUrl,
      };
      result.movements = [movement];
    }

    return result;
  }

  private joinParties(block: string, pole: 'POLO ATIVO' | 'POLO PASSIVO'): string | undefined {
    const names = [...block.matchAll(new RegExp(`PARTE:\\s*(.+?)\\s*-\\s*${pole}`, 'gi'))]
      .map((m) => m[1].trim())
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : undefined;
  }
}
