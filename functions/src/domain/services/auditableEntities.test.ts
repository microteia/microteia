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
    expect(config?.entityLabel).toBe('@core.admin/audit.entity.record');
    expect(config?.getDisplayName({ nome: 'Caneta' })).toBe('Caneta');
  });

  it('coleção fixa do kernel continua com o nome do código', async () => {
    const config = await resolveFlatEntityConfig(provider, 't1', 'members');
    expect(config?.entityLabel).toBe('@core.admin/audit.entity.tenant-member');
    expect(config?.entityKey).toBe('TenantMember');
  });

  it('coleção de infraestrutura não é auditada', async () => {
    expect(await resolveFlatEntityConfig(provider, 't1', 'lookupDefinitions')).toBeNull();
  });
});

describe('resolveNestedEntityConfig', () => {
  it('a nota herda a identidade do registro a que pertence', async () => {
    const config = await resolveNestedEntityConfig(provider, 't1', 'contracts', 'notes');
    // O rótulo é a CHAVE da composição; o nome do registro vai ao lado, para a frase interpolar.
    expect(config?.entityLabel).toBe('@core.admin/audit.entity.note-of');
    expect(config?.entityLabelParams).toEqual({ name: 'Contrato' });
    expect(config?.entityLabelPlural).toBe('@core.admin/audit.entity.note-of.plural');
    expect(config?.entityLabelPluralParams).toEqual({ name: 'Contratos' });
    expect(config?.entityKey).toBe('contracts#notes');
  });

  it('o documento de uma coleção sem tela fica no rótulo genérico', async () => {
    const config = await resolveNestedEntityConfig(provider, 't1', 'produtos', 'documents');
    expect(config?.entityLabel).toBe('@core.admin/audit.entity.custom-record-document');
  });

  it('subcoleção fixa continua com o nome do código', async () => {
    const config = await resolveNestedEntityConfig(provider, 't1', 'screenDefinitions', 'tags');
    expect(config?.entityLabel).toBe('@core.admin/audit.entity.custom-record-tag');
  });
});
