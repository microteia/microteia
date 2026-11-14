import { describe, expect, it } from 'vitest';
import { mapWorkflowDefinition } from './FirebaseWorkflowDefinitionRepository';

const base = { name: 'w', eventName: 'mail.received', steps: [], createdAt: new Date(0), updatedAt: new Date(0) };

describe('mapWorkflowDefinition', () => {
  // O filtro de mudança existia na definição desde 2.108.0, mas o mapeamento não o lia: o motor rodava a
  // automação a cada salvamento, com filtro ou sem.
  it('lê o filtro de mudança gravado', () => {
    const mapped = mapWorkflowDefinition('w', 't', { ...base, eventName: 'x.saved', changeType: 'updated', changedFields: ['status'] });
    expect(mapped.changeType).toBe('updated');
    expect(mapped.changedFields).toEqual(['status']);
  });

  it('lê o filtro de e-mail e a marca de assinável', () => {
    const mapped = mapWorkflowDefinition('w', 't', { ...base, mailFilter: { from: ['*.jus.br'] }, subscribable: true });
    expect(mapped.mailFilter).toEqual({ from: ['*.jus.br'] });
    expect(mapped.subscribable).toBe(true);
  });

  it('a definição sem os campos sai sem filtro e não assinável', () => {
    const mapped = mapWorkflowDefinition('w', 't', base);
    expect(mapped.changeType).toBeNull();
    expect(mapped.changedFields).toBeNull();
    expect(mapped.mailFilter).toBeNull();
    expect(mapped.subscribable).toBe(false);
  });
});
