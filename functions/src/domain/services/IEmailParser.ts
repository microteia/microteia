import type { PushMovement } from '../../domain/entities/Push';

export interface ParsedEmailData {
  processNumber?: string;
  court?: string;
  activeParty?: string;
  passiveParty?: string;
  legalClass?: string;
  filingDate?: Date;
  distributionType?: string;
  processSubject?: string;
  movements?: PushMovement[];
  parsedByAI: boolean;
  parsingError?: string;
}

/**
 * Interface para parsers específicos de cada tribunal
 */
export interface IEmailParser {
  /**
   * Nome/identificador do parser (ex: 'TJBA', 'TJMA')
   */
  readonly name: string;

  /**
   * Tenta fazer parsing do email
   * @returns ParsedEmailData se conseguiu extrair dados, null se não é compatível
   */
  tryParse(emailText: string, emailHtml?: string): Omit<ParsedEmailData, 'parsedByAI'> | null;
}
