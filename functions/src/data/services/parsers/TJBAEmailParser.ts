import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import type { PushMovement } from '../../../domain/entities/Push';
import {
  decodeHtmlEntities,
  findCNJ,
  htmlToText,
  labeledValue,
  parseBrDate,
} from './emailParsingUtils';

/**
 * Parser do PJe Push do TJBA.
 * Remetente: pje@tjba.jus.br — corpo HTML com um processo e a tabela de movimentações.
 */
export class TJBAEmailParser implements IEmailParser {
  readonly name = 'TJBA';

  tryParse(emailText: string, emailHtml?: string): Array<Omit<ParsedEmailData, 'parsedByAI'>> {
    const html = emailHtml || '';
    const content = `${decodeHtmlEntities(emailText || '')}\n${htmlToText(html)}`;

    if (!this.matches(content)) {
      console.log('TJBAEmailParser: conteúdo não corresponde ao padrão esperado.');
      return [];
    }

    const result: Omit<ParsedEmailData, 'parsedByAI'> = {};

    const processValue = labeledValue(content, 'Número do Processo');
    if (processValue) {
      result.processNumber = findCNJ(processValue);
    }

    result.activeParty = labeledValue(content, 'Polo Ativo');
    result.passiveParty = labeledValue(content, 'Polo Passivo');
    result.legalClass = labeledValue(content, 'Classe Judicial');
    result.court = labeledValue(content, 'Órgão');
    result.distributionType = labeledValue(content, 'Tipo de Distribuição');
    result.processSubject = labeledValue(content, 'Assunto');

    const autuacao = labeledValue(content, 'Data de Autuação');
    if (autuacao) {
      result.filingDate = parseBrDate(autuacao);
    }

    const movements = this.parseMovements(html);
    if (movements.length > 0) {
      result.movements = movements;
    }

    if (!result.processNumber) {
      result.parsingError = 'Número do processo não encontrado';
    }

    return [result];
  }

  private matches(content: string): boolean {
    const hasPjePush = /PJe Push/i.test(content);
    const has805Process = /\d{7}-\d{2}\.\d{4}\.8\.05\.\d{4}/.test(content);
    const hasPjeFields = /Classe Judicial/i.test(content) && /N.mero do Processo/i.test(content);
    return hasPjePush && has805Process && hasPjeFields;
  }

  private parseMovements(html: string): PushMovement[] {
    const movements: PushMovement[] = [];

    for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1]);
      if (cells.length === 0) continue;

      const date = parseBrDate(htmlToText(cells[0]));
      if (!date) continue;

      const type = htmlToText(cells[1] ?? '') || 'Movimentação';
      const href = (cells[2] ?? '').match(/href="([^"]+)"/i)?.[1];

      movements.push({
        date,
        type,
        documentUrl: href && !href.startsWith('-1/') ? href : undefined,
      });
    }

    return movements;
  }
}
