import { describe, expect, it } from 'vitest';
import { buildFieldRulePresetCatalog, CORE_FIELD_RULE_PRESET_CATALOG } from './fieldRulePresets';
import type { RecordKeySpec } from './recordKeys';
import { scopeRecordKeys } from './recordKeys';
import {
  declaredRecordKeySignatures,
  pendingRecordKeyNames,
  planRecordKeyAdoption,
  readRecordKeyAdoptionState,
  RECORD_KEY_ADOPTION_MAX_ATTEMPTS,
  RECORD_KEY_ADOPTION_STALL_MS,
  recordKeySignature,
} from './recordKeyAdoption';
import type { RecordKeyAdoptionState } from './recordKeyAdoption';

const key = (over: Partial<RecordKeySpec> = {}): RecordKeySpec => ({
  name: 'email',
  kind: 'unique',
  fields: ['email'],
  ...over,
});

const signature = (over: Partial<RecordKeySpec> = {}): string =>
  recordKeySignature(key(over), CORE_FIELD_RULE_PRESET_CATALOG);

const NOW = 1_000_000;

const state = (over: Partial<RecordKeyAdoptionState> = {}): RecordKeyAdoptionState => ({
  ...readRecordKeyAdoptionState({}),
  touchedAt: NOW,
  ...over,
});

describe('recordKeySignature', () => {
  it('muda com o que muda a reserva — campos, normalização, esparsidade', () => {
    const base = signature();
    expect(signature({ fields: ['email', 'nome'] })).not.toBe(base);
    expect(signature({ normalize: { caseInsensitive: true } })).not.toBe(base);
    expect(signature({ normalize: { trim: false } })).not.toBe(base);
    expect(signature({ sparse: false })).not.toBe(base);
  });

  it('não muda com o que não mexe na reserva — a mensagem, o padrão explícito, o status ignorado', () => {
    const base = signature();
    expect(signature({ message: '@x/y' })).toBe(base);
    expect(signature({ normalize: { trim: true } })).toBe(base);
    expect(signature({ status: 'pending' })).toBe(base);
  });

  it('a primária é não esparsa por definição — trocar unique+sparse:false por primary não varre de novo', () => {
    expect(signature({ kind: 'primary' })).toBe(signature({ sparse: false }));
  });

  it('a chave parent com o pai resolvido muda de assinatura — é o que readota as reservas feitas sem ele', () => {
    const parent = key({ scope: 'parent' });
    const [scoped] = scopeRecordKeys([parent], 'caseId');
    expect(recordKeySignature(scoped, CORE_FIELD_RULE_PRESET_CATALOG))
      .not.toBe(recordKeySignature(parent, CORE_FIELD_RULE_PRESET_CATALOG));
    const [other] = scopeRecordKeys([parent], 'orderId');
    expect(recordKeySignature(scoped, CORE_FIELD_RULE_PRESET_CATALOG))
      .not.toBe(recordKeySignature(other, CORE_FIELD_RULE_PRESET_CATALOG));
  });

  it('a chave tenant não muda de assinatura ao ser resolvida — nada é varrido de novo', () => {
    const [scoped] = scopeRecordKeys([key()], 'caseId');
    expect(recordKeySignature(scoped, CORE_FIELD_RULE_PRESET_CATALOG)).toBe(signature());
  });

  it('a formatação entra pelo CONTEÚDO: a extensão que muda o que ela faz muda as reservas', () => {
    const one = buildFieldRulePresetCatalog([{ key: 'x/doc', label: 'Doc', format: [{ op: 'digits' }] }]);
    const two = buildFieldRulePresetCatalog([{ key: 'x/doc', label: 'Doc', format: [{ op: 'upper' }] }]);
    const spec = key({ normalize: { formatPreset: 'x/doc' } });
    expect(recordKeySignature(spec, one)).not.toBe(recordKeySignature(spec, two));
  });
});

describe('planRecordKeyAdoption', () => {
  const declared = { email: signature() };

  it('sem job, toda chave declarada é adotada — inclusive a do escritório anterior a esta versão', () => {
    expect(planRecordKeyAdoption(declared, null, NOW)).toEqual({ kind: 'start', pending: declared, adopted: {} });
    expect(planRecordKeyAdoption({}, null, NOW)).toEqual({ kind: 'none' });
  });

  it('a chave já adotada com a mesma assinatura não varre de novo', () => {
    expect(planRecordKeyAdoption(declared, state({ adopted: declared }), NOW)).toEqual({ kind: 'none' });
  });

  it('mudar a normalização reabre a adoção só daquela chave', () => {
    const changed = { email: signature({ normalize: { caseInsensitive: true } }), cpf: 'c' };
    const plan = planRecordKeyAdoption(changed, state({ adopted: { email: signature(), cpf: 'c' } }), NOW);
    expect(plan).toEqual({ kind: 'start', pending: { email: changed.email }, adopted: { cpf: 'c' } });
  });

  it('a passada que terminou com conflitos espera a correção — não varre tudo de novo', () => {
    const waiting = state({ status: 'done', pending: declared, issueCount: 2 });
    expect(planRecordKeyAdoption(declared, waiting, NOW)).toEqual({ kind: 'none' });
  });

  it('esgotadas as tentativas, a passada com falha também espera', () => {
    const exhausted = state({ status: 'done', pending: declared, failed: 1, attempts: RECORD_KEY_ADOPTION_MAX_ATTEMPTS });
    expect(planRecordKeyAdoption(declared, exhausted, NOW)).toEqual({ kind: 'none' });
  });

  it('a chave que saiu da declaração encerra a adoção dela', () => {
    const plan = planRecordKeyAdoption({}, state({ status: 'done', pending: declared, issueCount: 3 }), NOW);
    expect(plan).toEqual({ kind: 'settle', adopted: {}, finish: true });
  });

  it('bloqueada retoma; parada é acordada — inclusive a reconferência que não andou', () => {
    expect(planRecordKeyAdoption(declared, state({ status: 'blocked', pending: declared }), NOW).kind).toBe('resume');
    const later = NOW + RECORD_KEY_ADOPTION_STALL_MS + 1;
    expect(planRecordKeyAdoption(declared, state({ status: 'running', pending: declared }), later).kind).toBe('nudge');
    const recheck = state({ status: 'done', pending: declared, issueCount: 1, recheck: true });
    expect(planRecordKeyAdoption(declared, recheck, later).kind).toBe('nudge');
  });
});

describe('pendingRecordKeyNames', () => {
  it('pendente é o que não foi adotado com a assinatura de hoje', () => {
    const declared = declaredRecordKeySignatures(
      scopeRecordKeys([key(), key({ name: 'cpf', fields: ['cpf'] })], null),
      CORE_FIELD_RULE_PRESET_CATALOG,
    );
    expect(pendingRecordKeyNames(declared, null)).toEqual(['email', 'cpf']);
    expect(pendingRecordKeyNames(declared, state({ adopted: { email: declared.email } }))).toEqual(['cpf']);
  });
});

describe('readRecordKeyAdoptionState', () => {
  it('descarta o conflito malformado em vez de confiar na forma', () => {
    const read = readRecordKeyAdoptionState({
      status: 'done',
      issues: [{ key: 'email', kind: 'duplicate', recordId: 'b', holderId: 'a', values: ['x'] }, { key: 'email' }],
      recheck: 'sim',
    });
    expect(read.issues).toEqual([{ key: 'email', kind: 'duplicate', recordId: 'b', holderId: 'a', values: ['x'] }]);
    expect(read.recheck).toBe(false);
  });
});
