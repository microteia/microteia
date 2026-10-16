import { describe, it, expect } from 'vitest';
import type { FkHop } from './pathResolver';
import { MULTI_FK_MATERIALIZE_LIMIT, collectHopRecordRefs, materializeHops, recordKey } from './materialize';
import { STORED_REFERENCE_ID, readAsStored } from './storedReference';

const contractHop: FkHop = {
  atPath: 'contractId',
  targetCollection: 'contracts',
  materializeAt: 'contract',
  mode: 'denormKey',
  multi: false,
  fields: ['number', 'title'],
};

const activePoleHop: FkHop = {
  atPath: 'activePoleIds',
  targetCollection: 'persons',
  materializeAt: 'activePole',
  mode: 'denormKey',
  multi: true,
  fields: 'all',
};

const tarefaHop: FkHop = {
  atPath: 'tarefa',
  targetCollection: 'tarefas',
  materializeAt: 'tarefa',
  mode: 'replaceValue',
  multi: false,
  fields: 'all',
};

describe('collectHopRecordRefs', () => {
  it('coleta ids únicos e ignora destinos já materializados', () => {
    const payload = {
      contractId: 'c1',
      activePoleIds: ['p1', 'p2', 'p1'],
      tarefa: 't1',
    };
    const refs = collectHopRecordRefs(payload, [contractHop, activePoleHop, tarefaHop]);
    expect(refs).toStrictEqual([
      { collection: 'contracts', id: 'c1' },
      { collection: 'persons', id: 'p1' },
      { collection: 'persons', id: 'p2' },
      { collection: 'tarefas', id: 't1' },
    ]);

    const alreadyMaterialized = { contractId: 'c1', contract: { id: 'c1' } };
    expect(collectHopRecordRefs(alreadyMaterialized, [contractHop])).toStrictEqual([]);
  });
});

describe('materializeHops', () => {
  it('materializa FK fixa com pick de campos e {id} para doc inexistente', () => {
    const records = new Map([[recordKey('contracts', 'c1'), { number: '001', title: 'Contrato X', status: 'Ativo' }]]);
    const result = materializeHops({ contractId: 'c1' }, [contractHop], records);
    expect(result.contract).toStrictEqual({ id: 'c1', number: '001', title: 'Contrato X' });

    const missing = materializeHops({ contractId: 'c9' }, [contractHop], new Map());
    expect(missing.contract).toStrictEqual({ id: 'c9' });
  });

  it('não sobrescreve destino já materializado pelo eager', () => {
    const eager = { contractId: 'c1', contract: { id: 'c1', number: 'eager' } };
    const records = new Map([[recordKey('contracts', 'c1'), { number: 'lazy' }]]);
    const result = materializeHops(eager, [contractHop], records);
    expect((result.contract as Record<string, unknown>).number).toBe('eager');
  });

  it('materializa FK múltipla com limite', () => {
    const ids = Array.from({ length: MULTI_FK_MATERIALIZE_LIMIT + 5 }, (_, i) => `p${i}`);
    const records = new Map(ids.map((id) => [recordKey('persons', id), { name: `Nome ${id}` }]));
    const result = materializeHops({ activePoleIds: ids }, [activePoleHop], records);
    const list = result.activePole as Record<string, unknown>[];
    expect(list).toHaveLength(MULTI_FK_MATERIALIZE_LIMIT);
    expect(list[0]).toMatchObject({ id: 'p0', name: 'Nome p0' });
  });

  it('substitui reference de tela pelo registro inteiro, sem desempacotar nada', () => {
    const records = new Map([
      [recordKey('tarefas', 't1'), { nome: 'Elaborar petição', prazo: '2026-07-10' }],
    ]);
    const result = materializeHops({ tarefa: 't1' }, [tarefaHop], records);
    expect(result.tarefa).toStrictEqual({
      id: 't1',
      nome: 'Elaborar petição',
      prazo: '2026-07-10',
      [STORED_REFERENCE_ID]: 't1',
    });
  });

  it('o registro posto no lugar do id guarda o id gravado: lido como está, volta a ser o id', () => {
    const records = new Map([[recordKey('tarefas', 't1'), { nome: 'Elaborar petição' }]]);
    const result = materializeHops({ tarefa: 't1', outras: ['t1', 't2'] }, [tarefaHop, { ...tarefaHop, atPath: 'outras', materializeAt: 'outras', multi: true }], records);
    expect(readAsStored(result.tarefa)).toBe('t1');
    expect(readAsStored(result.outras)).toStrictEqual(['t1', 't2']);
    expect(Object.keys(result.tarefa as object)).toStrictEqual(['id', 'nome']);
    expect(JSON.parse(JSON.stringify(result.tarefa))).toStrictEqual({ id: 't1', nome: 'Elaborar petição' });
  });

  it('não substitui reference já enriquecida (objeto) nem valor vazio', () => {
    const enriched = { tarefa: { id: 't1', nome: 'já enriquecida' } };
    const result = materializeHops(enriched, [tarefaHop], new Map());
    expect(result.tarefa).toStrictEqual({ id: 't1', nome: 'já enriquecida' });

    const empty = materializeHops({ customValues: { tarefa: null } }, [tarefaHop], new Map());
    expect((empty.customValues as Record<string, unknown>).tarefa).toBeNull();
  });

  it('materializa sob old sem tocar o payload atual', () => {
    const oldHop: FkHop = { ...contractHop, atPath: 'old.contractId', materializeAt: 'old.contract' };
    const records = new Map([[recordKey('contracts', 'c2'), { number: '002', title: 'Antigo' }]]);
    const payload = { contractId: 'c1', old: { contractId: 'c2' } };
    const result = materializeHops(payload, [oldHop], records);
    expect((result.old as Record<string, unknown>).contract).toMatchObject({ id: 'c2', number: '002' });
    expect(result.contract).toBeUndefined();
  });
});
