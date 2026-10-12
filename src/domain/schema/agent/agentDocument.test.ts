import { describe, expect, it } from 'vitest';
import {
  AGENT_DOCUMENT_MAX_BYTES,
  agentDocumentContentType,
  agentDocumentName,
  agentDocumentStoragePath,
  inspectAgentFileContent,
  resolveAgentDocumentType,
} from './agentDocument';
import { DECLARED_LOOKUP_OPTIONS } from '../lookupDefaults';

const base64Of = (text: string): string => btoa(text);

describe('o conteúdo do anexo', () => {
  it('aceita base64 e mede o arquivo sem decodificá-lo', () => {
    const outcome = inspectAgentFileContent(base64Of('hello'));
    expect(outcome).toEqual({ ok: true, base64: base64Of('hello'), size: 5 });
  });

  it('aceita o prefixo data: e usa o tipo declarado nele', () => {
    const outcome = inspectAgentFileContent(`data:application/pdf;base64,${base64Of('%PDF-1.4')}`);
    expect(outcome).toMatchObject({ ok: true, size: 8, contentType: 'application/pdf' });
  });

  it('ignora quebras de linha do base64 com MIME', () => {
    const encoded = base64Of('abcdefghijkl');
    expect(inspectAgentFileContent(`${encoded.slice(0, 8)}\n${encoded.slice(8)}`)).toMatchObject({ ok: true, size: 12 });
  });

  it('recusa o que não é base64', () => {
    expect(inspectAgentFileContent('not base64!')).toEqual({ ok: false, reason: 'not-base64' });
    expect(inspectAgentFileContent('abc')).toEqual({ ok: false, reason: 'not-base64' });
  });

  it('recusa o arquivo vazio', () => {
    expect(inspectAgentFileContent('')).toEqual({ ok: false, reason: 'empty' });
    expect(inspectAgentFileContent('data:text/plain;base64,')).toEqual({ ok: false, reason: 'empty' });
  });

  it('recusa no MESMO teto da regra do Storage, que é estrito', () => {
    const atLimit = 'A'.repeat(Math.ceil(AGENT_DOCUMENT_MAX_BYTES / 3) * 4);
    expect(inspectAgentFileContent(atLimit)).toMatchObject({ ok: false, reason: 'too-large' });

    const underLimit = 'A'.repeat(Math.floor((AGENT_DOCUMENT_MAX_BYTES - 1) / 3) * 4);
    expect(inspectAgentFileContent(underLimit)).toMatchObject({ ok: true });
  });
});

describe('o nome e o caminho do anexo', () => {
  it('guarda só o nome, sem as pastas de quem enviou', () => {
    expect(agentDocumentName('C:\\docs\\contrato.pdf')).toBe('contrato.pdf');
    expect(agentDocumentName('../../outro/registro.pdf')).toBe('registro.pdf');
    expect(agentDocumentName('  laudo.pdf ')).toBe('laudo.pdf');
  });

  it('recusa o nome que não sobra', () => {
    expect(agentDocumentName('')).toBeNull();
    expect(agentDocumentName('pasta/')).toBeNull();
    expect(agentDocumentName('..')).toBeNull();
  });

  it('grava no mesmo caminho do upload da tela', () => {
    expect(agentDocumentStoragePath('t1', 'clientes', 'r1', 'meu contrato.pdf', 1700000000000))
      .toBe('tenants/t1/clientes/r1/1700000000000_meu_contrato.pdf');
  });

  it('o tipo declarado vence; sem ele, vale o da extensão', () => {
    expect(agentDocumentContentType('a.pdf')).toBe('application/pdf');
    expect(agentDocumentContentType('A.JPG')).toBe('image/jpeg');
    expect(agentDocumentContentType('a.pdf', 'application/x-custom')).toBe('application/x-custom');
    expect(agentDocumentContentType('sem-extensao')).toBe('application/octet-stream');
  });
});

describe('o tipo do documento', () => {
  const options = [
    ...DECLARED_LOOKUP_OPTIONS.documentTypes,
    { key: 'laudo_medico', label: 'Laudo médico' },
  ];

  it('casa pela chave, que é o que a tela grava', () => {
    expect(resolveAgentDocumentType(options, 'laudo_medico')).toBe('laudo_medico');
  });

  it('casa pelo rótulo, sem diferenciar maiúsculas, e devolve a chave', () => {
    expect(resolveAgentDocumentType(options, 'laudo MÉDICO')).toBe('laudo_medico');
  });

  it('não inventa tipo', () => {
    expect(resolveAgentDocumentType(options, 'Boleto')).toBeNull();
  });
});
