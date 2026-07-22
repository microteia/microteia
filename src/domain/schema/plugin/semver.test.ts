import { describe, it, expect } from 'vitest';
import {
  compareSemVer,
  isValidRange,
  isValidSemVer,
  maxSatisfying,
  parseRange,
  parseSemVer,
  satisfiesRange,
} from './semver';

const version = (raw: string) => {
  const parsed = parseSemVer(raw);
  if (!parsed) throw new Error(`versão inválida no teste: ${raw}`);
  return parsed;
};

describe('parseSemVer', () => {
  it('extrai as três casas', () => {
    expect(parseSemVer('1.2.3')).toMatchObject({ major: 1, minor: 2, patch: 3, prerelease: [] });
  });

  it('extrai identificadores de pré-release', () => {
    expect(parseSemVer('1.0.0-beta.2')).toMatchObject({ prerelease: ['beta', '2'] });
  });

  it('descarta metadados de build', () => {
    expect(parseSemVer('1.2.3+build.99')).toMatchObject({ major: 1, minor: 2, patch: 3 });
  });

  it('aceita espaços em volta', () => {
    expect(parseSemVer('  1.2.3  ')).toMatchObject({ major: 1, minor: 2, patch: 3, raw: '1.2.3' });
  });

  it.each(['1.2', '1.2.3.4', 'v1.2.3', '1.2.x', '', 'abc', '01.2.3-'])(
    'rejeita "%s"',
    (raw) => {
      expect(parseSemVer(raw)).toBeNull();
      expect(isValidSemVer(raw)).toBe(false);
    },
  );

  it('rejeita entrada não-string sem lançar', () => {
    expect(parseSemVer(undefined as unknown as string)).toBeNull();
  });
});

describe('compareSemVer', () => {
  it('ordena pelas casas, da mais significativa para a menos', () => {
    expect(compareSemVer(version('2.0.0'), version('1.9.9'))).toBe(1);
    expect(compareSemVer(version('1.2.0'), version('1.10.0'))).toBe(-1);
    expect(compareSemVer(version('1.2.3'), version('1.2.4'))).toBe(-1);
    expect(compareSemVer(version('1.2.3'), version('1.2.3'))).toBe(0);
  });

  it('coloca pré-release antes da release da mesma tupla', () => {
    expect(compareSemVer(version('1.0.0-beta'), version('1.0.0'))).toBe(-1);
    expect(compareSemVer(version('1.0.0'), version('1.0.0-beta'))).toBe(1);
  });

  it('ordena identificadores numéricos numericamente', () => {
    expect(compareSemVer(version('1.0.0-beta.2'), version('1.0.0-beta.10'))).toBe(-1);
  });

  it('coloca identificador numérico antes de alfanumérico', () => {
    expect(compareSemVer(version('1.0.0-1'), version('1.0.0-alpha'))).toBe(-1);
  });

  it('trata o conjunto menor de identificadores como menor', () => {
    expect(compareSemVer(version('1.0.0-beta'), version('1.0.0-beta.1'))).toBe(-1);
  });
});

describe('parseRange', () => {
  it('trata "*" como faixa sem restrição', () => {
    expect(parseRange('*')).toEqual([]);
    expect(satisfiesRange('99.0.0', '*')).toBe(true);
  });

  it('lê uma conjunção separada por espaço', () => {
    expect(parseRange('>=1.2.0 <2.0.0')).toHaveLength(2);
  });

  it.each(['', '   ', '^', '>=abc', '^1.2', 'not-a-range'])('rejeita "%s"', (raw) => {
    expect(parseRange(raw)).toBeNull();
    expect(isValidRange(raw)).toBe(false);
  });
});

describe('satisfiesRange', () => {
  it('resolve igualdade exata', () => {
    expect(satisfiesRange('1.2.3', '1.2.3')).toBe(true);
    expect(satisfiesRange('1.2.4', '1.2.3')).toBe(false);
    expect(satisfiesRange('1.2.3', '=1.2.3')).toBe(true);
  });

  it('resolve os operadores de ordem', () => {
    expect(satisfiesRange('1.2.4', '>1.2.3')).toBe(true);
    expect(satisfiesRange('1.2.3', '>1.2.3')).toBe(false);
    expect(satisfiesRange('1.2.3', '>=1.2.3')).toBe(true);
    expect(satisfiesRange('1.2.2', '<1.2.3')).toBe(true);
    expect(satisfiesRange('1.2.3', '<=1.2.3')).toBe(true);
  });

  it('exige que TODOS os comparadores da conjunção passem', () => {
    expect(satisfiesRange('1.5.0', '>=1.2.0 <2.0.0')).toBe(true);
    expect(satisfiesRange('2.0.0', '>=1.2.0 <2.0.0')).toBe(false);
    expect(satisfiesRange('1.1.0', '>=1.2.0 <2.0.0')).toBe(false);
  });

  it('aplica a semântica do caret acima de 0.x', () => {
    expect(satisfiesRange('1.2.3', '^1.2.3')).toBe(true);
    expect(satisfiesRange('1.9.9', '^1.2.3')).toBe(true);
    expect(satisfiesRange('2.0.0', '^1.2.3')).toBe(false);
    expect(satisfiesRange('1.2.2', '^1.2.3')).toBe(false);
  });

  it('aplica a semântica restritiva do caret em 0.x', () => {
    expect(satisfiesRange('0.2.9', '^0.2.3')).toBe(true);
    expect(satisfiesRange('0.3.0', '^0.2.3')).toBe(false);
    expect(satisfiesRange('0.0.3', '^0.0.3')).toBe(true);
    expect(satisfiesRange('0.0.4', '^0.0.3')).toBe(false);
  });

  it('aplica a semântica do til (só patch)', () => {
    expect(satisfiesRange('1.2.9', '~1.2.3')).toBe(true);
    expect(satisfiesRange('1.3.0', '~1.2.3')).toBe(false);
  });

  it('não deixa pré-release entrar numa faixa de release', () => {
    expect(satisfiesRange('2.0.0-beta', '^1.0.0')).toBe(false);
    expect(satisfiesRange('1.5.0-beta', '^1.0.0')).toBe(false);
    expect(satisfiesRange('1.0.0-beta', '>=1.0.0')).toBe(false);
  });

  it('deixa pré-release entrar quando o comparador fala da mesma tupla', () => {
    expect(satisfiesRange('1.0.0-beta.2', '>=1.0.0-beta.1')).toBe(true);
    expect(satisfiesRange('1.0.0-beta.1', '>=1.0.0-beta.2')).toBe(false);
  });

  it('retorna false para versão ou faixa inválida, sem lançar', () => {
    expect(satisfiesRange('abc', '^1.0.0')).toBe(false);
    expect(satisfiesRange('1.0.0', 'abc')).toBe(false);
  });
});

describe('maxSatisfying', () => {
  it('devolve a maior versão que atende a faixa', () => {
    expect(maxSatisfying(['1.0.0', '1.4.2', '1.9.0', '2.0.0'], '^1.0.0')).toBe('1.9.0');
  });

  it('devolve null quando nenhuma atende', () => {
    expect(maxSatisfying(['2.0.0', '3.0.0'], '^1.0.0')).toBeNull();
  });

  it('ignora versões malformadas na lista', () => {
    expect(maxSatisfying(['1.0.0', 'nope', '1.2.0'], '^1.0.0')).toBe('1.2.0');
  });

  it('devolve null para lista vazia', () => {
    expect(maxSatisfying([], '*')).toBeNull();
  });
});
