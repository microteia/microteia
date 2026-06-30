import type { ParsedEmailData } from '../../domain/services/IEmailParser';
import type { IEmailParser } from '../../domain/services/IEmailParser';
import type { IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { AICredentials } from '../../domain/entities/AICredentials';
import { TJBAEmailParser } from './parsers/TJBAEmailParser';
import { TJMAEmailParser } from './parsers/TJMAEmailParser';

export interface IEmailParserService {
  parse(emailText: string, emailFrom: string, emailHtml?: string): Promise<ParsedEmailData>;
}

/**
 * Serviço de parsing de emails com padrão Strategy.
 * Mantém múltiplos parsers (um por tribunal) e escolhe o mais adequado.
 * Fallback para IA quando regex não funciona.
 */
export class EmailParserService implements IEmailParserService {
  private parsers: IEmailParser[];
  private parserByEmail: Map<string, IEmailParser>;
  private aiProviders: IAIProviderService[];

  constructor(aiProviders: IAIProviderService[]) {
    this.aiProviders = aiProviders;
    
    // Registrar todos os parsers disponíveis
    this.parsers = [
      new TJBAEmailParser(),
      new TJMAEmailParser(),
      // TODO: Adicionar mais parsers conforme necessário
      // new TRTEmailParser(),
      // new TRFEmailParser(),
    ];

    // Mapa de email → parser para lookup rápido
    this.parserByEmail = new Map([
      ['pje@tjba.jus.br', this.parsers.find(p => p.name === 'TJBA')!],
      ['contatopje@tjma.jus.br', this.parsers.find(p => p.name === 'TJMA')!],
      ['g-assistencia.qualidade.pje@cnj.jus.br', this.parsers.find(p => p.name === 'TJBA')!],
      // TODO: Adicionar mais mapeamentos
    ]);
  }

  async parse(emailText: string, emailFrom: string, emailHtml?: string): Promise<ParsedEmailData> {
    // Normalizar email (extrair domínio)
    const normalizedFrom = this.normalizeEmail(emailFrom);
    
    // Estratégia 1: Tentar parser específico baseado no remetente
    const specificParser = this.parserByEmail.get(normalizedFrom);
    if (specificParser) {
      console.log(`Usando parser específico: ${specificParser.name}`);
      const result = specificParser.tryParse(emailText, emailHtml);
      if (result) {
        return {
          ...result,
          parsedByAI: false,
        };
      }
    }

    // Estratégia 2: Fallback - tentar todos os parsers disponíveis
    console.log('Parser específico não encontrado ou falhou, tentando fallback...');
    for (const parser of this.parsers) {
      const result = parser.tryParse(emailText, emailHtml);
      if (result && result.processNumber) {
        console.log(`Parsing bem-sucedido com parser: ${parser.name}`);
        return {
          ...result,
          parsedByAI: false,
        };
      }
    }

    // Estratégia 3: Se nenhum parser funcionou, tentar IA
    console.warn('Nenhum parser conseguiu extrair dados, tentando IA...');
    try {
      return await this.parseWithAI(emailText, emailFrom, emailHtml);
    } catch (error) {
      console.error('Erro ao tentar parsing com IA:', error);
      return {
        parsedByAI: false,
        parsingError: `Nenhum parser compatível encontrado. Erro IA: ${error instanceof Error ? error.message : 'Desconhecido'}`,
      };
    }
  }

  /**
   * Parsing com IA quando regex falha.
   * Usa credenciais de environment variables.
   */
  private async parseWithAI(emailText: string, emailFrom: string, emailHtml?: string): Promise<ParsedEmailData> {
    // Buscar credenciais de variáveis de ambiente
    const credentials = this.getAICredentialsFromEnv();
    if (!credentials) {
      throw new Error('Credenciais de IA não configuradas (env vars AI_PROVIDER, AI_API_KEY, AI_MODEL)');
    }

    // Encontrar provider adequado
    const provider = this.aiProviders.find(p => p.canHandle(credentials.provider));
    if (!provider) {
      throw new Error(`Provider de IA não suportado: ${credentials.provider}`);
    }

    // Criar prompt para extração de dados processuais
    const prompt = this.buildParsingPrompt(emailText, emailFrom, emailHtml);

    // Chamar IA
    const rawResponse = await provider.call(credentials, prompt);

    // Extrair JSON da resposta
    const jsonData = this.extractJSON(rawResponse);

    // Parse e validação
    try {
      const parsed = JSON.parse(jsonData) as Partial<ParsedEmailData>;
      return {
        processNumber: parsed.processNumber,
        court: parsed.court,
        activeParty: parsed.activeParty,
        passiveParty: parsed.passiveParty,
        legalClass: parsed.legalClass,
        filingDate: parsed.filingDate ? new Date(parsed.filingDate) : undefined,
        distributionType: parsed.distributionType,
        processSubject: parsed.processSubject,
        movements: parsed.movements,
        parsedByAI: true,
      };
    } catch (error) {
      throw new Error(`IA retornou JSON inválido: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, {
        cause: error,
      });
    }
  }

  /**
   * Busca credenciais de IA a partir de variáveis de ambiente
   */
  private getAICredentialsFromEnv(): AICredentials | null {
    const provider = process.env.AI_PROVIDER;
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;

    if (!provider || !apiKey || !model) {
      return null;
    }

    return {
      provider: provider as AICredentials['provider'],
      apiKey,
      model,
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000', 10),
    };
  }

  /**
   * Constrói prompt para IA extrair dados processuais
   */
  private buildParsingPrompt(emailText: string, emailFrom: string, emailHtml?: string): string {
    return `Você é um assistente especializado em extrair dados processuais de emails de tribunais brasileiros.

TAREFA: Analise o email abaixo e extraia TODOS os dados processuais disponíveis. Retorne APENAS um objeto JSON válido, sem explicações.

FORMATO DE SAÍDA (JSON):
{
  "processNumber": "número do processo no formato CNJ (ex: 0000000-00.0000.0.00.0000)",
  "court": "tribunal (ex: TJBA, TJMA, TRT5, TRF1)",
  "activeParty": "nome do polo ativo/autor/requerente",
  "passiveParty": "nome do polo passivo/réu/requerido",
  "legalClass": "classe judicial (ex: Ação Civil, Execução Fiscal)",
  "filingDate": "data de autuação/distribuição em formato ISO (YYYY-MM-DD)",
  "distributionType": "tipo de distribuição",
  "processSubject": "assunto do processo",
  "movements": [
    {
      "date": "data da movimentação em ISO (YYYY-MM-DD)",
      "description": "descrição da movimentação",
      "documentName": "nome do documento anexado (se houver)"
    }
  ]
}

REGRAS:
- Use null para campos não encontrados
- Mantenha nomes exatamente como aparecem no email
- Data no formato ISO: YYYY-MM-DD
- Número do processo deve estar no formato CNJ quando possível
- Movimentações devem estar ordenadas cronologicamente

EMAIL:
Remetente: ${emailFrom}

Conteúdo:
${emailText}
${emailHtml ? `\n\nHTML:\n${emailHtml}` : ''}

IMPORTANTE: Retorne APENAS o JSON, sem texto adicional antes ou depois.`;
  }

  /**
   * Extrai JSON de resposta de IA (pode vir em code block)
   */
  private extractJSON(text: string): string {
    // Tentar extrair de code block primeiro
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlock) return codeBlock[1];

    // Tentar encontrar objeto JSON diretamente
    const jsonObj = text.match(/\{[\s\S]*\}/);
    if (jsonObj) return jsonObj[0];

    // Se não encontrou, retornar texto completo (vai falhar no parse)
    return text;
  }

  /**
   * Extrai o email completo do campo "from" (remove nome se houver)
   * Exemplo: "PJe TJBA <pje@tjba.jus.br>" → "pje@tjba.jus.br"
   */
  private normalizeEmail(from: string): string {
    const emailMatch = from.match(/<(.+?)>/) || from.match(/([^\s<>]+@[^\s<>]+)/);
    return emailMatch ? emailMatch[1].toLowerCase() : from.toLowerCase();
  }
}

export { ParsedEmailData };
