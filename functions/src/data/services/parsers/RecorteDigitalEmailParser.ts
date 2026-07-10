import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import type { PushMovement } from '../../../domain/entities/Push';
import {
  CNJ_MASKED_REGEX,
  formatCNJ,
  htmlToText,
  labeledValue,
  parseBrDate,
} from './emailParsingUtils';

const BLOCK_REGEX = /<!--\s*Inicio publicacao;;Processo:(\d+)\s*-->([\s\S]*?)<!--\s*Fim publicacao/gi;
const PARTY_REGEX =
  /(POLO ATIVO|POLO PASSIVO|ADVOGADO):\s*(.+?)(?=\s+(?:POLO ATIVO|POLO PASSIVO|ADVOGADO):|\s+Acesso ao documento|\s+Identificador|$)/gi;

/**
 * Parser do "Recorte Digital" da OAB-BA (serviço Webjur).
 * Remetente: oabba@recortedigital.adv.br — cada publicação é um bloco delimitado por
 * comentários HTML `<!--Inicio publicacao;;Processo:XXX-->…<!--Fim publicacao;;…-->`.
 */
export class RecorteDigitalEmailParser implements IEmailParser {
  readonly name = 'RECORTE_DIGITAL';

  tryParse(emailText: string, emailHtml?: string): Array<Omit<ParsedEmailData, 'parsedByAI'>> {
    const html = emailHtml || emailText || '';
    if (!this.matches(html)) {
      return [];
    }

    const results: Array<Omit<ParsedEmailData, 'parsedByAI'>> = [];
    for (const match of html.matchAll(BLOCK_REGEX)) {
      const parsed = this.parseBlock(match[1], htmlToText(match[2]));
      if (parsed) results.push(parsed);
    }
    return results;
  }

  private matches(html: string): boolean {
    return (
      /Inicio publicacao;;Processo:/i.test(html) ||
      /recorte\s*digital/i.test(html) ||
      html.includes('recortedigital.adv.br')
    );
  }

  private parseBlock(rawProcess: string, block: string): Omit<ParsedEmailData, 'parsedByAI'> | undefined {
    const processMatch = block.match(new RegExp(`PROCESSO:\\s*(${CNJ_MASKED_REGEX.source})`, 'i'));
    const processNumber = processMatch ? processMatch[1] : formatCNJ(rawProcess);
    if (!processNumber) return undefined;

    const result: Omit<ParsedEmailData, 'parsedByAI'> = { processNumber };

    const classMatch = block.match(
      new RegExp(`PROCESSO:\\s*${CNJ_MASKED_REGEX.source}\\s*-\\s*(.+?)\\s*-\\s*\\|\\|`, 'i'),
    );
    if (classMatch) {
      result.legalClass = classMatch[1].trim();
    }

    const local = labeledValue(block, 'Local');
    if (local) {
      const parts = local.split(' - ').map((p) => p.trim()).filter(Boolean);
      result.court = parts[parts.length - 1];
    }

    const tail = block.includes('|||') ? block.slice(block.indexOf('|||') + 3) : block;
    result.activeParty = this.joinParties(tail, 'POLO ATIVO');
    result.passiveParty = this.joinParties(tail, 'POLO PASSIVO');

    const notification = block.match(/\|\|\s*([\s\S]*?)\s*\|\|\|/);
    const movementDateValue =
      labeledValue(block, 'Data de Publicação') ?? labeledValue(block, 'Data de Disponibilização');
    const documentUrl = block
      .match(/Acesso ao documento:\s*(.+?)(?:\s+Identificador|\n|$)/i)?.[1]
      ?.replace(/\s+/g, '');

    const movement: PushMovement = {
      date: (movementDateValue && parseBrDate(movementDateValue)) || new Date(),
      type: result.legalClass ?? 'Intimação',
      description: notification ? notification[1].trim().slice(0, 500) : undefined,
      documentUrl: documentUrl && /^https?:\/\//i.test(documentUrl) ? documentUrl : undefined,
    };
    result.movements = [movement];

    return result;
  }

  private joinParties(tail: string, pole: 'POLO ATIVO' | 'POLO PASSIVO'): string | undefined {
    const names: string[] = [];
    for (const match of tail.matchAll(PARTY_REGEX)) {
      if (match[1].toUpperCase() === pole) {
        names.push(match[2].trim());
      }
    }
    return names.length > 0 ? names.join(', ') : undefined;
  }
}
