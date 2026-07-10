import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import {
  CNJ_MASKED_REGEX,
  accentInsensitiveSource,
  decodeHtmlEntities,
  htmlToText,
  labeledValue,
  parseExtenseDate,
} from './emailParsingUtils';

/**
 * Parser do Projudi (Processo Judicial Digital) do TJBA.
 * Remetente: projudi@tjba.jus.br — corpo em texto puro (uma intimação por e-mail).
 */
export class ProjudiTJBAEmailParser implements IEmailParser {
  readonly name = 'ProjudiTJBA';

  tryParse(emailText: string, emailHtml?: string): Array<Omit<ParsedEmailData, 'parsedByAI'>> {
    const content = `${decodeHtmlEntities(emailText || '')}\n${htmlToText(emailHtml || '')}`;

    if (!this.matches(content)) {
      return [];
    }

    const result: Omit<ParsedEmailData, 'parsedByAI'> = {};

    const processMatch = content.match(
      new RegExp(`PROCESSO JUDICIAL[^\\d]*(${CNJ_MASKED_REGEX.source})`, 'i'),
    );
    if (processMatch) {
      result.processNumber = processMatch[1];
    }

    const distribuicao = labeledValue(content, 'DISTRIBUIÇÃO');
    if (distribuicao) {
      result.filingDate = parseExtenseDate(distribuicao);
    }

    result.court = labeledValue(content, 'JUÍZO');
    result.legalClass = labeledValue(content, 'TIPO DE AÇÃO');
    result.activeParty = labeledValue(content, 'PROMOVENTE(S)');
    result.passiveParty = labeledValue(content, 'PROMOVIDO(S)');

    const movimentacao = content.match(
      new RegExp(
        `${accentInsensitiveSource('referente à movimentação')}\\s+(.+?)\\s*,\\s*` +
          `${accentInsensitiveSource('ocorrido em')}\\s+([^,]+?)\\s*,`,
        'i',
      ),
    );
    if (movimentacao) {
      const tipo = movimentacao[1].trim();
      const dataOcorrido = parseExtenseDate(movimentacao[2].trim());
      result.processSubject = tipo;
      const isDecurso = /decurso de prazo/i.test(content);
      result.movements = [{
        date: dataOcorrido ?? result.filingDate ?? new Date(),
        type: isDecurso ? 'Decurso de Prazo' : 'Movimentação',
        description: tipo,
      }];
    }

    if (!result.processNumber) {
      result.parsingError = 'Número do processo não encontrado';
    }

    return [result];
  }

  private matches(content: string): boolean {
    return (
      content.includes('projudi@tjba.jus.br') ||
      /PROCESSO JUDICIAL N/i.test(content) ||
      (/PROMOVENTE/i.test(content) && /PROMOVIDO/i.test(content))
    );
  }
}
