import { describe, expect, it } from 'vitest';
import { buildAuditText, computeChangedFields } from './auditDiff';

describe('texto da Auditoria', () => {
  const verified = { provider: 'citizen', claim: { name: 'nationalId', value: '12345678900' }, level: 'gold' };

  it('a gravação de quem provou a identidade leva o bloco ✓ com o provedor, a claim e o nível', () => {
    const text = buildAuditText('UPDATE', 'NF-1', 'Bia', { before: { amount: 1 }, after: { amount: 2 } }, verified);
    expect(text.messageParams?.blocks).toContain('✓');
    expect(text.messageParams?.blocks).toContain('"level": "gold"');
    expect(text.messageParams?.blocks).toContain('12345678900');
  });

  it('sem identidade provada, nenhum bloco a mais', () => {
    const text = buildAuditText('UPDATE', 'NF-1', 'Ana', { before: { amount: 1 }, after: { amount: 2 } });
    expect(text.messageParams?.blocks).not.toContain('✓');
  });

  it('a prova não aparece como campo alterado — ela tem o bloco dela', () => {
    const diff = computeChangedFields({ amount: 1, portalVerified: null }, { amount: 1, portalVerified: verified });
    expect(diff.after).toEqual({});
  });
});
