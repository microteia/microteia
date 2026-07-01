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
   * @returns Array de ParsedEmailData (pode ter 1 ou mais intimações por email)
   * Retorna array vazio se não é compatível ou não conseguiu extrair dados
   */
  tryParse(emailText: string, emailHtml?: string): Array<Omit<ParsedEmailData, 'parsedByAI'>>;
}
