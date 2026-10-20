import { describe, expect, it } from 'vitest';
import {
  linkPointsTo,
  parentLinkRequired,
  parentLinkValue,
  parentLockRelation,
  pointsToParent,
  unlinkFromParentPatch,
} from './parentLock';
import { parentLinkRelation } from './screenDataCollection';

const semPosse = { parentEntity: null, parentRelation: null, parentFieldKey: null };
const possuida = { parentEntity: 'contracts', parentRelation: 'owned' as const, parentFieldKey: 'contractId' };

describe('linkPointsTo', () => {
  it('igualdade num vínculo único, contém numa lista', () => {
    expect(linkPointsTo('p1', 'p1')).toBe(true);
    expect(linkPointsTo('p2', 'p1')).toBe(false);
    expect(linkPointsTo(['p2', 'p1'], 'p1')).toBe(true);
    expect(linkPointsTo(['p2'], 'p1')).toBe(false);
    expect(linkPointsTo(null, 'p1')).toBe(false);
    expect(linkPointsTo(undefined, 'p1')).toBe(false);
  });
});

describe('pointsToParent', () => {
  it('basta um dos campos apontar', () => {
    const processo = { activePoleIds: ['a'], passivePoleIds: ['p1'] };
    expect(pointsToParent(processo, ['activePoleIds', 'passivePoleIds'], 'p1')).toBe(true);
    expect(pointsToParent(processo, ['activePoleIds'], 'p1')).toBe(false);
  });

  it('lê o campo aninhado pelo caminho', () => {
    expect(pointsToParent({ owner: { id: 'p1' } }, ['owner.id'], 'p1')).toBe(true);
  });
});

describe('parentLinkValue', () => {
  it('num multi, o registro novo nasce com a lista de um id só', () => {
    expect(parentLinkValue({ multi: true }, 'p1')).toEqual(['p1']);
    expect(parentLinkValue({ multi: false }, 'p1')).toBe('p1');
    expect(parentLinkValue(undefined, 'p1')).toBe('p1');
  });
});

describe('unlinkFromParentPatch', () => {
  it('tira o id da lista e esvazia o campo único que aponta', () => {
    const processo = { activePoleIds: ['p1', 'x'], passivePoleIds: ['y'], contractId: 'p1', lawyerId: 'z' };
    expect(unlinkFromParentPatch(processo, ['activePoleIds', 'passivePoleIds', 'contractId', 'lawyerId'], 'p1'))
      .toEqual({ activePoleIds: ['x'], contractId: null });
  });

  it('a lista que só tinha o pai fica vazia, não nula', () => {
    expect(unlinkFromParentPatch({ ids: ['p1'] }, ['ids'], 'p1')).toEqual({ ids: [] });
  });

  it('nada aponta, nada se grava', () => {
    expect(unlinkFromParentPatch({ ids: ['x'], one: 'y' }, ['ids', 'one'], 'p1')).toEqual({});
  });
});

describe('parentLinkRequired', () => {
  it('campo único obrigatório que aponta não se desfaz', () => {
    expect(parentLinkRequired({ caseId: 'p1' }, [{ key: 'caseId', field: { required: true } }], 'p1')).toBe(true);
  });

  it('multi obrigatório com outros ids se desfaz; com o pai sozinho, não', () => {
    const lock = [{ key: 'ids', field: { required: true, multi: true } }];
    expect(parentLinkRequired({ ids: ['p1', 'x'] }, lock, 'p1')).toBe(false);
    expect(parentLinkRequired({ ids: ['p1'] }, lock, 'p1')).toBe(true);
  });

  it('o campo obrigatório que NÃO aponta não prende o registro', () => {
    const lock = [
      { key: 'activePoleIds', field: { required: true, multi: true } },
      { key: 'passivePoleIds', field: { required: false, multi: true } },
    ];
    expect(parentLinkRequired({ activePoleIds: ['x'], passivePoleIds: ['p1'] }, lock, 'p1')).toBe(false);
  });
});

describe('parentLockRelation', () => {
  /** A trava de um campo único era a única que existia: a resposta tem de ser a mesma de antes. */
  it('com um campo único, responde o mesmo que parentLinkRelation', () => {
    const casos = [
      { screen: semPosse, required: true },
      { screen: semPosse, required: false },
      { screen: possuida, required: false },
      { screen: possuida, required: true },
    ];
    casos.forEach(({ screen, required }) => {
      ['caseId', 'contractId'].forEach((key) => {
        expect(parentLockRelation(screen, { [key]: 'p1' }, [{ key, field: { required } }], 'p1'))
          .toBe(parentLinkRelation(screen, key, { required }));
      });
    });
  });

  it('a posse declarada da tela vence, mesmo num multi com outros ids', () => {
    const screen = { ...possuida, parentFieldKey: 'ids' };
    expect(parentLockRelation(screen, { ids: ['p1', 'x'] }, [{ key: 'ids', field: { multi: true } }], 'p1')).toBe('owned');
  });

  it('com vários campos, o que decide é o campo que APONTA', () => {
    const lock = [
      { key: 'contractId', field: { required: false } },
      { key: 'ids', field: { required: false, multi: true } },
    ];
    expect(parentLockRelation(possuida, { contractId: 'outro', ids: ['p1'] }, lock, 'p1')).toBe('related');
    expect(parentLockRelation(possuida, { contractId: 'p1', ids: [] }, lock, 'p1')).toBe('owned');
  });
});
