import type { ParsedEmailData } from '../../domain/services/IEmailParser';
import type { IEmailParser } from '../../domain/services/IEmailParser';
import type { IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { IAIConnectionRepository } from '../../domain/repositories/IAIConnectionRepository';
import { TJBAEmailParser } from './parsers/TJBAEmailParser';
import { TJMAEmailParser } from './parsers/TJMAEmailParser';
import { ProjudiTJBAEmailParser } from './parsers/ProjudiTJBAEmailParser';
import { CNJEmailParser } from './parsers/CNJEmailParser';
import { PublicacoesOnlineParser } from './parsers/PublicacoesOnlineParser';
import { TRTEmailParser } from './parsers/TRTEmailParser';

export interface IEmailParserService {
  parse(emailText: string, emailFrom: string, tenantId: string, emailHtml?: string): Promise<ParsedEmailData[]>;
}

/**
 * Serviço de parsing de emails com padrão Strategy.
 * Mantém múltiplos parsers (um por tribunal) e escolhe o mais adequado.
 * Fallback para IA quando regex não funciona.
 */
export class EmailParserService implements IEmailParserService {
  private parsers: IEmailParser[];
  private parserByEmail: Map<string, IEmailParser>;
  private parserByPattern: Array<{ pattern: RegExp; parser: IEmailParser }>;
  private aiProviders: IAIProviderService[];
  private aiConnectionRepo: IAIConnectionRepository;

  constructor(aiProviders: IAIProviderService[], aiConnectionRepo: IAIConnectionRepository) {
    this.aiProviders = aiProviders;
    this.aiConnectionRepo = aiConnectionRepo;

    // Registrar todos os parsers disponíveis
    this.parsers = [
      new PublicacoesOnlineParser(),
      new TJBAEmailParser(),
      new TJMAEmailParser(),
      new ProjudiTJBAEmailParser(),
      new CNJEmailParser(),
      new TRTEmailParser(),
      // TODO: Adicionar mais parsers conforme necessário
      // new TRFEmailParser(),
    ];

    // Mapa de email → parser para lookup rápido de remetentes com endereço fixo
    this.parserByEmail = new Map([
      ['pje@tjba.jus.br', this.parsers.find(p => p.name === 'TJBA')!],
      ['contatopje@tjma.jus.br', this.parsers.find(p => p.name === 'TJMA')!],
      ['g-assistencia.qualidade.pje@cnj.jus.br', this.parsers.find(p => p.name === 'CNJ')!],
      ['projudi@tjba.jus.br', this.parsers.find(p => p.name === 'ProjudiTJBA')!],
      ['suporte@publicacoesonline.com.br', this.parsers.find(p => p.name === 'PUBLICACOES_ONLINE')!],
    ]);

    // Regras por padrão para remetentes cujo domínio varia previsivelmente
    // (ex: os 24 TRTs, um por região: trt1.jus.br ... trt24.jus.br)
    this.parserByPattern = [
      { pattern: /@trt\d{1,2}\.jus\.br\b/i, parser: this.parsers.find(p => p.name === 'TRT')! },
      // TODO: Adicionar mais regras conforme necessário
    ];
  }

  private findParserByPattern(text: string): IEmailParser | undefined {
    return this.parserByPattern.find(({ pattern }) => pattern.test(text))?.parser;
  }

  async parse(emailText: string, emailFrom: string, tenantId: string, emailHtml?: string): Promise<ParsedEmailData[]> {
    const normalizedFrom = this.normalizeEmail(emailFrom);

    console.log(`Iniciando parsing de email de: ${normalizedFrom}`);
    console.log(`Conteúdo do email (texto): ${emailText.substring(0, 200)}...`);
    console.log(`Conteúdo do email (HTML): ${emailHtml ? emailHtml.substring(0, 200) + '...' : 'N/A'}`);

    let specificParser = this.parserByEmail.get(normalizedFrom) ?? this.findParserByPattern(normalizedFrom);

    if (!specificParser) {
      console.log('Parser não encontrado pelo remetente, verificando conteúdo do email...');
      const emailContent = `text:${emailText} html:${emailHtml || ''}`.toLowerCase();

      for (const [knownEmail, parser] of this.parserByEmail.entries()) {
        if (emailContent.includes(knownEmail.toLowerCase())) {
          console.log(`Parser encontrado pelo conteúdo: ${parser.name} (email: ${knownEmail})`);
          specificParser = parser;
          break;
        }
      }

      if (!specificParser) {
        specificParser = this.findParserByPattern(emailContent);
      }
    }

    if (specificParser) {
      console.log(`Usando parser específico: ${specificParser.name}`);
      const results = specificParser.tryParse(emailText, emailHtml);
      if (results.length > 0) {
        return results.map(r => ({ ...r, parsedByAI: false }));
      }
    }

    console.log('Parser específico não encontrado ou falhou, tentando fallback...');
    for (const parser of this.parsers) {

      const results = parser.tryParse(emailText, emailHtml);
      if (results.length > 0 && results[0].processNumber) {
        console.log(`Parsing bem-sucedido com parser: ${parser.name}`);
        return results.map(r => ({ ...r, parsedByAI: false }));
      }
    }

    console.warn('Nenhum parser conseguiu extrair dados, tentando IA...');
    try {
      const aiResult = await this.parseWithAI(emailText, emailFrom, tenantId, emailHtml);
      return [aiResult];
    } catch (error) {
      console.error('Erro ao tentar parsing com IA:', error);
      return [{
        parsedByAI: false,
        parsingError: `Nenhum parser compatível encontrado. Erro IA: ${error instanceof Error ? error.message : 'Desconhecido'}`,
      }];
    }
  }

  /**
   * Parsing com IA quando regex falha.
   * Tenta todas as IAs configuradas no tenant (padrão primeiro).
   */
  private async parseWithAI(emailText: string, emailFrom: string, tenantId: string, emailHtml?: string): Promise<ParsedEmailData> {
    const allCredentials = await this.aiConnectionRepo.getAllCredentials(tenantId);

    if (allCredentials.length === 0) {
      throw new Error('Nenhuma conexão de IA configurada para este escritório. Configure ao menos uma conexão de IA para permitir parsing automático. Vá para o menu "Escritórios/Conexão de IA"');
    }

    console.log(`Encontradas ${allCredentials.length} conexão(ões) de IA para tenant ${tenantId}`);

    const errors: string[] = [];

    for (let i = 0; i < allCredentials.length; i++) {
      const credentials = allCredentials[i];
      const isDefault = i === 0;

      console.log(`Tentando IA ${i + 1}/${allCredentials.length}: ${credentials.provider}/${credentials.model}${isDefault ? ' (padrão)' : ''}`);

      try {
        const provider = this.aiProviders.find(p => p.canHandle(credentials.provider));
        if (!provider) {
          const error = `Provider de IA não suportado: ${credentials.provider}`;
          console.warn(error);
          errors.push(error);
          continue;
        }

        const prompt = this.buildParsingPrompt(emailText, emailFrom, emailHtml);

        const rawResponse = await provider.call(credentials, prompt);

        const jsonData = this.extractJSON(rawResponse);

        const parsed = JSON.parse(jsonData) as { processes?: unknown[] };

        if (!parsed.processes || !Array.isArray(parsed.processes)) {
          const error = `IA ${credentials.provider}/${credentials.model} não retornou um objeto com array de processes`;
          console.warn(error);
          errors.push(error);
          continue;
        }

        if (parsed.processes.length === 0) {
          const error = `IA ${credentials.provider}/${credentials.model} retornou array vazio`;
          console.warn(error);
          errors.push(error);
          continue;
        }

        const firstProcess = parsed.processes[0] as Record<string, unknown>;
        if (!firstProcess.processNumber) {
          const error = `IA ${credentials.provider}/${credentials.model} não extraiu número de processo`;
          console.warn(error);
          errors.push(error);
          continue;
        }

        console.log(`✓ Parsing bem-sucedido com IA: ${credentials.provider}/${credentials.model} (${parsed.processes.length} intimação(ões))`);

        return {
          processNumber: firstProcess.processNumber as string,
          court: firstProcess.court as string | undefined,
          activeParty: firstProcess.activeParty as string | undefined,
          passiveParty: firstProcess.passiveParty as string | undefined,
          legalClass: firstProcess.legalClass as string | undefined,
          filingDate: firstProcess.filingDate ? new Date(firstProcess.filingDate as string) : undefined,
          distributionType: firstProcess.distributionType as string | undefined,
          processSubject: firstProcess.processSubject as string | undefined,
          movements: (firstProcess.movements as Array<{ date: string; type: string; description?: string; documentUrl?: string }> | undefined)?.map((m) => ({
            date: new Date(m.date),
            type: m.type,
            description: m.description,
            documentUrl: m.documentUrl,
          })),
          parsedByAI: true,
        };
      } catch (error) {
        const errorMsg = `IA ${credentials.provider}/${credentials.model} falhou: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    throw new Error(`Todas as ${allCredentials.length} IA(s) falharam. Erros: ${errors.join('; ')}`);
  }

  /**
   * Constrói prompt para IA extrair dados processuais
   */
  private buildParsingPrompt(emailText: string, emailFrom: string, emailHtml?: string): string {
  return `Você é um parser especializado em documentos judiciais brasileiros.

Sua única função é converter o conteúdo do email em um JSON válido.

IMPORTANTE:
- Retorne APENAS um JSON válido.
- Não escreva explicações.
- Não escreva comentários.
- Não utilize markdown.
- Não utilize \`\`\`json.
- Não escreva qualquer texto antes ou depois do JSON.

OBJETIVO

Analise todo o conteúdo do email e extraia TODOS os processos judiciais encontrados.

O email pode ter sido enviado por qualquer sistema, incluindo, mas não se limitando a:

- Tribunais de Justiça
- Tribunais Federais
- PJe
- e-SAJ
- Projudi
- Eproc
- Publicações Online
- Diário da Justiça
- Escritórios de advocacia
- Outros sistemas judiciais

Nunca assuma um formato específico. Analise o conteúdo e identifique os processos.

FORMATO DA RESPOSTA (JSON):

{
  "processes": [
    {
      "processNumber": null,
      "court": null,
      "activeParty": null,
      "passiveParty": null,
      "legalClass": null,
      "filingDate": null,
      "distributionType": null,
      "processSubject": null,
      "movements": [
        {
          "date": null,
          "type": null,
          "description": null,
          "documentUrl": null
        }
      ]
    }
  ]
}

REGRAS

- SEMPRE retorne um objeto JSON com a propriedade "processes" contendo um array.
- Se não encontrar nenhum processo, retorne {"processes": []}.
- Nunca invente informações.
- Use null quando um campo não puder ser identificado.
- Preserve exatamente os nomes das partes.
- Preserve exatamente o número do processo encontrado.
- Sempre que possível utilize o padrão CNJ.
- Datas devem ser convertidas para YYYY-MM-DD.
- Ordene as movimentações cronologicamente quando possível.

IDENTIFICAÇÃO DOS PROCESSOS

Considere que normalmente um processo possui um número CNJ.

Se o email possuir vários processos independentes, retorne um objeto para cada processo dentro do array "processes".

Exemplos:

- 1 processo → {"processes": [objeto do processo]}.
- 5 intimações de processos diferentes → {"processes": [5 objetos]}.
- Relatório contendo diversos processos → um objeto para cada processo no array.
- Nenhum processo → {"processes": []}.

EXTRAÇÃO DOS CAMPOS

processNumber
Número CNJ do processo.

court
Tribunal, Vara, Comarca ou Juízo.

activeParty
Autor, Requerente, Exequente, Impetrante, Reclamante ou Polo Ativo.

passiveParty
Réu, Requerido, Executado, Impetrado, Reclamado ou Polo Passivo.

legalClass
Classe processual.

processSubject
Assunto do processo.

filingDate
Data de distribuição ou autuação.

distributionType
Tipo de distribuição, quando existir.

MOVIMENTAÇÕES

Extraia todas as movimentações relevantes.

Exemplos:

- Intimação
- Despacho
- Decisão
- Sentença
- Ato Ordinatório
- Acórdão
- Certidão
- Publicação
- Juntada

Para cada movimentação informe:

- date
- type
- description
- documentUrl

A descrição deve conter apenas o texto da movimentação.

LINKS

Caso exista um link para:

- Inteiro Teor
- Documento
- PDF
- Consulta Processual
- Visualizar Documento

extraia para documentUrl.

IGNORE COMPLETAMENTE

- Cabeçalhos SMTP.
- Received.
- ARC.
- DKIM.
- SPF.
- MIME.
- Authentication.
- HTML estrutural.
- CSS.
- JavaScript.
- Imagens.
- Assinaturas automáticas.
- Avisos de confidencialidade.

Considere apenas o conteúdo efetivo da comunicação judicial.

EMAIL

Remetente:
${emailFrom}

Conteúdo:
${emailText}

${emailHtml ? `HTML:\n${emailHtml}` : ''}

VALIDAÇÃO FINAL

Antes de responder, verifique:

- A resposta contém APENAS um único JSON.
- O JSON inicia com '{'.
- O JSON termina com '}'.
- Não existe texto antes do '{'.
- Não existe texto depois do '}'.
- O JSON possui a propriedade "processes" com um array.
- O JSON é sintaticamente válido.

Retorne somente o JSON.`;
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
    const angle = from.match(/<([^>]+)>/);
    if (angle) {
      return angle[1].toLowerCase();
    }

    const email = from.match(/[^\s<>]+@[^\s<>]+/);
    if (email) {
      return email[0].toLowerCase();
    }

    return from.toLowerCase();
  }
}

export { ParsedEmailData };
