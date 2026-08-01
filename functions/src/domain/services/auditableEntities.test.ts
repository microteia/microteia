import { describe, expect, it } from 'vitest';
import { fakeScreenProvider } from '../repositories/fakeScreenProvider';
import type { SchemaScreen } from '../schema/pathResolver';
import { resolveFlatEntityConfig, resolveNestedEntityConfig } from './auditableEntities';

const contratos: SchemaScreen = {
  id: 'contratos',
  collection: 'contracts',
  titleSingular: 'Contrato',
  titlePlural: 'Contratos',
  titleFieldKey: 'title',
  fields: [],
};

const provider = fakeScreenProvider([contratos]);

/**
 * O auditor não pode ter uma lista de entidades no código: no dia em que Contrato saiu do kernel, a
 * lista deixou de conhecê-lo e todo log virou "Alteração na entidade de Registros". Quem diz o nome
 * da entidade é a declaração do tenant.
 */
describe('resolveFlatEntityConfig', () => {
  it('nomeia a coleção pela tela que a descreve', async () => {
    const config = await resolveFlatEntityConfig(provider, 't1', 'contracts');
    expect(config?.entityLabel).toBe('Contrato');
    expect(config?.entityLabelPlural).toBe('Contratos');
    expect(config?.entityKey).toBe('contracts');
    expect(config?.getDisplayName({ title: 'Locação' })).toBe('Locação');
  });

  it('sem tela que a descreva, sobra o rótulo genérico', async () => {
    const config = await resolveFlatEntityConfig(provider, 't1', 'produtos');
    expect(config?.entityLabel).toBe('Registro');
    expect(config?.getDisplayName({ nome: 'Caneta' })).toBe('Caneta');
  });

  it('coleção fixa do kernel continua com o nome do código', async () => {
    const config = await resolveFlatEntityConfig(provider, 't1', 'deadlines');
    expect(config?.entityLabel).toBe('Prazo');
    expect(config?.entityKey).toBe('Deadline');
  });

  it('coleção de infraestrutura não é auditada', async () => {
    expect(await resolveFlatEntityConfig(provider, 't1', 'lookupDefinitions')).toBeNull();
  });
});

describe('resolveNestedEntityConfig', () => {
  it('a nota herda a identidade do registro a que pertence', async () => {
    const config = await resolveNestedEntityConfig(provider, 't1', 'contracts', 'notes');
    expect(config?.entityLabel).toBe('Nota de Contrato');
    expect(config?.entityLabelPlural).toBe('Notas de Contratos');
    expect(config?.entityKey).toBe('contracts#notes');
  });

  it('o documento de uma coleção sem tela fica no rótulo genérico', async () => {
    const config = await resolveNestedEntityConfig(provider, 't1', 'produtos', 'documents');
    expect(config?.entityLabel).toBe('Documento de Registro Personalizado');
  });

  it('subcoleção fixa continua com o nome do código', async () => {
    const config = await resolveNestedEntityConfig(provider, 't1', 'financials', 'documents');
    expect(config?.entityLabel).toBe('Documento de Financeiro');
  });
});
