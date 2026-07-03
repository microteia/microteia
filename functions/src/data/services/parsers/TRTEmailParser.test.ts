import { describe, it, expect } from 'vitest';
import { TRTEmailParser } from './TRTEmailParser';

describe('TRTEmailParser', () => {
  const parser = new TRTEmailParser();

  describe('name', () => {
    it('deve ter o nome correto', () => {
      expect(parser.name).toBe('TRT');
    });
  });

  describe('tryParse', () => {
    it('deve extrair dados de email PJe TRT5 com eventos', () => {
      const emailHtml = `<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description"
        content="Acompanhamento de atualizações de movimentações processuais do PJe da Justiça do Trabalho - Tribunal do Trabalho">
    <title>Processo Judicial Eletrônico - Atualizações de Informações Processuais - Processo
        0000278-13.2026.5.05.0038</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            text-decoration: none;
        }

        body {
            background: #fff;
            font-size: 100%;
        }

        table {
            color: #000;
            font-size: 18px;
            font-weight: 300;
        }

        td {
            padding: 5px;
            text-align: center;
        }

        tr {
            padding: 5px;
        }

        .conteudo {
            margin-bottom: 48px;
        }

        .conteudo-secundario-titulo {
            color: #000;
            font-size: 24px;
            font-weight: 400;
            margin-bottom: 16px;
        }

        .conteudo-secundario-paragrafo {
            color: #000;
            font-size: 18px;
            font-weight: 300;
        }

        .rodape {
            text-align: center;
        }
    </style>
</head>

<body>

    <div class="conteudo">
        <h3 class="conteudo-secundario-titulo">Processo Judicial Eletrônico</h3>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>Tribunal Regional do Trabalho da 5ª Região - 1º Grau</strong></p>
		<br/>
		<br/>
        <p class="conteudo-secundario-paragrafo">Acompanhamento de
            <strong>Atualizações de Informações Processuais</strong>
        </p>
		<br/>
		<br/>
        <p class="conteudo-secundario-paragrafo">Prezado(a)
            <strong>ALEXNALDO CARVALHO DOS SANTOS</strong>,
        </p>
		<br/>
		<br/>
        <p class="conteudo-secundario-paragrafo">Informamos que o processo a seguir sofreu movimentação:</p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>Número do Processo:</strong> 0000278-13.2026.5.05.0038
        </p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>Classe Judicial:</strong> Ação Trabalhista - Rito Sumaríssimo</p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>Órgão Julgador:</strong> 38ª Vara do Trabalho de Salvador</p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>Data de Autuação:</strong> 08/04/2026 13:30:26
        </p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>Autor:</strong>
            ALEXNALDO CARVALHO DOS SANTOS</p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>Advogados do Autor:</strong>
            ALEXNALDO CARVALHO DOS SANTOS, OAB: 56834</p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>Réu:</strong>
            SINDICATO DOS EMPREGADOS EM EMPRESAS DE PROCESSAMENTO DE DADOS, SERV COMP, INFORM TEC. INFORM E TRAB PROCESS DADOS, SERV COMP, INFORM E TEC INFORM ESP</p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>Advogados do Réu:</strong>
            AUGUSTA DE RAEFFRAY BARBOSA GHERARDI, OAB: 24026
THIAGO ALVES DE LIMA, OAB: 369801</p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>Eventos:</strong></p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><table><tbody><tr><td><strong>Data</strong></td><td><strong>Evento</strong></td></tr><tr><td>02/07/2026 10:57</td><td>Juntada a petição de Manifestação</td></tr><tr><td>02/07/2026 10:57</td><td>Documento sigiloso</td></tr><tr><td>02/07/2026 10:55</td><td>Juntada a petição de Manifestação</td></tr><tr><td>02/07/2026 10:55</td><td>Documento sigiloso</td></tr></tbody></table></p>
		<br/>
        <p class="conteudo-secundario-paragrafo"></p>
		<br/>
        <p class="conteudo-secundario-paragrafo">Para acessar este processo na consulta pública, clique em
            <strong><a href="https://pje.trt5.jus.br/consultaprocessual/">https://pje.trt5.jus.br/consultaprocessual/</a>.</strong>
        </p>
		<br/>
        <p class="conteudo-secundario-paragrafo"></p>
		<br/>
        <p class="conteudo-secundario-paragrafo">Caso não tenha mais interesse em receber o push para este processo,
            favor acessar o link <strong><a
                    href="https://pje.trt5.jus.br/push">https://pje.trt5.jus.br/push</a>.</strong>
        </p>
		<br/>
        <p class="conteudo-secundario-paragrafo"></p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>ATENÇÃO: este e-mail é gerado de forma automatizada, por
                gentileza, não o responda.</strong></p>
		<br/>
    </div>
	
	<br/>
	
    <div class="rodape">
        <p class="conteudo-secundario-paragrafo"><strong>-1</strong></p>
		<br/>
        <p class="conteudo-secundario-paragrafo"><strong>-1</strong></p>
		<br/>
    </div>

</body>

</html>`;

      const results = parser.tryParse('', emailHtml);

      expect(results).toHaveLength(1);
      
      const result = results[0];
      expect(result.processNumber).toBe('0000278-13.2026.5.05.0038');
      expect(result.activeParty).toBe('ALEXNALDO CARVALHO DOS SANTOS');
      expect(result.passiveParty).toContain('SINDICATO DOS EMPREGADOS EM EMPRESAS DE PROCESSAMENTO DE DADOS');
      expect(result.legalClass).toBe('Ação Trabalhista - Rito Sumaríssimo');
      expect(result.court).toBe('38ª Vara do Trabalho de Salvador');
      
      expect(result.filingDate).toBeInstanceOf(Date);
      expect(result.filingDate?.getDate()).toBe(8);
      expect(result.filingDate?.getMonth()).toBe(3); // abril = mês 3 (0-indexed)
      expect(result.filingDate?.getFullYear()).toBe(2026);
      expect(result.filingDate?.getHours()).toBe(13);
      expect(result.filingDate?.getMinutes()).toBe(30);
      expect(result.filingDate?.getSeconds()).toBe(26);

      // Verificar movimentos
      expect(result.movements).toBeDefined();
      expect(result.movements?.length).toBeGreaterThan(0);
      
      if (result.movements && result.movements.length > 0) {
        const firstMovement = result.movements[0];
        expect(firstMovement.description).toBe('Juntada a petição de Manifestação');
        expect(firstMovement.date).toBeInstanceOf(Date);
        expect(firstMovement.date.getDate()).toBe(2);
        expect(firstMovement.date.getMonth()).toBe(6); // julho = mês 6 (0-indexed)
        expect(firstMovement.date.getFullYear()).toBe(2026);
        expect(firstMovement.date.getHours()).toBe(10);
        expect(firstMovement.date.getMinutes()).toBe(57);
      }
    });

    it('deve retornar array vazio para email não-TRT', () => {
      const emailText = `
From: outro@example.com
Subject: Outro assunto

Conteúdo não relacionado ao TRT.
`;

      const results = parser.tryParse(emailText);

      expect(results).toEqual([]);
    });

    it('deve retornar erro de parsing quando não encontrar número do processo', () => {
      const emailText = `
Tribunal Regional do Trabalho da 5ª Região

PJe Push

Email sem número de processo.
`;

      const results = parser.tryParse(emailText);

      expect(results).toHaveLength(1);
      expect(results[0].parsingError).toBe('Número do processo não encontrado');
      expect(results[0].processNumber).toBeUndefined();
    });

    it('deve identificar email TRT pelo domínio nao-responda-pje@trtX.jus.br', () => {
      const emailText = `
From: nao-responda-pje@trt5.jus.br
Subject: Teste

Número do Processo: 0000123-45.2026.5.05.0001
`;

      const results = parser.tryParse(emailText);

      expect(results).toHaveLength(1);
      expect(results[0].processNumber).toBe('0000123-45.2026.5.05.0001');
    });

    it('deve identificar email TRT por padrão de número de processo (5.XX indica Justiça do Trabalho)', () => {
      const emailHtml = `
<html>
<body>
  <p>Processo: 1234567-89.2026.5.12.0038</p>
</body>
</html>
`;

      const results = parser.tryParse('', emailHtml);

      expect(results).toHaveLength(1);
      expect(results[0].processNumber).toBe('1234567-89.2026.5.12.0038');
    });

    it('deve identificar email TRT pela tag [TRT] no assunto', () => {
      const emailHtml = `
<html>
<body>
  <p>Subject: [TRT5] [PUSH] Atualizações</p>
  <p>Número do Processo: 0000278-13.2026.5.05.0038</p>
</body>
</html>
`;

      const results = parser.tryParse('', emailHtml);

      expect(results).toHaveLength(1);
      expect(results[0].processNumber).toBe('0000278-13.2026.5.05.0038');
    });
  });
});
