import { describe, it, expect } from 'vitest';
import {
  decodeHtmlEntities,
  htmlToText,
  labeledValue,
  formatCNJ,
  findCNJ,
  hasCNJ,
  parseBrDate,
  parseExtenseDate,
  stripAccents,
} from './emailParsingUtils';

describe('emailParsingUtils', () => {
  describe('decodeHtmlEntities', () => {
    it('decodifica entidades nomeadas Latin-1', () => {
      expect(decodeHtmlEntities('Publica&ccedil;&atilde;o do Jornal')).toBe('Publicação do Jornal');
      expect(decodeHtmlEntities('N&ordm; de Processo')).toBe('Nº de Processo');
      expect(decodeHtmlEntities('MINIST&Eacute;RIO P&Uacute;BLICO')).toBe('MINISTÉRIO PÚBLICO');
    });

    it('decodifica entidades numéricas decimais e hexadecimais', () => {
      expect(decodeHtmlEntities('&#233;poca &#xe9;poca')).toBe('época época');
    });

    it('mantém entidades desconhecidas em vez de apagá-las', () => {
      expect(decodeHtmlEntities('a &desconhecida; b')).toBe('a &desconhecida; b');
    });
  });

  describe('htmlToText', () => {
    it('converte <br> e tags de bloco em quebras de linha e decodifica entidades', () => {
      const html = 'Classe Judicial: MANDADO DE SEGURAN&Ccedil;A<br/>&Oacute;rg&atilde;o: Vara';
      expect(htmlToText(html)).toBe('Classe Judicial: MANDADO DE SEGURANÇA\nÓrgão: Vara');
    });

    it('remove comentários HTML', () => {
      expect(htmlToText('a<!-- comentário -->b')).toBe('ab');
    });
  });

  describe('labeledValue', () => {
    it('extrai valor na mesma linha', () => {
      expect(labeledValue('Número do Processo: 8052066-63.2024.8.05.0000', 'Número do Processo'))
        .toBe('8052066-63.2024.8.05.0000');
    });

    it('extrai valor na linha seguinte (layout de tabela)', () => {
      expect(labeledValue('Vara\n9ª Vara da Família\nCidade\nSalvador', 'Vara'))
        .toBe('9ª Vara da Família');
    });

    it('é tolerante a acento no rótulo (mojibake)', () => {
      expect(labeledValue('Org�o: Justiça Estadual', 'Órgão')).toBe('Justiça Estadual');
    });
  });

  describe('CNJ', () => {
    it('formata número cru de 20 dígitos no padrão CNJ', () => {
      expect(formatCNJ('81224221220268050001')).toBe('8122422-12.2026.8.05.0001');
    });

    it('mantém número já mascarado', () => {
      expect(formatCNJ('8122422-12.2026.8.05.0001')).toBe('8122422-12.2026.8.05.0001');
    });

    it('encontra CNJ mascarado ou cru', () => {
      expect(findCNJ('Processo 0070169-09.2014.8.05.0001 aqui')).toBe('0070169-09.2014.8.05.0001');
      expect(findCNJ('Proc 81224221220268050001 aqui')).toBe('8122422-12.2026.8.05.0001');
    });

    it('hasCNJ detecta presença de número de processo', () => {
      expect(hasCNJ('nenhum processo aqui')).toBe(false);
      expect(hasCNJ('proc 0070169-09.2014.8.05.0001')).toBe(true);
      expect(hasCNJ('proc 81224221220268050001')).toBe(true);
    });
  });

  describe('datas', () => {
    it('parseBrDate lê DD/MM/YYYY com hora opcional', () => {
      const d = parseBrDate('19/08/2024');
      expect(d?.getFullYear()).toBe(2024);
      expect(d?.getMonth()).toBe(7);
      expect(d?.getDate()).toBe(19);
    });

    it('parseExtenseDate lê "4 de Novembro de 2015"', () => {
      const d = parseExtenseDate('4 de Novembro de 2015 às 10:00');
      expect(d?.getFullYear()).toBe(2015);
      expect(d?.getMonth()).toBe(10);
      expect(d?.getDate()).toBe(4);
    });
  });

  describe('stripAccents', () => {
    it('remove acentos', () => {
      expect(stripAccents('Órgão Público')).toBe('Orgao Publico');
    });
  });
});
