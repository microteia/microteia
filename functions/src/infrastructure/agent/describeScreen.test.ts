import { describe, expect, it } from 'vitest';
import { describeScreen } from './describeScreen';
import type { AgentSession } from './authenticateAgent';
import { createSchemaContext } from '../../domain/schema/screenEntity';

const session: AgentSession = {
  tenantId: 't1',
  userId: 'u1',
  grantId: 'g1',
  grantName: 'Claude',
  permissions: ['comunicacoes.read', 'comunicacoes.create'],
  ceiling: ['comunicacoes.read', 'comunicacoes.create'],
  expiresAt: null,
  lastUsedAt: null,
};

describe('describeScreen — o campo numerado pelo sistema', () => {
  it('chega ao agente como somente leitura, e o código sorteado continua gravável', () => {
    const ctx = createSchemaContext([{
      id: 'comunicacoes',
      titleSingular: 'Comunicação',
      titleFieldKey: 'assunto',
      fields: [
        { key: 'assunto', label: 'Assunto', type: 'text', required: true, order: 0, origin: 'plugin' },
        {
          key: 'protocolo', label: 'Protocolo', type: 'text', required: false, order: 1, origin: 'plugin',
          autoValue: { pattern: 'YYYY/000000', sequence: { resetBy: 'year' } },
        },
        {
          key: 'codigo', label: 'Código', type: 'text', required: false, order: 2, origin: 'plugin',
          autoValue: { pattern: 'AA0000' },
        },
      ],
    }]);
    const fields = describeScreen(ctx, { locale: 'en', messages: {} }, session, 'comunicacoes')?.fields ?? [];
    const byKey = Object.fromEntries(fields.map((field) => [field.key, field]));
    expect(byKey.protocolo.readOnly).toBe(true);
    expect(byKey.codigo.readOnly).toBeUndefined();
    expect(byKey.assunto.readOnly).toBeUndefined();
  });
});
