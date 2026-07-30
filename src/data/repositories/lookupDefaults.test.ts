import { describe, expect, it } from 'vitest';
import { LOOKUP_DEFAULTS, lookupDefaultsFor } from './lookupDefaults';
import { mergeLookupDefaults } from './mergeLookupDefaults';
import { LOOKUP_REGISTRY } from '../../domain/schema/lookupRegistry';

describe('opções que o kernel já traz', () => {
  /**
   * O invariante que separa a opção do kernel da cadastrada pelo escritório. Sem ele, a fixa entra
   * como dinâmica: ganha botão de excluir (que não pode funcionar, porque ela não tem documento) e
   * perde a cor do tema, já que só o ramo dinâmico é filtrado por `optionsColored`.
   */
  it('toda opção declarada em código é marcada como fixa', () => {
    const options = Object.values(LOOKUP_DEFAULTS).flat();
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((option) => option.isStatic === true)).toBe(true);
  });

  it('a lista sem defaults responde vazia, não indefinida', () => {
    expect(lookupDefaultsFor('caseCourts')).toEqual([]);
    expect(lookupDefaultsFor('medico_especialidade')).toEqual([]);
  });

  it('as cores vêm como token do tema, para o tema claro e o escuro renderizarem diferente', () => {
    const emAndamento = lookupDefaultsFor('caseStatuses').find((option) => option.key === 'Em Andamento');
    expect(emAndamento?.color).toBe('caseStatusInProgress');
  });

  it('toda coleção com defaults existe no registro de listas', () => {
    for (const collection of Object.keys(LOOKUP_DEFAULTS)) {
      expect(LOOKUP_REGISTRY[collection], `"${collection}" não está no LOOKUP_REGISTRY`).toBeTruthy();
    }
  });

  it('a opção do tenant com o mesmo rótulo de uma fixa não duplica na lista', () => {
    const merged = mergeLookupDefaults(lookupDefaultsFor('caseStatuses'), [
      { key: 'Acordo', label: 'Acordo', isStatic: false },
      { key: 'Homologado', label: 'Homologado', isStatic: false },
    ]);

    expect(merged.filter((option) => option.label === 'Acordo')).toHaveLength(1);
    expect(merged.find((option) => option.label === 'Acordo')?.isStatic).toBe(true);
    expect(merged.find((option) => option.label === 'Homologado')?.isStatic).toBe(false);
  });
});
