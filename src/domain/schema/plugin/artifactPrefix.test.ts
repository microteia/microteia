import { describe, expect, it } from 'vitest';
import {
  generateArtifactPrefix,
  hasArtifactPrefix,
  isArtifactPrefix,
  withArtifactPrefix,
  withoutArtifactPrefix,
} from './artifactPrefix';

describe('prefixo de quem cria', () => {
  it('o formato: 2 a 8 minúsculas ou dígitos, começando por letra', () => {
    expect(['ab', 'abcd', 'a1b2', 'abcdefgh'].every(isArtifactPrefix)).toBe(true);
    expect(['a', 'ABCD', '1abc', 'abcdefghi', 'ab_c', 'ab-c', '', 42].some(isArtifactPrefix)).toBe(false);
  });

  it('coleção leva "_", artefato leva "-" — os padrões de nome diferem', () => {
    expect(withArtifactPrefix('abcd', 'collection', 'clientes')).toBe('abcd_clientes');
    expect(withArtifactPrefix('abcd', 'artifact', 'avisar-cliente')).toBe('abcd-avisar-cliente');
  });

  it('não dobra o prefixo, e sem prefixo válido o nome passa como veio', () => {
    expect(withArtifactPrefix('abcd', 'collection', 'abcd_clientes')).toBe('abcd_clientes');
    expect(withArtifactPrefix(null, 'collection', 'clientes')).toBe('clientes');
    expect(withArtifactPrefix('A', 'artifact', 'x')).toBe('x');
    expect(withArtifactPrefix('abcd', 'artifact', '  ')).toBe('');
  });

  it('o prefixo sozinho não conta como nome prefixado', () => {
    expect(hasArtifactPrefix('abcd', 'collection', 'abcd_')).toBe(false);
    expect(withoutArtifactPrefix('abcd', 'artifact', 'abcd-avisar')).toBe('avisar');
    expect(withoutArtifactPrefix('abcd', 'artifact', 'avisar')).toBe('avisar');
  });

  it('o sorteio dá quatro letras', () => {
    expect(generateArtifactPrefix(() => 0)).toBe('aaaa');
    expect(generateArtifactPrefix(() => 0.9999)).toBe('zzzz');
    expect(isArtifactPrefix(generateArtifactPrefix())).toBe(true);
  });
});
