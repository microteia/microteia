import { describe, expect, it } from 'vitest';
import { deriveArtifactId, artifactIdIssue, installedArtifactId } from './artifactIdentity';

/** O tradutor de teste devolve a própria chave. */
const echo = (key: string) => key;

describe('artifactIdIssue', () => {
  it('aceita um nome curto em minúsculas com hífen', () => {
    expect(artifactIdIssue(echo, 'avisar-cliente')).toBeUndefined();
  });

  it('recusa vazio, maiúsculas, espaço, símbolo e início por número', () => {
    expect(artifactIdIssue(echo, '')).toBeTruthy();
    expect(artifactIdIssue(echo, 'Avisar')).toBeTruthy();
    expect(artifactIdIssue(echo, 'avisar cliente')).toBeTruthy();
    expect(artifactIdIssue(echo, 'avisar_cliente')).toBeTruthy();
    expect(artifactIdIssue(echo, '1-avisar')).toBeTruthy();
  });

  it('recusa um identificador já usado', () => {
    expect(artifactIdIssue(echo, 'avisar', new Set(['avisar']))).toContain('artifact.taken.workflow');
  });
});

describe('deriveArtifactId', () => {
  it('tira acento, espaço e símbolo do nome', () => {
    expect(deriveArtifactId('Avisar Cliente')).toBe('avisar-cliente');
    expect(deriveArtifactId('Ativar/Inativar Pessoa')).toBe('ativar-inativar-pessoa');
    expect(deriveArtifactId('Prazo — 5 dias!')).toBe('prazo-5-dias');
  });

  it('desempata com sufixo, como o resto da plataforma', () => {
    expect(deriveArtifactId('Avisar cliente', new Set(['avisar-cliente']))).toBe('avisar-cliente-2');
  });

  it('nome que não produz identificador válido ganha prefixo', () => {
    expect(artifactIdIssue(echo, deriveArtifactId('123'))).toBeUndefined();
    expect(artifactIdIssue(echo, deriveArtifactId('!!!'))).toBeUndefined();
  });

  it('o resultado sempre passa na própria validação', () => {
    for (const name of ['Ação', 'a', 'ÁÉÍ ÓÚ', 'workflow 2 — teste']) {
      expect(artifactIdIssue(echo, deriveArtifactId(name))).toBeUndefined();
    }
  });
});

/**
 * O identificador que um PACOTE carrega vira o id do documento — quando serve. Não serve quando o
 * pacote é antigo e traz o id do banco de origem, ou quando o escritório já tem outro artefato
 * naquele nome.
 */
describe('installedArtifactId', () => {
  it('o identificador do pacote é usado tal e qual', () => {
    expect(installedArtifactId('wf-pessoa-status', 'Ativar/Inativar Pessoa', new Set())).toBe('wf-pessoa-status');
  });

  it('id de banco (pacote antigo) não serve — deriva do nome', () => {
    expect(installedArtifactId('NehhFXIJ40ZcaCV2SLjT', 'Ativar/Inativar Pessoa', new Set()))
      .toBe('ativar-inativar-pessoa');
  });

  it('identificador já ocupado no escritório — deriva do nome, desempatando', () => {
    const taken = new Set(['wf-pessoa-status', 'ativar-inativar-pessoa']);
    expect(installedArtifactId('wf-pessoa-status', 'Ativar/Inativar Pessoa', taken))
      .toBe('ativar-inativar-pessoa-2');
  });
});
