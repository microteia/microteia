import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_REF_SEPARATOR,
  artifactRef,
  hasRefSeparator,
  isArtifactId,
  isArtifactRef,
  parseArtifactRef,
} from './artifactRef';

describe('referência a artefato de outra extensão', () => {
  it('vai e volta pela mesma forma', () => {
    const ref = artifactRef('com.acme.utils', 'normalizar-cpf');
    expect(ref).toBe('com.acme.utils/normalizar-cpf');
    expect(parseArtifactRef(ref)).toEqual({ pluginId: 'com.acme.utils', artifactId: 'normalizar-cpf' });
  });

  it('corta na PRIMEIRA barra, e a segunda invalida a metade direita', () => {
    expect(parseArtifactRef('com.acme.utils/um/dois')).toBeNull();
  });

  it('recusa metade esquerda que não é id de plugin', () => {
    expect(parseArtifactRef('acme/normalizar-cpf')).toBeNull();
    expect(parseArtifactRef('Com.Acme.Utils/normalizar-cpf')).toBeNull();
    expect(parseArtifactRef('/normalizar-cpf')).toBeNull();
  });

  it('recusa metade direita que não é id de artefato', () => {
    expect(parseArtifactRef('com.acme.utils/Normalizar CPF')).toBeNull();
    expect(parseArtifactRef('com.acme.utils/1-normalizar')).toBeNull();
    expect(parseArtifactRef('com.acme.utils/')).toBeNull();
    expect(parseArtifactRef(`com.acme.utils/${'a'.repeat(61)}`)).toBeNull();
  });

  it('recusa o que não é texto', () => {
    expect(parseArtifactRef(undefined)).toBeNull();
    expect(parseArtifactRef(42)).toBeNull();
  });

  /**
   * A INVARIANTE de que todo o resto depende: os dois espaços de nomes são disjuntos. Se um id de
   * artefato válido pudesse parsear como referência, `bundled()` e a resolução qualificada
   * disputariam o mesmo nome — e a disputa seria silenciosa.
   */
  it('um id de artefato válido NUNCA parseia como referência', () => {
    for (const id of ['normalizar-cpf', 'avisar-cliente-2', 'w', 'a-b-c-d']) {
      expect(isArtifactId(id)).toBe(true);
      expect(isArtifactRef(id)).toBe(false);
      expect(hasRefSeparator(id)).toBe(false);
    }
  });

  it('separa "apontou para fora" de "digitou errado"', () => {
    expect(hasRefSeparator('com.acme.utils/Normalizar CPF')).toBe(true);
    expect(isArtifactRef('com.acme.utils/Normalizar CPF')).toBe(false);
    expect(ARTIFACT_REF_SEPARATOR).toBe('/');
  });
});
