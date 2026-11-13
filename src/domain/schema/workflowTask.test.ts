import { describe, it, expect } from 'vitest';
import {
  approvalOutcomesOf, approvalQuorumOf, approvalRemindEveryOf, DEFAULT_APPROVAL_OUTCOMES, nextApprovalReminder,
  pendingTaskVoters, tallyApprovalVotes, workflowTaskId, delegateTaskAssignees, approvalEscalationAt,
} from './workflowTask';

describe('approvalOutcomesOf', () => {
  it('sem desfecho declarado, aprovar e recusar', () => {
    expect(approvalOutcomesOf(undefined)).toEqual(DEFAULT_APPROVAL_OUTCOMES);
    expect(approvalOutcomesOf([])).toEqual(DEFAULT_APPROVAL_OUTCOMES);
  });

  it('a chave sai do texto do escritório, sem acento e com hífen; o rótulo fica como foi digitado', () => {
    expect(approvalOutcomesOf(['Aprovar com ressalva', 'Não aprovar'])).toEqual([
      { key: 'aprovar-com-ressalva', label: 'Aprovar com ressalva' },
      { key: 'nao-aprovar', label: 'Não aprovar' },
    ]);
  });

  it('repetidos e vazios saem', () => {
    expect(approvalOutcomesOf(['Sim', ' sim ', '', 'Não']).map((one) => one.key)).toEqual(['sim', 'nao']);
  });
});

describe('workflowTaskId', () => {
  it('é um por execução e por passo — a nova tentativa acha a mesma tarefa', () => {
    expect(workflowTaskId('ex1', 'aprovar')).toBe(workflowTaskId('ex1', 'aprovar'));
    expect(workflowTaskId('ex1', 'aprovar')).not.toBe(workflowTaskId('ex1', 'revisar'));
  });
});

describe('quórum de aprovação', () => {
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 13, 12, minute));
  const task = (quorum: number | undefined, voters = 3) => ({
    assigneeIds: Array.from({ length: voters }, (_, index) => `m${index}`),
    guestIds: [],
    outcomes: [{ key: 'approved', label: 'Aprovar' }, { key: 'rejected', label: 'Recusar' }, { key: 'revise', label: 'Revisar' }],
    quorum,
  });

  it('lê o quórum: vazio e any são 1; all é todo mundo; acima do número de pessoas é inválido', () => {
    expect(approvalQuorumOf('', 3)).toBe(1);
    expect(approvalQuorumOf('any', 3)).toBe(1);
    expect(approvalQuorumOf('all', 3)).toBe(3);
    expect(approvalQuorumOf('2', 3)).toBe(2);
    expect(approvalQuorumOf(2, 3)).toBe(2);
    expect(approvalQuorumOf('4', 3)).toBeNull();
    expect(approvalQuorumOf('dois', 3)).toBeNull();
  });

  it('sem quórum, o primeiro voto decide — qualquer que seja, como sempre foi', () => {
    expect(tallyApprovalVotes(task(undefined), { m0: { outcome: 'rejected', at: at(1) } })).toEqual({ closed: true, outcome: 'rejected' });
  });

  it('2 de 3: fecha aprovado no segundo voto de aprovar; um voto contra não fecha enquanto ainda dá', () => {
    const two = task(2);
    expect(tallyApprovalVotes(two, { m0: { outcome: 'rejected', at: at(1) } })).toEqual({ closed: false });
    expect(tallyApprovalVotes(two, { m0: { outcome: 'approved', at: at(1) }, m1: { outcome: 'approved', at: at(2) } }))
      .toEqual({ closed: true, outcome: 'approved' });
  });

  it('assim que atingir o quórum fica impossível, fecha com o outro desfecho mais votado', () => {
    expect(tallyApprovalVotes(task(2), { m0: { outcome: 'rejected', at: at(1) }, m1: { outcome: 'revise', at: at(2) } }))
      .toEqual({ closed: true, outcome: 'rejected' });
    expect(tallyApprovalVotes(task(2, 4), {
      m0: { outcome: 'revise', at: at(1) }, m1: { outcome: 'revise', at: at(2) }, m2: { outcome: 'rejected', at: at(3) },
    })).toEqual({ closed: true, outcome: 'revise' });
  });

  it('todos: uma recusa já fecha', () => {
    expect(tallyApprovalVotes(task(3), { m0: { outcome: 'approved', at: at(1) }, m1: { outcome: 'rejected', at: at(2) } }))
      .toEqual({ closed: true, outcome: 'rejected' });
  });

  it('convidados contam como quem pode votar', () => {
    const mixed = { ...task(2, 1), guestIds: ['g1'] };
    expect(tallyApprovalVotes(mixed, { m0: { outcome: 'approved', at: at(1) } })).toEqual({ closed: false });
    expect(tallyApprovalVotes(mixed, { m0: { outcome: 'approved', at: at(1) }, g1: { outcome: 'approved', at: at(2) } }))
      .toEqual({ closed: true, outcome: 'approved' });
  });
});

describe('lembrete de aprovação', () => {
  it('o intervalo: vazio, zero ou texto não lembram; acima de 30, 30; fração, para baixo', () => {
    expect(approvalRemindEveryOf(undefined)).toBeNull();
    expect(approvalRemindEveryOf('')).toBeNull();
    expect(approvalRemindEveryOf(0)).toBeNull();
    expect(approvalRemindEveryOf('dois')).toBeNull();
    expect(approvalRemindEveryOf(2)).toBe(2);
    expect(approvalRemindEveryOf('3')).toBe(3);
    expect(approvalRemindEveryOf(2.7)).toBe(2);
    expect(approvalRemindEveryOf(90)).toBe(30);
  });

  it('o próximo lembrete antes do prazo, e nenhum no prazo ou depois', () => {
    const from = new Date('2026-11-13T12:00:00Z');
    expect(nextApprovalReminder(from, 2, new Date('2026-11-20T12:00:00Z'))).toEqual(new Date('2026-11-15T12:00:00Z'));
    expect(nextApprovalReminder(from, 2, new Date('2026-11-15T12:00:00Z'))).toBeNull();
  });

  it('pendentes: quem ainda não votou, membros e convidados à parte', () => {
    expect(pendingTaskVoters({
      assigneeIds: ['ana', 'bia'], guestIds: ['cliente'],
      votes: { bia: { outcome: 'approved', name: 'Bia', at: new Date(), comment: '', via: 'member' } },
    })).toEqual({ members: ['ana'], guests: ['cliente'] });
  });
});

describe('repasse e escalonamento', () => {
  const task = { assigneeIds: ['ana', 'bia'], guestIds: ['cliente'], votes: {}, status: 'open' as const };

  it('o repasse troca quem repassa por quem recebe, no MESMO lugar', () => {
    expect(delegateTaskAssignees(task, 'ana', 'caio')).toEqual({ ok: true, assigneeIds: ['caio', 'bia'] });
  });

  it('recusa quem não está designado, quem já votou, a si mesmo, quem já decide e a tarefa fechada', () => {
    expect(delegateTaskAssignees(task, 'caio', 'davi')).toEqual({ ok: false, reason: 'not-assignee' });
    expect(delegateTaskAssignees({ ...task, votes: { ana: { outcome: 'approved', name: 'Ana', at: new Date(), comment: '', via: 'member' } } }, 'ana', 'caio'))
      .toEqual({ ok: false, reason: 'already-voted' });
    expect(delegateTaskAssignees(task, 'ana', 'ana')).toEqual({ ok: false, reason: 'same-person' });
    expect(delegateTaskAssignees(task, 'ana', 'bia')).toEqual({ ok: false, reason: 'already-assignee' });
    expect(delegateTaskAssignees(task, 'ana', 'cliente')).toEqual({ ok: false, reason: 'already-assignee' });
    expect(delegateTaskAssignees({ ...task, status: 'decided' }, 'ana', 'caio')).toEqual({ ok: false, reason: 'not-open' });
  });

  it('o escalonamento cai antes do prazo, ou não existe', () => {
    const from = new Date('2026-11-13T12:00:00Z');
    expect(approvalEscalationAt(from, 3, new Date('2026-11-20T12:00:00Z'))).toEqual(new Date('2026-11-16T12:00:00Z'));
    expect(approvalEscalationAt(from, 7, new Date('2026-11-20T12:00:00Z'))).toBeNull();
    expect(approvalEscalationAt(from, '', new Date('2026-11-20T12:00:00Z'))).toBeNull();
    expect(approvalEscalationAt(from, 0, new Date('2026-11-20T12:00:00Z'))).toBeNull();
  });
});

