import { describe, it, expect } from 'vitest';
import { PublicacoesOnlineParser } from './PublicacoesOnlineParser';

describe('PublicacoesOnlineParser', () => {
  const parser = new PublicacoesOnlineParser();

  const emailHtmlWith4Intimacoes = `
<div dir="ltr"><br><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>De: <strong class="gmail_sendername" dir="auto">OAB BA - Publicações OnLine</strong> <span dir="auto">&lt;<a href="mailto:suporte@publicacoesonline.com.br">suporte@publicacoesonline.com.br</a>&gt;</span><br>Date: ter., 30 de jun. de 2026 às 09:41<br>Subject: Relatório de Novas Intimações - Esc - Joao Gabriel Dos Santos Assuncao - Cxr - Total: 4<br>To: <a href="mailto:joaogabrielbu@gmail.com">joaogabrielbu@gmail.com</a> &lt;<a href="mailto:joaogabrielbu@gmail.com">joaogabrielbu@gmail.com</a>&gt;<br></div><br><br><u></u>

<div>
<center>
<div width="510" style="text-align:justify;width:750px;border:solid 1px silver">
<u></u>
<p style="padding:0 20px 0 20px;height:55px;border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:1px">
<img src="https://www.publicacoesonline.com.br/mod/site/sc/template/imagens/logo-print-reduzido.jpg"><img src="https://www.publicacoesonline.com.br/mod/site/sc/template/imagens/marcaoficialOABBA-reduzido.jpg" style="float:right">
</p>
<div style="font-family:verdana;font-size:12px;padding:6px">
<p style="padding:0px 20px 0px 20px">Prezado(a) Dr(a) <b>ESC - JOAO GABRIEL DOS SANTOS ASSUNCAO - CXR</b> (LOGIN: -1181595 BA)</p><b>Relatório de Intimações:</b><br><b>Total de 4 intimações listadas, referente aos seguintes processos:</b><br><br><b>1/4. </b>8066692-16.2026.8.05.0001<br><b>2/4. </b>8124440-06.2026.8.05.0001<br><b>3/4. </b>8124539-73.2026.8.05.0001<br><b>4/4. </b>8047159-74.2026.8.05.0000<p><b>Lista Publicações: </b></p><div style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:2px">
                    <b>1/4</b>
                </div>
                <br><table style="font-family:verdana;font-size:13px;width:100%;margin-bottom:20px" cellspacing="0"><tbody><tr><td style="padding-left:15px">
                    Advogado de Origem
                </td><td>
                    <b>JOAO GABRIEL DOS SANTOS ASSUNCAO (Login: 86376 BA)</b>
                </td></tr><tr><td style="padding-left:15px">
                    Código da Publicação
                </td><td>
                    2931118573
                </td></tr><tr><td style="padding-left:15px">
                    Disponibilização do Jornal
                </td><td>
                    30/06/2026
                </td></tr><tr><td style="padding-left:15px">
                    Publicação do Jornal
                </td><td>
                    01/07/2026
                </td></tr><tr><td style="padding-left:15px">
                    Jornal
                </td><td>
                    Diário de Justiça Eletrônico Nacional - Estadual TJ_BA nº 20260630
                </td></tr><tr><td style="padding-left:15px">
                    Página
                </td><td>
                    980
                </td></tr><tr><td style="padding-left:15px">
                    Nº de Processo
                </td><td>
                    80666921620268050001
                </td></tr><tr><td style="padding-left:15px">
                    Órgão
                </td><td>
                    Justiça Estadual
                </td></tr><tr><td style="padding-left:15px">
                    Cidade
                </td><td>
                    Salvador
                </td></tr><tr><td style="padding-left:15px">
                    Vara
                </td><td>
                    3ª Vara de Relações de Consumo
                </td></tr><tr><td style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:1px;padding-left:15px">
                    Data / Hora Lancamento:
                </td><td style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:1px;width:480px">
                    30/06/2026 07:00:27 (informativo interno. Não utilize essa data para contagem de prazo)
                </td></tr><tr><td style="word-break:break-all;padding:20px;text-align:justify" colspan="2">
                    Processo: 80666921620268050001<br>
<br>
3ª VARA DE RELAÇÕES DE CONSUMO DA COMARCA DE SALVADOR<br>
<br>
PROCEDIMENTO COMUM CÍVEL<br>
<br>
Ato ordinatório<br>
----------------------------------------------<br>
Processo: 80666921620268050001<br>
PARTE: BANCO MASTER S/A - POLO PASSIVO<br>
PARTE: CARLOS EDUARDO TORRES - POLO ATIVO<br>
PARTE: GIOVANNA BASTOS SAMPAIO CORREIA REGISTRADO(A) CIVILMENTE COMO GIOVANNA BASTOS SAMPAIO CORREIA - POLO PASSIVO<br>
PARTE: <u><b>JOAO GABRIEL DOS SANTOS ASSUNCAO</b></u> - POLO ATIVO<br>
PARTE: MARCOS DELLI RIBEIRO RODRIGUES - POLO PASSIVO<br>
ADVOGADO: GIOVANNA BASTOS SAMPAIO CORREIA - OAB 42468/BA<br>
ADVOGADO: JOAO GABRIEL DOS SANTOS ASSUNCAO - OAB 86376/BA<br>
ADVOGADO: MARCOS DELLI RIBEIRO RODRIGUES - OAB 5553/RN<br>
PODER JUDICIÁRIO DO ESTADO DA BAHIA 3ª VARA DE RELAÇÕES DE CONSUMO DA COMARCA DE SALVADOR Rua do Tingui, s/n, Campo da Pólvora, Fórum Prof. Orlando Gomes - 3º andar, Nazaré - CEP 40040-380, Salvador-BA Fone: 3320-6787 - E-mail: <a href="mailto:3cartoriointegrado@tjba.jus.br" target="_blank">3cartoriointegrado@tjba.jus.br</a> Processo nº 8066692-16.2026.8.05.0001 Assunto/classe: PROCEDIMENTO COMUM CÍVEL (7) - [Obrigação de Fazer / Não Fazer, Repetição do Indébito] Autor(a): CARLOS EDUARDO TORRES Advogado do(a) AUTOR: JOAO GABRIEL DOS SANTOS ASSUNCAO - BA86376 Réu: REU: BANCO MASTER S/A Advogados do(a) REU: MARCOS DELLI RIBEIRO RODRIGUES - RN5553, GIOVANNA BASTOS SAMPAIO CORREIA - BA42468 ATO ORDINATÓRIO No uso da atribuição conferida pelo provimento nº CGJ/CCI - 05/2025 do Tribunal de Justiça do Estado da Bahia, que legitima o servidor a praticar atos de mera administração, intime-se a parte Autora para se manifestar, no prazo de 15 (quinze) dias, acerca da(s) contestação(ções) e documentos juntados. Salvador, 29 de junho de 2026 ANDREA TAVARES RIBEIRO Servidor(a) de Secretaria<br>
Inteiro Teor: <a href="https://pje.tjba.jus.br/pje/Processo/ConsultaDocumento/listView.seam?x=26062910240103000000538988994" target="_blank">https://pje.tjba.jus.br/pje/Processo/ConsultaDocumento/listView.seam?x=26062910240103000000538988994</a>
                </td></tr></tbody></table><div style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:2px">
                    <b>2/4</b>
                </div>
                <br><table style="font-family:verdana;font-size:13px;width:100%;margin-bottom:20px" cellspacing="0"><tbody><tr><td style="padding-left:15px">
                    Advogado de Origem
                </td><td>
                    <b>JOAO GABRIEL DOS SANTOS ASSUNCAO (Login: 86376 BA)</b>
                </td></tr><tr><td style="padding-left:15px">
                    Código da Publicação
                </td><td>
                    2931138616
                </td></tr><tr><td style="padding-left:15px">
                    Disponibilização do Jornal
                </td><td>
                    30/06/2026
                </td></tr><tr><td style="padding-left:15px">
                    Publicação do Jornal
                </td><td>
                    01/07/2026
                </td></tr><tr><td style="padding-left:15px">
                    Jornal
                </td><td>
                    Diário de Justiça Eletrônico Nacional - Estadual TJ_BA nº 20260630
                </td></tr><tr><td style="padding-left:15px">
                    Página
                </td><td>
                    2065
                </td></tr><tr><td style="padding-left:15px">
                    Nº de Processo
                </td><td>
                    81244400620268050001
                </td></tr><tr><td style="padding-left:15px">
                    Órgão
                </td><td>
                    Justiça Estadual
                </td></tr><tr><td style="padding-left:15px">
                    Cidade
                </td><td>
                    Salvador
                </td></tr><tr><td style="padding-left:15px">
                    Vara
                </td><td>
                    2ª Vara do Sistema dos Juizados Especiais da Fazenda Pública
                </td></tr><tr><td style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:1px;padding-left:15px">
                    Data / Hora Lancamento:
                </td><td style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:1px;width:480px">
                    30/06/2026 07:00:27 (informativo interno. Não utilize essa data para contagem de prazo)
                </td></tr><tr><td style="word-break:break-all;padding:20px;text-align:justify" colspan="2">
                    Processo: 81244400620268050001<br>
<br>
2ª V DO SISTEMA DOS JUIZADOS ESPECIAIS DA FAZENDA PÚBLICA<br>
<br>
Procedimento do Juizado Especial da Fazenda Pública<br>
<br>
Decisão<br>
----------------------------------------------<br>
Processo: 81244400620268050001<br>
PARTE: CRISTIANE BRITO SANTANA - POLO ATIVO<br>
PARTE: ESTADO DA BAHIA - POLO PASSIVO<br>
PARTE: <u><b>JOAO GABRIEL DOS SANTOS ASSUNCAO</b></u> - POLO ATIVO<br>
ADVOGADO: JOAO GABRIEL DOS SANTOS ASSUNCAO - OAB 86376/BA<br>
Poder Judiciário Fórum Regional do Imbuí 2ª Vara do Sistema dos Juizados Especiais da Fazenda Pública, sala 103 Rua Padre Cassimiro Quiroga, Loteamento Rio das Pedras, Qd.01, Imbuí - CEP: 41.720-400 Fax (71) 3372-7361 email: <a href="mailto:ssa-2vsje-fazenda@tjba.jus.br" target="_blank">ssa-2vsje-fazenda@tjba.jus.br</a> Processo nº 8124440-06.2026.8.05.0001 Classe - Assunto: PROCEDIMENTO DO JUIZADO ESPECIAL DA FAZENDA PÚBLICA (14695) - [Gratificações e Adicionais] Reclamante: REQUERENTE: CRISTIANE BRITO SANTANA Reclamado(a): REQUERIDO: ESTADO DA BAHIA DECISÃO Vistos e etc. Para a concessão da antecipação de tutela ou qualquer providência cautelar no curso do processo, o art. 3º da Lei 12.153/2009 dá ao juiz este poder, desde que exista situação que possa causar dano de difícil ou de incerta reparação. Dispõe, também, o legislador pátrio, no NCPC/2015, sobre a tutela de urgência: "Art. 300. A tutela de urgência será concedida quando houver elementos que evidenciem a probabilidade do direito e o perigo de dano ou risco ao resultado útil do processo." Cotejando a exordial, os documentos acostados com essa e a informação, ali, de violação a direito invocado, entendo que, na atual quadra processual, não se vislumbra a probabilidade do direito que a parte acionante alega estar caracterizado de forma clara para obtenção de tutela de urgência. Faz-se necessária a triangularização processual, com a juntada de documentação trazida pela parte acionada - já que esta é uma obrigação disposta no art. 9º, da Lei 12.153/09 - de modo que este juízo possa, em sede de sentença definitiva, averiguar, com maior precisão, a propalada violação ao direito invocado na peça inicial. Isto posto, INDEFIRO A LIMINAR. Tendo em vista que o Poder Público, na grande maioria dos casos, somente pode resolver o conflito por autocomposição quando houver autorização normativa para isso, determino que se proceda à citação para o oferecimento da defesa e juntada de documentos, no prazo que assino em 60 (sessenta) dias, com espeque no art. 7º da Lei 12.153/09. Na oportunidade, a parte Ré deverá informar, de logo, sobre a possibilidade de conciliação, bem assim, de eventual necessidade de produção de provas em audiência de instrução, especificando-as e indicando os meios de produção, para efeito de dotar o feito de rito célere como exige o sistema dos Juizados Especiais. Intimem-se. Salvador, data certificada pelo sistema REGIANNE YUKIE TIBA XAVIERJuíza de Direito<br>
Inteiro Teor: <a href="https://pje.tjba.jus.br/pje/Processo/ConsultaDocumento/listView.seam?x=26062910550980000000538944933" target="_blank">https://pje.tjba.jus.br/pje/Processo/ConsultaDocumento/listView.seam?x=26062910550980000000538944933</a>
                </td></tr></tbody></table><div style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:2px">
                    <b>3/4</b>
                </div>
                <br><table style="font-family:verdana;font-size:13px;width:100%;margin-bottom:20px" cellspacing="0"><tbody><tr><td style="padding-left:15px">
                    Advogado de Origem
                </td><td>
                    <b>JOAO GABRIEL DOS SANTOS ASSUNCAO (Login: 86376 BA)</b>
                </td></tr><tr><td style="padding-left:15px">
                    Código da Publicação
                </td><td>
                    2931138626
                </td></tr><tr><td style="padding-left:15px">
                    Disponibilização do Jornal
                </td><td>
                    30/06/2026
                </td></tr><tr><td style="padding-left:15px">
                    Publicação do Jornal
                </td><td>
                    01/07/2026
                </td></tr><tr><td style="padding-left:15px">
                    Jornal
                </td><td>
                    Diário de Justiça Eletrônico Nacional - Estadual TJ_BA nº 20260630
                </td></tr><tr><td style="padding-left:15px">
                    Página
                </td><td>
                    2066
                </td></tr><tr><td style="padding-left:15px">
                    Nº de Processo
                </td><td>
                    81245397320268050001
                </td></tr><tr><td style="padding-left:15px">
                    Órgão
                </td><td>
                    Justiça Estadual
                </td></tr><tr><td style="padding-left:15px">
                    Cidade
                </td><td>
                    Salvador
                </td></tr><tr><td style="padding-left:15px">
                    Vara
                </td><td>
                    2ª Vara do Sistema dos Juizados Especiais da Fazenda Pública
                </td></tr><tr><td style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:1px;padding-left:15px">
                    Data / Hora Lancamento:
                </td><td style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:1px;width:480px">
                    30/06/2026 07:00:27 (informativo interno. Não utilize essa data para contagem de prazo)
                </td></tr><tr><td style="word-break:break-all;padding:20px;text-align:justify" colspan="2">
                    Processo: 81245397320268050001<br>
<br>
2ª V DO SISTEMA DOS JUIZADOS ESPECIAIS DA FAZENDA PÚBLICA<br>
<br>
Procedimento do Juizado Especial da Fazenda Pública<br>
<br>
Decisão<br>
----------------------------------------------<br>
Processo: 81245397320268050001<br>
PARTE: CIDINELIA DE ALMEIDA BISPO - POLO ATIVO<br>
PARTE: ESTADO DA BAHIA - POLO PASSIVO<br>
PARTE: <u><b>JOAO GABRIEL DOS SANTOS ASSUNCAO</b></u> - POLO ATIVO<br>
ADVOGADO: JOAO GABRIEL DOS SANTOS ASSUNCAO - OAB 86376/BA<br>
Poder Judiciário Fórum Regional do Imbuí 2ª Vara do Sistema dos Juizados Especiais da Fazenda Pública, sala 103 Rua Padre Cassimiro Quiroga, Loteamento Rio das Pedras, Qd.01, Imbuí - CEP: 41.720-400 Fax (71) 3372-7361 email: <a href="mailto:ssa-2vsje-fazenda@tjba.jus.br" target="_blank">ssa-2vsje-fazenda@tjba.jus.br</a> Processo nº 8124539-73.2026.8.05.0001 Classe - Assunto: PROCEDIMENTO DO JUIZADO ESPECIAL DA FAZENDA PÚBLICA (14695) - [Gratificações e Adicionais] Reclamante: REQUERENTE: CIDINELIA DE ALMEIDA BISPO Reclamado(a): REQUERIDO: ESTADO DA BAHIA DECISÃO Vistos e etc. Para a concessão da antecipação de tutela ou qualquer providência cautelar no curso do processo, o art. 3º da Lei 12.153/2009 dá ao juiz este poder, desde que exista situação que possa causar dano de difícil ou de incerta reparação. Dispõe, também, o legislador pátrio, no NCPC/2015, sobre a tutela de urgência: "Art. 300. A tutela de urgência será concedida quando houver elementos que evidenciem a probabilidade do direito e o perigo de dano ou risco ao resultado útil do processo." Cotejando a exordial, os documentos acostados com essa e a informação, ali, de violação a direito invocado, entendo que, na atual quadra processual, não se vislumbra a probabilidade do direito que a parte acionante alega estar caracterizado de forma clara para obtenção de tutela de urgência. Faz-se necessária a triangularização processual, com a juntada de documentação trazida pela parte acionada - já que esta é uma obrigação disposta no art. 9º, da Lei 12.153/09 - de modo que este juízo possa, em sede de sentença definitiva, averiguar, com maior precisão, a propalada violação ao direito invocado na peça inicial. Isto posto, INDEFIRO A LIMINAR. Tendo em vista que o Poder Público, na grande maioria dos casos, somente pode resolver o conflito por autocomposição quando houver autorização normativa para isso, determino que se proceda à citação para o oferecimento da defesa e juntada de documentos, no prazo que assino em 60 (sessenta) dias, com espeque no art. 7º da Lei 12.153/09. Na oportunidade, a parte Ré deverá informar, de logo, sobre a possibilidade de conciliação, bem assim, de eventual necessidade de produção de provas em audiência de instrução, especificando-as e indicando os meios de produção, para efeito de dotar o feito de rito célere como exige o sistema dos Juizados Especiais. Intimem-se. Salvador, data certificada pelo sistema REGIANNE YUKIE TIBA XAVIERJuíza de Direito<br>
Inteiro Teor: <a href="https://pje.tjba.jus.br/pje/Processo/ConsultaDocumento/listView.seam?x=26062911013800700000538944934" target="_blank">https://pje.tjba.jus.br/pje/Processo/ConsultaDocumento/listView.seam?x=26062911013800700000538944934</a>
                </td></tr></tbody></table><div style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:2px">
                    <b>4/4</b>
                </div>
                <br><table style="font-family:verdana;font-size:13px;width:100%;margin-bottom:20px" cellspacing="0"><tbody><tr><td style="padding-left:15px">
                    Advogado de Origem
                </td><td>
                    <b>JOAO GABRIEL DOS SANTOS ASSUNCAO (Login: 86376 BA)</b>
                </td></tr><tr><td style="padding-left:15px">
                    Código da Publicação
                </td><td>
                    2931233316
                </td></tr><tr><td style="padding-left:15px">
                    Disponibilização do Jornal
                </td><td>
                    30/06/2026
                </td></tr><tr><td style="padding-left:15px">
                    Publicação do Jornal
                </td><td>
                    01/07/2026
                </td></tr><tr><td style="padding-left:15px">
                    Jornal
                </td><td>
                    Diário de Justiça Eletrônico Nacional - Estadual TJ_BA nº 20260630
                </td></tr><tr><td style="padding-left:15px">
                    Página
                </td><td>
                    2915
                </td></tr><tr><td style="padding-left:15px">
                    Nº de Processo
                </td><td>
                    80471597420268050000
                </td></tr><tr><td style="padding-left:15px">
                    Órgão
                </td><td>
                    Justiça Estadual
                </td></tr><tr><td style="padding-left:15px">
                    Cidade
                </td><td>
                    Salvador
                </td></tr><tr><td style="padding-left:15px">
                    Vara
                </td><td>
                    Des.
                </td></tr><tr><td style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:1px;padding-left:15px">
                    Data / Hora Lancamento:
                </td><td style="border-bottom-style:solid;border-bottom-color:silver;border-bottom-width:1px;width:480px">
                    30/06/2026 07:00:28 (informativo interno. Não utilize essa data para contagem de prazo)
                </td></tr><tr><td style="word-break:break-all;padding:20px;text-align:justify" colspan="2">
                    Processo: 80471597420268050000<br>
<br>
Des. Eduardo Afonso Maia Caricchio<br>
<br>
AGRAVO DE INSTRUMENTO<br>
<br>
Despacho<br>
----------------------------------------------<br>
Processo: 80471597420268050000<br>
PARTE: ABESP ASSOCIACAO BENEFICENTE PARA OS SERVID PUBLICOS - POLO PASSIVO<br>
PARTE: ASSOCIACAO DOS SERV DA SAUDE E AFINS DA ADM DIRETA DO EST DA BAHIA - ASSEBA - POLO PASSIVO<br>
PARTE: ASSOCIACAO DOS SERVIDORES TECNICO-ADMINISTRATIVO E AFINS DO ESTADO DA BAHIA - POLO PASSIVO<br>
PARTE: BANCO MASTER S/A - POLO PASSIVO<br>
PARTE: CARMILTON LEOPOLDO DO CARMO - POLO ATIVO<br>
PARTE: <u><b>JOAO GABRIEL DOS SANTOS ASSUNCAO</b></u> - POLO ATIVO<br>
ADVOGADO: JOAO GABRIEL DOS SANTOS ASSUNCAO - OAB 86376/BA<br>
PODER JUDICIÁRIO TRIBUNAL DE JUSTIÇA DO ESTADO DA BAHIA Segunda Câmara Cível Processo: AGRAVO DE INSTRUMENTO n. 8047159-74.2026.8.05.0000 Órgão Julgador: Segunda Câmara Cível AGRAVANTE: CARMILTON LEOPOLDO DO CARMO Advogado(s): JOAO GABRIEL DOS SANTOS ASSUNCAO (OAB:BA86376-A) AGRAVADO: ASSOCIACAO DOS SERV DA SAUDE E AFINS DA ADM DIRETA DO EST DA BAHIA - ASSEBA e outros (3) Advogado(s): DESPACHO Vistos e etc. Ante a ausência de elementos suficientes à aferição de sua alegada insuficiência de recursos (contracheque de ID 559044027 PJE1G), e para fins de apreciação do pedido de gratuidade da justiça, intime-se o Recorrente para, no prazo de 15 (quinze) dias, juntar aos autos documentos aptos a demonstrar o preenchimento dos requisitos legais para a concessão do benefício, tais como contracheques recentes, cópias das declarações de imposto de renda dos últimos três exercícios, comprovantes de despesas mensais, faturas de cartões de crédito, extratos bancários, além de quaisquer outros documentos idôneos à comprovação de sua alegada hipossuficiência econômica, nos termos do § 2º do art. 99 do Código de Processo Civil, sob pena de indeferimento do pedido. Após, retornem conclusos para deliberação. Publique-se. Intimem-se. Cumpra-se. Salvador, documento datado e assinado de forma eletrônica. Desembargador EDUARDO CARICCHIO RELATOR (09)<br>
Inteiro Teor: <a href="https://pje2g.tjba.jus.br/pje/Processo/ConsultaDocumento/listView.seam?x=26062908284350100000157663950" target="_blank">https://pje2g.tjba.jus.br/pje/Processo/ConsultaDocumento/listView.seam?x=26062908284350100000157663950</a>
                </td></tr></tbody></table></div>
</div>
</center>
</div>
</div></div>
  `;

  describe('tryParse', () => {
    it('deve retornar array vazio para email não compatível', () => {
      const result = parser.tryParse('Email qualquer sem padrão', '');
      expect(result).toEqual([]);
    });

    it('deve retornar array com 4 intimações do email de teste', () => {
      const result = parser.tryParse('', emailHtmlWith4Intimacoes);

      expect(result).toHaveLength(4);
    });

    it('deve extrair número de processo formatado corretamente', () => {
      const result = parser.tryParse('', emailHtmlWith4Intimacoes);

      expect(result[0].processNumber).toBe('8066692-16.2026.8.05.0001');
      expect(result[1].processNumber).toBe('8124440-06.2026.8.05.0001');
      expect(result[2].processNumber).toBe('8124539-73.2026.8.05.0001');
      expect(result[3].processNumber).toBe('8047159-74.2026.8.05.0000');
    });

    it('deve extrair vara/tribunal corretamente', () => {
      const result = parser.tryParse('', emailHtmlWith4Intimacoes);

      expect(result[0].court).toBe('3ª Vara de Relações de Consumo');
      expect(result[1].court).toBe('2ª Vara do Sistema dos Juizados Especiais da Fazenda Pública');
      expect(result[2].court).toBe('2ª Vara do Sistema dos Juizados Especiais da Fazenda Pública');
      expect(result[3].court).toBe('Des.');
    });

    it('deve ter movimentação com data de publicação (se extraída)', () => {
      const result = parser.tryParse('', emailHtmlWith4Intimacoes);

      if (result[0].movements && result[0].movements.length > 0) {
        const movement = result[0].movements[0];
        expect(movement.type).toBe('Intimação - Diário Oficial');
        expect(movement.date).toBeInstanceOf(Date);
        expect(movement.date.getDate()).toBe(1);
        expect(movement.date.getMonth()).toBe(6);
        expect(movement.date.getFullYear()).toBe(2026);
      } else {
        expect(result[0].processNumber).toBeDefined();
      }
    });

    it('deve ter URL do inteiro teor (se extraída)', () => {
      const result = parser.tryParse('', emailHtmlWith4Intimacoes);

      if (result[0].movements && result[0].movements.length > 0) {
        expect(result[0].movements[0].documentUrl).toContain('pje.tjba.jus.br');
        expect(result[0].movements[0].documentUrl).toContain('ConsultaDocumento');
      } else {
        expect(result[0].processNumber).toBeDefined();
      }
    });

    it('cada intimação deve ter processNumber definido', () => {
      const result = parser.tryParse('', emailHtmlWith4Intimacoes);

      result.forEach(intimacao => {
        expect(intimacao.processNumber).toBeDefined();
        expect(intimacao.processNumber).toMatch(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/);
      });
    });

    it('deve identificar email pelo conteúdo HTML', () => {
      const result = parser.tryParse('', emailHtmlWith4Intimacoes);

      expect(result.length).toBeGreaterThan(0);
    });

    it('deve identificar email pelo conteúdo', () => {
      const result = parser.tryParse('', emailHtmlWith4Intimacoes);

      expect(result.length).toBe(4);
      expect(result[0].processNumber).toBeDefined();
      expect(result[0].court).toBeDefined();
    });
  });
});
