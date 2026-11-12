import { describe, it, expect } from 'vitest';
import { REPORT_DRAFT_TEACHING, reportDraftGrammar } from './reportDraftGrammar';
import { REPORT_CAPABILITIES } from './reportCapabilities';
import { REPORT_CHART_KINDS, REPORT_GRANULARITIES } from './reportSpec';
import { REPORT_PERIODS } from './reportPeriod';
import { QUERY_OPERATORS } from '../querySpec';

describe('gramática do rascunho de relatório por IA', () => {
  it('toda capacidade que o executor anuncia tem uma decisão: ensinada ou deixada de fora', () => {
    // Uma capacidade nova reprova aqui até alguém decidir se a IA a aprende — é o que impede a
    // gramática de ficar para trás do executor, como ficou com o filtro fixo.
    const semDecisao = REPORT_CAPABILITIES.filter((capability) => !(capability in REPORT_DRAFT_TEACHING));
    expect(semDecisao).toEqual([]);
  });

  it('não ensina o que o executor não anuncia', () => {
    const fantasmas = Object.keys(REPORT_DRAFT_TEACHING).filter((capability) => !REPORT_CAPABILITIES.includes(capability));
    expect(fantasmas).toEqual([]);
  });

  it('os valores vêm das constantes que o executor lê', () => {
    const grammar = reportDraftGrammar();
    for (const value of [...REPORT_CHART_KINDS, ...REPORT_GRANULARITIES, ...REPORT_PERIODS, ...QUERY_OPERATORS]) {
      expect(grammar).toContain(JSON.stringify(value));
    }
  });

  it('o que fica de fora não aparece', () => {
    expect(reportDraftGrammar()).not.toMatch(/drillDown|"export"/);
  });
});
