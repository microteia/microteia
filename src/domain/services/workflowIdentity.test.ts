import { describe, expect, it } from 'vitest';
import { deriveWorkflowId, workflowIdIssue } from './workflowIdentity';

describe('workflowIdIssue', () => {
  it('aceita um nome curto em minúsculas com hífen', () => {
    expect(workflowIdIssue('avisar-cliente')).toBeUndefined();
  });

  it('recusa vazio, maiúsculas, espaço, símbolo e início por número', () => {
    expect(workflowIdIssue('')).toBeTruthy();
    expect(workflowIdIssue('Avisar')).toBeTruthy();
    expect(workflowIdIssue('avisar cliente')).toBeTruthy();
    expect(workflowIdIssue('avisar_cliente')).toBeTruthy();
    expect(workflowIdIssue('1-avisar')).toBeTruthy();
  });

  it('recusa um identificador já usado', () => {
    expect(workflowIdIssue('avisar', new Set(['avisar']))).toContain('Já existe');
  });
});

describe('deriveWorkflowId', () => {
  it('tira acento, espaço e símbolo do nome', () => {
    expect(deriveWorkflowId('Avisar Cliente')).toBe('avisar-cliente');
    expect(deriveWorkflowId('Ativar/Inativar Pessoa')).toBe('ativar-inativar-pessoa');
    expect(deriveWorkflowId('Prazo — 5 dias!')).toBe('prazo-5-dias');
  });

  it('desempata com sufixo, como o resto da plataforma', () => {
    expect(deriveWorkflowId('Avisar cliente', new Set(['avisar-cliente']))).toBe('avisar-cliente-2');
  });

  it('nome que não produz identificador válido ganha prefixo', () => {
    expect(workflowIdIssue(deriveWorkflowId('123'))).toBeUndefined();
    expect(workflowIdIssue(deriveWorkflowId('!!!'))).toBeUndefined();
  });

  it('o resultado sempre passa na própria validação', () => {
    for (const name of ['Ação', 'a', 'ÁÉÍ ÓÚ', 'workflow 2 — teste']) {
      expect(workflowIdIssue(deriveWorkflowId(name))).toBeUndefined();
    }
  });
});
