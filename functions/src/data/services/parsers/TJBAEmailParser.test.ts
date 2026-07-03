import { describe, it, expect } from 'vitest';
import { TJBAEmailParser } from './TJBAEmailParser';

describe('TJBAEmailParser', () => {
  const parser = new TJBAEmailParser();

  describe('name', () => {
    it('deve ter o nome correto', () => {
      expect(parser.name).toBe('TJBA');
    });
  });

  describe('tryParse', () => {
    it('deve extrair dados de email PJe TJBA com movimentações', () => {
      const emailText = `
Tribunal de Justiça do Estado da Bahia <pje@tjba.jus.br>

TJBA

PJe Push - Serviço de Acompanhamento automático de processos

Prezado(a) ALEXNALDO CARVALHO DOS SANTOS, 

Informamos que o processo a seguir sofreu movimentação:
Número do Processo: 8161100-67.2024.8.05.0001
Polo Ativo: JENILDO GOES DOS SANTOS
Polo Passivo: ESTADO DA BAHIA
Classe Judicial: PROCEDIMENTO DO JUIZADO ESPECIAL DA FAZENDA PÚBLICA
Órgão: 2ª V DO SISTEMA DOS JUIZADOS ESPECIAIS DA FAZENDA PÚBLICA
Data de Autuação: 31/10/2024
Tipo de Distribuição: sorteio
Assunto: Gratificações e Adicionais

<table border="1"><th>Data</th><th>Movimento</th><th>Documento</th>
<tr><td>29/06/2026 21:07</td><td>Expedição de intimação.</td><td><a href="https://pje.tjba.jus.br/pje/Push/loginPush.seam/Painel/painel_usuario/documentoHTML.seam?idBin=538982119&amp;idProcessoDoc=566593679">Certidão - Certidão</a></td></tr>
<tr><td>29/06/2026 09:58</td><td>Juntada de certidão</td><td><a href="https://pje.tjba.jus.br/pje/Push/loginPush.seam/Painel/painel_usuario/documentoHTML.seam?idBin=538982119&amp;idProcessoDoc=566494101">Certidão - Certidão</a></td></tr>
</table>

Caso não tenha mais interesse em receber o push, acessar o link: https://pje.tjba.jus.br/pje/Push/loginPush.seam/Push/loginPush.seam

ATENÇÃO: este e-mail é gerado de forma automatizada, por gentileza, não o responda.
`;

      const results = parser.tryParse(emailText);

      expect(results).toHaveLength(1);
      
      const result = results[0];
      expect(result.processNumber).toBe('8161100-67.2024.8.05.0001');
      expect(result.activeParty).toBe('JENILDO GOES DOS SANTOS');
      expect(result.passiveParty).toBe('ESTADO DA BAHIA');
      expect(result.legalClass).toBe('PROCEDIMENTO DO JUIZADO ESPECIAL DA FAZENDA PÚBLICA');
      expect(result.court).toBe('2ª V DO SISTEMA DOS JUIZADOS ESPECIAIS DA FAZENDA PÚBLICA');
      expect(result.distributionType).toBe('sorteio');
      expect(result.processSubject).toBe('Gratificações e Adicionais');
      
      expect(result.filingDate).toBeInstanceOf(Date);
      expect(result.filingDate?.getDate()).toBe(31);
      expect(result.filingDate?.getMonth()).toBe(9); // outubro = mês 9 (0-indexed)
      expect(result.filingDate?.getFullYear()).toBe(2024);
    });

    it('deve retornar array vazio para email não-TJBA', () => {
      const emailText = `
From: outro@example.com
Subject: Outro assunto

Conteúdo não relacionado ao TJBA.
`;

      const results = parser.tryParse(emailText);

      expect(results).toEqual([]);
    });

    it('deve retornar erro de parsing quando não encontrar número do processo', () => {
      const emailText = `
Tribunal de Justiça do Estado da Bahia <pje@tjba.jus.br>

PJe Push

Email sem número de processo.
`;

      const results = parser.tryParse(emailText);

      expect(results).toHaveLength(1);
      expect(results[0].parsingError).toBe('Número do processo não encontrado');
      expect(results[0].processNumber).toBeUndefined();
    });

    it('deve identificar email TJBA pelo domínio pje@tjba.jus.br', () => {
      const emailText = `
From: pje@tjba.jus.br
Subject: Teste

Número do Processo: 1234567-89.2026.8.05.0001
`;

      const results = parser.tryParse(emailText);

      expect(results.length).toBeGreaterThan(0);
    });

    it('deve identificar email TJBA pela menção "TJBA"', () => {
      const emailText = `
TJBA
Número do Processo: 1234567-89.2026.8.05.0001
`;

      const results = parser.tryParse(emailText);

      expect(results.length).toBeGreaterThan(0);
    });

    it('deve extrair múltiplos campos opcionais quando presentes', () => {
      const emailText = `
pje@tjba.jus.br

Número do Processo: 8161100-67.2024.8.05.0001
Polo Ativo: AUTOR TESTE
Polo Passivo: RÉU TESTE
Classe Judicial: AÇÃO ORDINÁRIA
Órgão: 1ª VARA CÍVEL
Data de Autuação: 15/01/2024
Tipo de Distribuição: livre
Assunto: Danos Morais
`;

      const results = parser.tryParse(emailText);

      expect(results).toHaveLength(1);
      const result = results[0];
      
      expect(result.processNumber).toBe('8161100-67.2024.8.05.0001');
      expect(result.activeParty).toBe('AUTOR TESTE');
      expect(result.passiveParty).toBe('RÉU TESTE');
      expect(result.legalClass).toBe('AÇÃO ORDINÁRIA');
      expect(result.court).toBe('1ª VARA CÍVEL');
      expect(result.distributionType).toBe('livre');
      expect(result.processSubject).toBe('Danos Morais');
      
      expect(result.filingDate).toBeInstanceOf(Date);
      expect(result.filingDate?.getDate()).toBe(15);
      expect(result.filingDate?.getMonth()).toBe(0); // janeiro = mês 0
      expect(result.filingDate?.getFullYear()).toBe(2024);
    });

    it('deve extrair dados quando só houver emailHtml (sem emailText)', () => {
      // Simula o caso real onde o email é multipart/mixed com apenas HTML
      const emailText = ''; // vazio!
      const emailHtml = `TJBA<br/><br/>PJe Push - Serviço de Acompanhamento automático de processos<br/><br/>Prezado(a) ALEXNALDO CARVALHO DOS SANTOS, <br/><br/>Informamos que o processo a seguir sofreu movimentação:<br/>Número do Processo: 8161100-67.2024.8.05.0001<br/>Polo Ativo: JENILDO GOES DOS SANTOS<br/>Polo Passivo: ESTADO DA BAHIA<br/>Classe Judicial: PROCEDIMENTO DO JUIZADO ESPECIAL DA FAZENDA PÚBLICA<br/>Órgão: 2ª V DO SISTEMA DOS JUIZADOS ESPECIAIS DA FAZENDA PÚBLICA<br/>Data de Autuação: 31/10/2024<br/>Tipo de Distribuição: sorteio<br/>Assunto: Gratificações e Adicionais<br/>`;

      const results = parser.tryParse(emailText, emailHtml);

      expect(results).toHaveLength(1);
      
      const result = results[0];
      expect(result.processNumber).toBe('8161100-67.2024.8.05.0001');
      expect(result.activeParty).toBe('JENILDO GOES DOS SANTOS');
      expect(result.passiveParty).toBe('ESTADO DA BAHIA');
      expect(result.legalClass).toBe('PROCEDIMENTO DO JUIZADO ESPECIAL DA FAZENDA PÚBLICA');
      expect(result.court).toBe('2ª V DO SISTEMA DOS JUIZADOS ESPECIAIS DA FAZENDA PÚBLICA');
      expect(result.distributionType).toBe('sorteio');
      expect(result.processSubject).toBe('Gratificações e Adicionais');
      
      expect(result.filingDate).toBeInstanceOf(Date);
      expect(result.filingDate?.getDate()).toBe(31);
      expect(result.filingDate?.getMonth()).toBe(9); // outubro
      expect(result.filingDate?.getFullYear()).toBe(2024);
    });
  });
});
