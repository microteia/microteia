import { describe, expect, it } from 'vitest';

import {
  buildRecordKeyId,
  diffRecordKeys,
  normalizeRecordKeyValue,
  planRecordKeys,
  recordKeyIssues,
  recordKeyIsSparse,
  recordKeyRefs,
  RECORD_KEY_ID_MAX_LENGTH,
  storedRecordKeyRefs,
  type RecordKeySpec,
} from './recordKeys';

const key = (over: Partial<RecordKeySpec> = {}): RecordKeySpec => ({
  name: 'doc',
  kind: 'unique',
  fields: ['documento'],
  ...over,
});

describe('normalizeRecordKeyValue', () => {
  it('apara as pontas por padrão, porque espaço no fim é a duplicata mais comum', () => {
    expect(normalizeRecordKeyValue('  ABC  ', undefined)).toBe('ABC');
  });

  it('preserva o espaço quando a chave pede', () => {
    expect(normalizeRecordKeyValue('  ABC  ', { trim: false })).toBe('  ABC  ');
  });

  it('iguala maiúsculas e minúsculas só quando declarado', () => {
    expect(normalizeRecordKeyValue('Ana@X.com', { caseInsensitive: true })).toBe('ana@x.com');
    expect(normalizeRecordKeyValue('Ana@X.com', undefined)).toBe('Ana@X.com');
  });

  it('aplica a formatação do catálogo, que é o que iguala 123.456 e 123456', () => {
    expect(normalizeRecordKeyValue('123.456-78', { formatPreset: 'digits' })).toBe('12345678');
  });

  it('ignora uma formatação que não existe em vez de inventar um valor', () => {
    expect(normalizeRecordKeyValue('123.456', { formatPreset: 'nao-existe' })).toBe('123.456');
  });

  it('devolve vazio para todo valor ausente — é o que decide a chave esparsa', () => {
    for (const empty of [null, undefined, '', '   ']) {
      expect(normalizeRecordKeyValue(empty, undefined)).toBe('');
    }
  });

  it('achata lista, para que um campo de múltipla escolha ainda produza um valor', () => {
    expect(normalizeRecordKeyValue(['a', 'b'], undefined)).toBe('a,b');
  });
});

describe('buildRecordKeyId', () => {
  it('é determinístico', () => {
    expect(buildRecordKeyId('pedidos', 'numero', ['7'])).toBe(buildRecordKeyId('pedidos', 'numero', ['7']));
  });

  it('separa coleção, chave e valores', () => {
    expect(buildRecordKeyId('pedidos', 'numero', ['7'])).toBe('pedidos|numero|7');
  });

  it('não deixa um valor com separador se passar por dois valores', () => {
    expect(buildRecordKeyId('c', 'k', ['a|b'])).not.toBe(buildRecordKeyId('c', 'k', ['a', 'b']));
  });

  it('escapa a barra, que o Firestore recusa em id de documento', () => {
    expect(buildRecordKeyId('c', 'k', ['a/b'])).not.toContain('/');
  });

  it('a fuga é injetiva — o til literal não colide com o til de escape', () => {
    expect(buildRecordKeyId('c', 'k', ['a~sb'])).not.toBe(buildRecordKeyId('c', 'k', ['a/b']));
  });

  it('resume o valor longo demais, mantendo o id dentro do teto', () => {
    const id = buildRecordKeyId('c', 'k', ['x'.repeat(2000)]);
    expect(id.length).toBeLessThanOrEqual(RECORD_KEY_ID_MAX_LENGTH + 32);
    expect(id.startsWith('c|k|~h')).toBe(true);
  });

  it('valores longos DIFERENTES produzem resumos diferentes', () => {
    expect(buildRecordKeyId('c', 'k', [`${'x'.repeat(2000)}a`]))
      .not.toBe(buildRecordKeyId('c', 'k', [`${'x'.repeat(2000)}b`]));
  });

  it('a ordem dos campos faz parte da chave', () => {
    expect(buildRecordKeyId('c', 'k', ['a', 'b'])).not.toBe(buildRecordKeyId('c', 'k', ['b', 'a']));
  });
});

describe('planRecordKeys', () => {
  it('sem chave declarada não planeja nada — a coleção de sempre segue como sempre', () => {
    expect(planRecordKeys(undefined, { a: 1 }, 'c')).toEqual({ entries: [], gaps: [], held: [] });
  });

  it('planeja uma reserva por chave, com os campos que ela cobre', () => {
    const plan = planRecordKeys([key()], { documento: '123' }, 'pessoas');
    expect(plan.entries).toEqual([{
      name: 'doc',
      keyId: 'pessoas|doc|123',
      values: ['123'],
      kind: 'unique',
      fields: ['documento'],
    }]);
  });

  it('a chave esparsa sem valor não reserva — 40 cadastros sem CPF não colidem no vazio', () => {
    expect(planRecordKeys([key()], { documento: '' }, 'pessoas').entries).toHaveLength(0);
    expect(planRecordKeys([key()], { documento: '' }, 'pessoas').gaps).toHaveLength(0);
  });

  it('a chave NÃO esparsa sem valor vira lacuna, e a gravação é recusada', () => {
    const plan = planRecordKeys([key({ sparse: false })], {}, 'pessoas');
    expect(plan.entries).toHaveLength(0);
    expect(plan.gaps).toEqual([{ name: 'doc', fields: ['documento'] }]);
  });

  it('a primária nunca é esparsa, mesmo declarada como tal — endereço opcional não endereça', () => {
    expect(recordKeyIsSparse(key({ kind: 'primary', sparse: true }))).toBe(false);
    const plan = planRecordKeys([key({ kind: 'primary', sparse: true })], {}, 'pessoas');
    expect(plan.gaps).toHaveLength(1);
  });

  it('a declaração não decide se a chave vale — `status` é ignorado, e o valor novo é sempre conferido', () => {
    expect(planRecordKeys([key({ status: 'pending' })], { documento: '1' }, 'c').entries).toHaveLength(1);
  });

  it('num update, a chave cujo valor não mudou fica com o que já tinha — sem reserva nem lacuna', () => {
    // É o registro antigo de uma coleção que ganhou a chave: editar outro campo dele não pode esbarrar
    // numa duplicata de antes, que é assunto da adoção.
    const plan = planRecordKeys([key({ sparse: false })], { documento: '', nome: 'x' }, 'c', undefined, { documento: '' });
    expect(plan).toEqual({ entries: [], gaps: [], held: ['doc'] });
    expect(planRecordKeys([key()], { documento: ' 1 ' }, 'c', undefined, { documento: '1' }).held).toEqual(['doc']);
  });

  it('num update, o valor que mudou é conferido como num registro novo', () => {
    const plan = planRecordKeys([key()], { documento: '2' }, 'c', undefined, { documento: '1' });
    expect(plan.entries.map((one) => one.keyId)).toEqual(['c|doc|2']);
    expect(plan.held).toEqual([]);
  });

  it('a chave composta só reserva com todos os valores presentes', () => {
    const composta = key({ name: 'item', fields: ['pedidoId', 'numero'] });
    expect(planRecordKeys([composta], { pedidoId: 'p1' }, 'itens').entries).toHaveLength(0);
    expect(planRecordKeys([composta], { pedidoId: 'p1', numero: 3 }, 'itens').entries[0]?.keyId)
      .toBe('itens|item|p1|3');
  });

  it('normaliza antes de montar o id, e é isso que iguala dois valores só diferentes na aparência', () => {
    const email = key({ name: 'email', fields: ['email'], normalize: { caseInsensitive: true } });
    expect(planRecordKeys([email], { email: ' Ana@X.com ' }, 'c').entries[0]?.keyId)
      .toBe(planRecordKeys([email], { email: 'ana@x.com' }, 'c').entries[0]?.keyId);
  });

  it('ignora chave sem campo nenhum em vez de reservar o vazio', () => {
    expect(planRecordKeys([key({ fields: [] })], {}, 'c').entries).toHaveLength(0);
  });
});

describe('diffRecordKeys', () => {
  const plan = (data: Record<string, unknown>) =>
    planRecordKeys([key(), key({ name: 'apelido', fields: ['apelido'] })], data, 'c');

  it('num registro novo tudo é criação', () => {
    const diff = diffRecordKeys(plan({ documento: '1', apelido: 'x' }), {});
    expect(diff.create).toHaveLength(2);
    expect(diff.release).toHaveLength(0);
  });

  it('a chave cujo valor NÃO mudou não é solta nem recriada — não se abre janela', () => {
    const stored = recordKeyRefs(plan({ documento: '1', apelido: 'x' }).entries);
    const diff = diffRecordKeys(plan({ documento: '1', apelido: 'y' }), stored);
    expect(diff.create.map((one) => one.name)).toEqual(['apelido']);
    expect(diff.release).toEqual(['c|apelido|x']);
  });

  it('esvaziar uma chave esparsa solta a reserva', () => {
    const stored = recordKeyRefs(plan({ documento: '1', apelido: 'x' }).entries);
    const diff = diffRecordKeys(plan({ documento: '1' }), stored);
    expect(diff.create).toHaveLength(0);
    expect(diff.release).toEqual(['c|apelido|x']);
    expect(diff.refs).toEqual({ doc: 'c|doc|1' });
  });

  it('a chave mantida pelo update conserva a reserva que o registro cita, e não cria a que ele não cita', () => {
    const before = { documento: '1', apelido: 'x' };
    const held = planRecordKeys([key(), key({ name: 'apelido', fields: ['apelido'] })], { ...before, nome: 'n' }, 'c', undefined, before);
    expect(diffRecordKeys(held, { doc: 'c|doc|ANTIGA' })).toEqual({ create: [], release: [], refs: { doc: 'c|doc|ANTIGA' } });
  });

  it('solta a reserva que o registro cita mesmo quando a declaração já mudou de forma', () => {
    // A reserva antiga nasceu sob outra normalização; recomputar não a acharia, e ela ficaria presa
    // para sempre. Quem a acha é o próprio registro.
    const diff = diffRecordKeys(plan({ documento: '1' }), { doc: 'c|doc|VELHO' });
    expect(diff.release).toEqual(['c|doc|VELHO']);
    expect(diff.create.map((one) => one.keyId)).toEqual(['c|doc|1']);
  });
});

describe('storedRecordKeyRefs', () => {
  it('lê o mapa gravado', () => {
    expect(storedRecordKeyRefs({ keyRefs: { doc: 'c|doc|1' } })).toEqual({ doc: 'c|doc|1' });
  });

  it('tolera o registro que nunca teve chave', () => {
    for (const raw of [undefined, null, {}, { keyRefs: null }, { keyRefs: 'x' }, { keyRefs: [] }]) {
      expect(storedRecordKeyRefs(raw as Record<string, unknown>)).toEqual({});
    }
  });

  it('descarta entrada que não é id', () => {
    expect(storedRecordKeyRefs({ keyRefs: { a: 1, b: '', c: 'ok' } })).toEqual({ c: 'ok' });
  });
});

describe('recordKeyIssues', () => {
  const ctx = { fieldKeys: new Set(['documento', 'email', 'pedidoId', 'numero']) };

  it('aprova a chave bem declarada', () => {
    expect(recordKeyIssues([key()], ctx)).toEqual([]);
  });

  it('reprova nome ausente ou fora do padrão', () => {
    expect(recordKeyIssues([key({ name: '' })], ctx)[0]?.message)
      .toBe('@core.records/key.error.name-required');
    expect(recordKeyIssues([key({ name: '1abc' })], ctx)[0]?.message)
      .toBe('@core.records/key.error.name-required');
  });

  it('reprova duas chaves com o mesmo nome — o nome endereça a reserva gravada', () => {
    expect(recordKeyIssues([key(), key()], ctx)[0]?.message)
      .toBe('@core.records/key.error.duplicate-name');
  });

  it('reprova chave sem campo', () => {
    expect(recordKeyIssues([key({ fields: [] })], ctx)[0]?.message)
      .toBe('@core.records/key.error.fields-required');
  });

  it('reprova campo que não existe na tela', () => {
    const issue = recordKeyIssues([key({ fields: ['fantasma'] })], ctx)[0];
    expect(issue?.message).toBe('@core.records/key.error.unknown-field');
    expect(issue?.messageParams).toEqual({ field: 'fantasma' });
  });

  it('reprova chave sobre campo que não fica gravado', () => {
    expect(recordKeyIssues([key()], { ...ctx, unstoredFieldKeys: new Set(['documento']) })[0]?.message)
      .toBe('@core.records/key.error.unstored-field');
  });

  it('reprova duas chaves sobre exatamente os mesmos campos no mesmo escopo', () => {
    const issues = recordKeyIssues([key(), key({ name: 'outra' })], ctx);
    expect(issues.map((one) => one.message)).toContain('@core.records/key.error.duplicate-fields');
  });

  it('aceita os mesmos campos em escopos diferentes — são restrições diferentes', () => {
    expect(recordKeyIssues(
      [key(), key({ name: 'outra', scope: 'parent' })],
      { ...ctx, hasParent: true },
    )).toEqual([]);
  });

  it('reprova a segunda primária', () => {
    const issues = recordKeyIssues(
      [key({ kind: 'primary' }), key({ name: 'b', kind: 'primary', fields: ['email'] })],
      ctx,
    );
    expect(issues.map((one) => one.message)).toContain('@core.records/key.error.single-primary');
  });

  it('reprova escopo de pai numa tela sem pai', () => {
    expect(recordKeyIssues([key({ scope: 'parent' })], { ...ctx, hasParent: false })[0]?.message)
      .toBe('@core.records/key.error.scope-needs-parent');
  });

  it('reprova formatação que não existe nesta instalação', () => {
    const issues = recordKeyIssues(
      [key({ normalize: { formatPreset: 'cpf' } })],
      { ...ctx, presetKeys: new Set(['digits']) },
    );
    expect(issues[0]?.message).toBe('@core.records/key.error.unknown-preset');
  });

  it('não reprova formatação quando o catálogo não foi informado', () => {
    expect(recordKeyIssues([key({ normalize: { formatPreset: 'cpf' } })], ctx)).toEqual([]);
  });
});
