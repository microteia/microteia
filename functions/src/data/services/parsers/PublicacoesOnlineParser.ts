import type { IEmailParser, ParsedEmailData } from '../../../domain/services/IEmailParser';
import type { PushMovement } from '../../../domain/entities/Push';

interface PublicacaoData {
  advogadoOrigem?: string;
  loginOAB?: string;
  codigoPublicacao?: string;
  dataDisponibilizacao?: Date;
  dataPublicacao?: Date;
  jornal?: string;
  pagina?: string;
  numeroProcesso?: string;
  orgao?: string;
  cidade?: string;
  vara?: string;
  dataHoraLancamento?: Date;
  conteudo?: string;
  inteiroTeorUrl?: string;
}

/**
 * Parser específico para emails do Publicações Online (TJBA)
 * Remetente: suporte@publicacoesonline.com.br
 */
export class PublicacoesOnlineParser implements IEmailParser {
  readonly name = 'PUBLICACOES_ONLINE';

  tryParse(emailText: string, emailHtml?: string): Array<Omit<ParsedEmailData, 'parsedByAI'>> {
    if (!this.isPublicacoesOnlineEmail(emailText, emailHtml)) {
      return [];
    }

    const publicacoes = this.parseAllPublicacoes(emailText, emailHtml);

    return publicacoes.map(pub => this.convertToParseData(pub));
  }

  private parseAllPublicacoes(emailText: string, emailHtml?: string): PublicacaoData[] {
    const sourceText = emailHtml || emailText;
    const publicacoes: PublicacaoData[] = [];

    const publicacaoBlocks = this.extractPublicacaoBlocks(sourceText);

    for (const block of publicacaoBlocks) {
      const publicacao = this.parsePublicacaoBlock(block);
      if (publicacao.numeroProcesso) {
        publicacoes.push(publicacao);
      }
    }

    return publicacoes;
  }

  private isPublicacoesOnlineEmail(text: string, html?: string): boolean {
    const source = html || text;
    return (
      source.includes('publicacoesonline.com.br') ||
      source.includes('Relatório de Novas Intimações') ||
      source.includes('Publicações OnLine')
    );
  }

  private extractPublicacaoBlocks(source: string): string[] {
  // O parser funciona melhor utilizando o texto simples do email.
  // Remove HTML caso tenha sido passado.
  const text = this.cleanHtml(source);

  // Procura blocos iniciados por "1/4", "2/4", etc.
  const numberedBlocks = text.match(
    /\d+\s*\/\s*\d+[\s\S]*?(?=\n\s*\d+\s*\/\s*\d+\s*\n|$)/g
  );

  if (numberedBlocks && numberedBlocks.length > 0) {
    return numberedBlocks;
  }

  // Fallback: alguns emails não possuem a numeração.
  const advBlocks = text
    .split(/(?=Advogado de Origem)/i)
    .filter(
      b =>
        /N[º°]?\s*de Processo/i.test(b) ||
        /Código da Publicação/i.test(b)
    );

  if (advBlocks.length > 0) {
    return advBlocks;
  }

  return [];
}

  private parsePublicacaoBlock(block: string): PublicacaoData {
    const pub: PublicacaoData = {};

  pub.advogadoOrigem = this.extractField(
    block,
    /Advogado de Origem[:\s]*([^\n(]+)/i
  );

  pub.loginOAB = this.extractField(
    block,
    /Login[:\s]*([^\n]+)/i
  );

  pub.codigoPublicacao = this.extractField(
    block,
    /Código da Publicação[:\s]*(\d+)/i
  );
    
  const dataDisp = this.extractField(
  block,
  /Disponibilização.*?(\d{2}\/\d{2}\/\d{4})/i
);
if(dataDisp) {
  pub.dataDisponibilizacao = this.parseDate(dataDisp);
}

    const dataPub = this.extractField(
  block,
  /Publicação.*?(\d{2}\/\d{2}\/\d{4})/i
);
    if (dataPub) {
      pub.dataPublicacao = this.parseDate(dataPub);
    }

    pub.jornal = this.extractField(
  block,
  /Jornal[:\s]*([^\n]+)/i
);
    pub.pagina = this.extractField(
  block,
  /Página[:\s]*(\d+)/i
);

    const processNumber = this.extractField(
  block,
  /N[º°]?\s*de Processo[:\s]*([0-9.-]+)/i
);
    if (processNumber) {
      pub.numeroProcesso = this.formatProcessNumber(processNumber);
    }

pub.orgao = this.extractField(
  block,
  /Órgão[:\s]*([^\n]+)/i
);

pub.cidade = this.extractField(
  block,
  /Cidade[:\s]*([^\n]+)/i
);

pub.vara = this.extractField(
  block,
  /Vara[:\s]*([^\n]+)/i
);

const dataLanc = this.extractField(
  block,
  /Data\s*\/\s*Hora.*?(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/i
);    if (dataLanc) {
      pub.dataHoraLancamento = this.parseDateTime(dataLanc);
    }

const conteudoMatch = block.match(
  /Conteúdo[:\s]*([\s\S]*?)(?=Inteiro Teor:|$)/i
);

if (conteudoMatch) {
  pub.conteudo = conteudoMatch[1].trim();
}   

pub.inteiroTeorUrl = this.extractField(
  block,
  /Inteiro\s+Teor[:\s]*(https?:\/\/\S+)/i
);
    return pub;
  }

  private extractField(text: string, pattern: RegExp): string | undefined {
    const match = text.match(pattern);
    if (match && match[1]) {
      return this.cleanText(match[1]);
    }
    return undefined;
  }

  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanHtml(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  private formatProcessNumber(number: string): string {
    const digits = number.replace(/\D/g, '');
    if (digits.length === 20) {
      return `${digits.substr(0, 7)}-${digits.substr(7, 2)}.${digits.substr(9, 4)}.${digits.substr(13, 1)}.${digits.substr(14, 2)}.${digits.substr(16, 4)}`;
    }
    return number;
  }

  private parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split('/').map(Number);
    return new Date(year, month - 1, day);
  }

  private parseDateTime(dateTimeStr: string): Date {
    const [dateStr, timeStr] = dateTimeStr.split(/\s+/);
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hour, minute, second] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, second);
  }

  private convertToParseData(pub: PublicacaoData): Omit<ParsedEmailData, 'parsedByAI'> {
    const movement: PushMovement | undefined = pub.dataPublicacao ? {
      date: pub.dataPublicacao,
      type: 'Intimação - Diário Oficial',
      description: pub.conteudo?.substring(0, 200),
      documentUrl: pub.inteiroTeorUrl,
    } : undefined;

    return {
      processNumber: pub.numeroProcesso,
      court: pub.vara || pub.orgao,
      movements: movement ? [movement] : undefined,
    };
  }
}
