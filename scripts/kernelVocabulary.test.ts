import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * As entidades de escritório saíram deste repositório, e o nome delas não pode voltar ao código do
 * kernel por outra porta. Cada ocorrência que este teste já teria pego era um defeito de verdade: o
 * gatilho de eventos de documento listava `['cases', 'persons', 'contracts', 'financials']`, e para
 * toda tela declarada o evento simplesmente não existia; a Paleta de Comandos assinava três coleções
 * de advocacia em todo escritório; o scaffold do SDK gerava uma view lendo `persons`.
 *
 * Quando o kernel PARECER precisar de um desses nomes, a pergunta é qual capacidade declarativa está
 * faltando — ver "As entidades de ESCRITÓRIO não moram aqui" no ARCHITECTURE.md.
 *
 * Comentário não conta: ali o nome é história ou ilustração, e não decide comportamento. Teste também
 * não: uma fixture precisa de um nome de coleção qualquer.
 */
const OFFICE_COLLECTION = /['"`](cases|persons|contracts|financials|deadlines|pushes)['"`]/;
const OFFICE_IDENTIFIER = /\b(caseId|caseIds|caseNumber|personId|personIds|contractId|contractIds|responsibleLawyer\w*|lawyers?|Lawyers?)\b/;

const ROOTS = ['src', 'functions/src', 'cli/src', 'scripts'];
const SOURCE = /\.(ts|tsx|mjs|cjs|js)$/;
const NOT_PRODUCTION = /\.test\.(ts|tsx)$|test-support|\/__fixtures__\//;

const isComment = (line: string): boolean => /^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line);

const productionFiles = (): string[] =>
  execFileSync('git', ['ls-files', '-co', '--exclude-standard', ...ROOTS], { encoding: 'utf8' })
    .split('\n')
    .filter((file) => SOURCE.test(file) && !NOT_PRODUCTION.test(file));

describe('o kernel não conhece entidade de escritório', () => {
  it('nenhum nome de coleção ou campo de escritório no código de produção', () => {
    const hits: string[] = [];
    for (const file of productionFiles()) {
      let source: string;
      try {
        source = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      source.split('\n').forEach((line, index) => {
        if (isComment(line)) return;
        if (OFFICE_COLLECTION.test(line) || OFFICE_IDENTIFIER.test(line)) hits.push(`${file}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
