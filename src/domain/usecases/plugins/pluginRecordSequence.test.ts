import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { RECORD_SEQUENCE_SINCE_KERNEL } from '../../schema/recordSequence';
import { packageRecordSequenceIssues } from './pluginRecordSequence';
import { packageIssues } from './pluginReferences';

const protocolo = (autoValue: unknown) => ({
  key: 'protocolo', label: 'protocolo', type: 'text' as const, required: false, order: 1,
  ...(autoValue === undefined ? {} : { autoValue: autoValue as { pattern: string } }),
});

const pkg = (autoValue: unknown, kernel = `^${RECORD_SEQUENCE_SINCE_KERNEL}`, patch = false): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.dte', version: '1.0.0', kernel, name: 'DTE', contributes: [] },
  workflows: [],
  screens: [{
    key: 'comunicacoes',
    titleSingular: 'Comunicação',
    titlePlural: 'Comunicações',
    icon: 'mail',
    titleFieldKey: 'assunto',
    fields: [
      { key: 'assunto', label: 'assunto', type: 'text', required: true, order: 0 },
      ...(patch ? [] : [protocolo(autoValue)]),
    ],
  }],
  ...(patch ? { screenPatches: [{ target: 'processos', fields: [protocolo(autoValue)] }] } : {}),
});

describe('campo numerado (`autoValue.sequence`) no pacote', () => {
  it('a declaração certa, com o kernel que a entende, passa; o sorteio não depende de kernel', () => {
    expect(packageRecordSequenceIssues(pkg({ pattern: 'YYYY/000000', sequence: { resetBy: 'year' } }))).toEqual([]);
    expect(packageRecordSequenceIssues(pkg({ pattern: 'AA0000' }, '^2.0.0'))).toEqual([]);
    expect(packageRecordSequenceIssues(pkg(undefined, '^2.0.0'))).toEqual([]);
  });

  it('o kernel anterior é recusa: ele leria o padrão como sorteio, e o número poderia se repetir', () => {
    expect(packageIssues(pkg({ pattern: 'YYYY/000000', sequence: {} }, '^2.75.0'))).toContainEqual({
      message: '@core.marketplace/issue.record-sequence.kernel',
      messageParams: { screen: 'comunicacoes', minimum: RECORD_SEQUENCE_SINCE_KERNEL },
    });
  });

  it('a forma que repetiria o número é recusada, nomeando tela e campo', () => {
    expect(packageRecordSequenceIssues(pkg({ pattern: '000000', sequence: { resetBy: 'year' } }))).toEqual([{
      message: '@core.marketplace/issue.record-sequence.pattern-year',
      messageParams: { screen: 'comunicacoes', field: 'protocolo' },
    }]);
  });

  it('o escopo do pai pede `parentFieldKey` na tela — mas não no campo que um patch acrescenta', () => {
    const parent = { pattern: '', sequence: { scope: 'parent' } };
    expect(packageRecordSequenceIssues(pkg(parent)).map((issue) => issue.message))
      .toEqual(['@core.marketplace/issue.record-sequence.scope-needs-parent']);
    expect(packageRecordSequenceIssues(pkg(parent, undefined, true))).toEqual([]);
  });

  it('o campo acrescentado por patch também cobra o kernel', () => {
    expect(packageRecordSequenceIssues(pkg({ pattern: '', sequence: {} }, '^2.0.0', true))).toEqual([{
      message: '@core.marketplace/issue.record-sequence.kernel',
      messageParams: { screen: 'processos', minimum: RECORD_SEQUENCE_SINCE_KERNEL },
    }]);
  });
});
