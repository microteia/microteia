import { describe, expect, it } from 'vitest';
import type { CustomFieldType, FieldDefinition } from '../../domain/entities';
import type { EntityKey } from '../../domain/schema/entityRegistry';
import { deriveFormFields, deriveListRows } from './deriveEntitySchema';
import { SCREEN_ICON_KEYS } from './screenIcons';

const CONTROL_TYPES: CustomFieldType[] = [
  'text', 'textarea', 'number', 'currency', 'date', 'checkbox', 'select', 'masked', 'reference', 'markdown',
];

const byKey = (fields: FieldDefinition[]): Map<string, FieldDefinition> =>
  new Map(fields.map((field) => [field.key, field]));

describe('deriveFormFields — campos fixos derivam do ENTITY_REGISTRY como FieldDefinition', () => {
  const fields = deriveFormFields('persons');
  const map = byKey(fields);

  it('todo campo derivado é um FieldDefinition válido (mesmo modelo dos campos dinâmicos)', () => {
    for (const field of fields) {
      expect(typeof field.key).toBe('string');
      expect(typeof field.label).toBe('string');
      expect(typeof field.required).toBe('boolean');
      expect(typeof field.order).toBe('number');
      expect(CONTROL_TYPES).toContain(field.type);
    }
  });

  it('control derivado do tipo/negócio; regras de negócio vindas do NativeFieldSpec', () => {
    expect(map.get('type')).toMatchObject({ type: 'select', required: true, optionsAllowUserAdd: true, lookupCollection: 'personTypes' });
    expect(map.get('name')).toMatchObject({ type: 'text', required: true });
    expect(map.get('cpf')?.type).toBe('masked');
    expect(map.get('cpf')?.mask).toBe('cpf');
    expect(map.get('cpf')?.logic?.hiddenWhen).toBeTruthy();
    expect(map.get('email')?.type).toBe('text');
    expect(map.get('birthDate')?.type).toBe('date');
    expect(map.get('notes')?.type).toBe('textarea');
  });

  it('achata objeto em chaves-com-ponto e preserva lookup/opções', () => {
    expect(map.get('address.city')).toMatchObject({ type: 'select', lookupCollection: 'personCities', section: 'Endereço' });
    expect(map.get('address.state')?.type).toBe('select');
    expect(map.get('address.state')?.options).toHaveLength(27);
    expect(map.get('address.zipCode')?.mask).toBe('cep');
  });

  it('respeita ui.form:false (status não entra no formulário)', () => {
    expect(map.has('status')).toBe(false);
  });

  it('não deriva o FK de etiquetas como campo (quem trata é o TagManager)', () => {
    expect(map.has('tagIds')).toBe(false);
  });
});

describe('deriveFormFields — relações (fks) viram campos reference', () => {
  const map = byKey(deriveFormFields('deadlines'));

  it('deriva o FK como reference apontando para a coleção alvo', () => {
    expect(map.get('caseId')).toMatchObject({ type: 'reference', refEntity: 'cases', required: true });
    expect(map.get('responsibleLawyerId')).toMatchObject({ type: 'reference', refEntity: 'members' });
  });

  it('mantém campos e relações ordenados por ui.order', () => {
    const fields = deriveFormFields('deadlines');
    const orders = fields.map((f) => f.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(fields.map((f) => f.key)).toEqual(
      ['type', 'priority', 'caseId', 'dueDate', 'completedAt', 'responsibleLawyerId', 'description'],
    );
  });

  it('campos derivados (status) e observações ficam fora do formulário', () => {
    expect(map.has('status')).toBe(false);
    expect(map.has('notes')).toBe(false);
  });
});

describe('deriveFormFields — financials', () => {
  const map = byKey(deriveFormFields('financials'));

  it('valor usa controle de moeda e obrigatórios vêm do registry', () => {
    expect(map.get('amount')).toMatchObject({ type: 'currency', required: true });
    expect(map.get('category')).toMatchObject({ type: 'select', required: true, lookupCollection: 'financialCategories' });
    expect(map.get('status')).toMatchObject({ type: 'select', required: true, optionsColored: true });
    expect(map.get('dueDate')).toMatchObject({ type: 'date', required: true });
  });

  it('centro de custo aponta para o lookup compartilhado com Contratos', () => {
    expect(map.get('costCenter')?.lookupCollection).toBe('contractCostCenters');
  });

  it('as três relações viram campos reference', () => {
    expect(map.get('caseId')).toMatchObject({ type: 'reference', refEntity: 'cases' });
    expect(map.get('personId')).toMatchObject({ type: 'reference', refEntity: 'persons' });
    expect(map.get('contractId')).toMatchObject({ type: 'reference', refEntity: 'contracts' });
  });
});

describe('deriveFormFields — cases', () => {
  const map = byKey(deriveFormFields('cases'));

  it('polos ativo/passivo são relações múltiplas para pessoas', () => {
    expect(map.get('activePoleIds')).toMatchObject({ type: 'reference', refEntity: 'persons', multi: true });
    expect(map.get('passivePoleIds')).toMatchObject({ type: 'reference', refEntity: 'persons', multi: true });
  });

  it('tipo de ação é seleção múltipla e valor da causa é moeda', () => {
    expect(map.get('type')).toMatchObject({ type: 'select', multi: true, lookupCollection: 'caseActionTypes' });
    expect(map.get('causeValue')?.type).toBe('currency');
  });
});

// `ui.list.icon` é string livre: um nome errado cai no ícone de fallback silenciosamente.
describe('todo ícone declarado em ui.list existe no catálogo', () => {
  const ENTITIES: EntityKey[] = ['persons', 'cases', 'contracts', 'deadlines', 'financials'];

  it.each(ENTITIES)('%s', (entity) => {
    for (const row of deriveListRows(entity)) {
      expect(SCREEN_ICON_KEYS, `ícone "${row.icon}" (campo ${row.key})`).toContain(row.icon);
    }
  });
});

describe('nenhuma entidade expõe o FK de etiquetas no formulário', () => {
  it.each(['persons', 'cases', 'contracts', 'financials'] as const)('%s', (entity) => {
    expect(deriveFormFields(entity).some((f) => f.key === 'tagIds')).toBe(false);
  });
});

describe('deriveListRows — linhas do card derivam de ui.list, ordenadas', () => {
  it('retorna as linhas na ordem configurada, com ícone', () => {
    const rows = deriveListRows('persons');
    expect(rows.map((r) => r.key)).toEqual(['cpf', 'cnpj', 'email', 'phone', 'occupation', 'address.city']);
    for (const row of rows) expect(row.icon).toBeTruthy();
  });

  it('carrega o controle do campo, para o card formatar moeda/data', () => {
    const rows = deriveListRows('cases');
    expect(rows.find((r) => r.key === 'causeValue')?.type).toBe('currency');
  });

  it('deriva também as relações, marcando a entidade alvo para resolver o rótulo', () => {
    const rows = deriveListRows('cases');
    expect(rows.find((r) => r.key === 'responsibleLawyerId')).toMatchObject({
      type: 'reference',
      refEntity: 'members',
    });
  });

  it('ordena campos e relações juntos pelo ui.list.order', () => {
    expect(deriveListRows('cases').map((r) => r.key)).toEqual(
      ['responsibleLawyerId', 'area', 'instance', 'court', 'causeValue'],
    );
  });
});
