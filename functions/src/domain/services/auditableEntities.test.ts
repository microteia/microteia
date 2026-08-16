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
  it('identifica a coleção pelo nome dela, e tira o nome do registro da tela', async () => {
    const config = await resolveFlatEntityConfig(provider, 't1', 'contracts');
    expect(config?.entityKey).toBe('contracts');
    expect(config?.getDisplayName({ title: 'Locação' })).toBe('Locação');
  });

  it('sem tela que a descreva, o nome do registro vem da heurística', async () => {
    const config = await resolveFlatEntityConfig(provider, 't1', 'produtos');
    expect(config?.entityKey).toBe('produtos');
    expect(config?.getDisplayName({ nome: 'Caneta' })).toBe('Caneta');
  });

  it('coleção fixa do kernel tem identidade própria, não a da coleção', async () => {
    const config = await resolveFlatEntityConfig(provider, 't1', 'members');
    expect(config?.entityKey).toBe('TenantMember');
  });

  it('coleção de infraestrutura não é auditada', async () => {
    expect(await resolveFlatEntityConfig(provider, 't1', 'lookupDefinitions')).toBeNull();
  });
});

describe('resolveNestedEntityConfig', () => {
  it('a nota herda a identidade do registro a que pertence', async () => {
    const config = await resolveNestedEntityConfig(provider, 't1', 'contracts', 'notes');
    expect(config?.entityKey).toBe('contracts#notes');
  });

  /** Sem tela que descreva o pai, não há identidade a herdar: fica a genérica de registro. */
  it('o documento de uma coleção sem tela fica na identidade genérica', async () => {
    const config = await resolveNestedEntityConfig(provider, 't1', 'produtos', 'documents');
    expect(config?.entityKey).toBe('CustomRecordDocument');
  });

  it('subcoleção fixa tem identidade própria', async () => {
    const config = await resolveNestedEntityConfig(provider, 't1', 'screenDefinitions', 'tags');
    expect(config?.entityKey).toBe('CustomRecordTag');
  });
});
