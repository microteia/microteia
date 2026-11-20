import { describe, expect, it } from 'vitest';
import { titleReferenceNeeds } from './useEnsureReferencedRecords';
import type { FieldDefinition, ScreenDefinition } from '../../domain/entities';

const field = (key: string, type: FieldDefinition['type'], extra: Partial<FieldDefinition> = {}): FieldDefinition =>
  ({ key, label: key, type, required: false, order: 0, origin: 'design', ...extra }) as FieldDefinition;

const screens = [
  { id: 'holders', titleFieldKey: 'name', fields: [field('name', 'text')] },
  { id: 'accounts', titleFieldKey: 'holder', fields: [field('holder', 'reference', { refEntity: 'holders' })] },
  { id: 'owners', titleFieldKey: 'member', fields: [field('member', 'reference', { refEntity: 'members' })] },
] as unknown as ScreenDefinition[];

/**
 * Issue #8: a carta aponta a conta, e a conta se chama pelo titular. Trazer só a conta deixava a carta
 * com "Sem título" — o nome está no SEGUNDO registro, que ninguém pedia.
 */
describe('titleReferenceNeeds — o segundo salto a trazer', () => {
  it('do apontado que se chama por referência, pede o registro de onde sai o nome', () => {
    expect(titleReferenceNeeds([
      { collection: 'accounts', record: { holder: 'h2' } },
      { collection: 'accounts', record: { holder: 'h1' } },
      { collection: 'holders', record: { name: 'Jane' } },
    ], screens)).toEqual([['holders', ['h1', 'h2']]]);
  });

  it('título comum, membro e tela desconhecida não pedem nada', () => {
    expect(titleReferenceNeeds([
      { collection: 'holders', record: { name: 'Jane' } },
      { collection: 'owners', record: { member: 'u1' } },
      { collection: 'unknown', record: { holder: 'h1' } },
    ], screens)).toEqual([]);
  });
});
