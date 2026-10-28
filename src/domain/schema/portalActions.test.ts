import { describe, expect, it } from 'vitest';
import {
  asPortalDeclaration,
  portalActionIssues,
  portalActionState,
  portalDeclarationIssues,
  portalOfferableActions,
  portalRecordActions,
  type PortalActionLike,
  type PortalActionScope,
  type PortalScreenLike,
} from './portal';

const action = (id: string, key: string, extra: Partial<PortalActionLike> = {}): PortalActionLike => ({
  id, key, workflowId: `wf-${key}`, enabled: true, ...extra,
});

const ACTIONS: PortalActionLike[] = [
  action('a1', 'accept', { hiddenWhen: 'accepted == true' }),
  action('a2', 'archive'),
  action('a3', 'copy', { command: 'copyLink', workflowId: null }),
  action('a4', 'ask', { promptParameters: true }),
  action('a5', 'off', { enabled: false }),
  action('a6', 'elsewhere'),
];

const mailbox = (actions: string[] | undefined, viewActionIds = ['a1', 'a2', 'a3', 'a4', 'a5']): PortalScreenLike => ({
  id: 'mailboxes',
  collection: 'mailboxes',
  titleFieldKey: 'name',
  fields: [{ key: 'name', type: 'text' }, { key: 'accepted', type: 'boolean' }],
  viewActionIds,
  portal: { subject: 'self', fields: ['name'], ...(actions ? { actions } : {}) },
});

const scope = (record: Record<string, unknown>, extra: Partial<PortalActionScope> = {}): PortalActionScope => ({
  record, collection: 'mailboxes', guest: { id: 'ana', name: 'Ana' }, ...extra,
});

describe('declaração das ações do portal — portal.actions', () => {
  it('lê as chaves, aparadas e sem repetição; vazia ou malformada é ausente', () => {
    expect(asPortalDeclaration({ subject: 'self', fields: [], actions: [' accept ', 'accept', 3, ''] })?.actions).toEqual(['accept']);
    expect(asPortalDeclaration({ subject: 'self', fields: [], actions: [] })).not.toHaveProperty('actions');
    expect(asPortalDeclaration({ subject: 'self', fields: [], actions: 'accept' })).not.toHaveProperty('actions');
  });

  it('a tela que não declara não oferece nada — quem não usa o recurso não vê diferença', () => {
    expect(portalRecordActions(mailbox(undefined), ACTIONS)).toEqual([]);
  });
});

describe('quais ações chegam ao convidado', () => {
  it('só as declaradas, na ordem da declaração, entre as do cabeçalho do registro', () => {
    const screen = mailbox(['archive', 'accept']);
    expect(portalRecordActions(screen, ACTIONS).map((one) => one.id)).toEqual(['a2', 'a1']);
  });

  it('a ação fora do cabeçalho do registro não chega, mesmo com a chave declarada', () => {
    expect(portalRecordActions(mailbox(['elsewhere']), ACTIONS)).toEqual([]);
  });

  it('comando de tela, ação que pergunta parâmetros e ação desligada não chegam', () => {
    expect(portalRecordActions(mailbox(['copy', 'ask', 'off']), ACTIONS)).toEqual([]);
  });

  it('duas ações do cabeçalho com a mesma chave: vale a primeira, como no escritório', () => {
    const twin = action('a9', 'accept');
    expect(portalRecordActions(mailbox(['accept'], ['a9', 'a1']), [...ACTIONS, twin]).map((one) => one.id)).toEqual(['a9']);
  });

  it('o escritório escolhe entre as que servem ao portal, na ordem do cabeçalho', () => {
    expect(portalOfferableActions(mailbox(undefined), ACTIONS).map((one) => one.key)).toEqual(['accept', 'archive']);
  });
});

describe('estado da ação para o convidado — avaliado no servidor', () => {
  it('a condição vale sobre o registro inteiro, inclusive o campo que não sai do escritório', () => {
    const accept = ACTIONS[0];
    expect(portalActionState(accept, scope({ name: 'Ana', accepted: true }))).toBe('hidden');
    expect(portalActionState(accept, scope({ name: 'Ana', accepted: false }))).toBe('enabled');
  });

  it('o campo citado que o registro não tem vale vazio, e não fecha por um nome desconhecido', () => {
    expect(portalActionState(ACTIONS[0], scope({ name: 'Ana' }))).toBe('enabled');
    expect(portalActionState(action('x', 'x', { disabledWhen: 'acceptedAt != null' }), scope({}))).toBe('enabled');
  });

  it('enxerga surface == "portal": a mesma ação pode valer só no portal, ou só no escritório', () => {
    expect(portalActionState(action('x', 'x', { hiddenWhen: 'surface != "portal"' }), scope({}))).toBe('enabled');
    expect(portalActionState(action('x', 'x', { hiddenWhen: 'surface == "portal"' }), scope({}))).toBe('hidden');
  });

  it('o convidado não tem permissão nenhuma, e é ele o usuário da expressão', () => {
    expect(portalActionState(action('x', 'x', { hiddenWhen: '!hasPermission("mailboxes.update")' }), scope({}))).toBe('hidden');
    expect(portalActionState(action('x', 'x', { disabledWhen: 'user.id != ownerId' }), scope({ ownerId: 'ana' }))).toBe('enabled');
    expect(portalActionState(action('x', 'x', { disabledWhen: 'user.id != ownerId' }), scope({ ownerId: 'bia' }))).toBe('disabled');
  });

  it('a expressão que estoura FECHA — escondida antes de desabilitada', () => {
    expect(portalActionState(action('x', 'x', { hiddenWhen: '((' }), scope({}))).toBe('hidden');
    expect(portalActionState(action('x', 'x', { disabledWhen: '((' }), scope({}))).toBe('disabled');
  });
});

describe('conferência da declaração', () => {
  it('cada chave que não chegaria ao convidado vira um aviso, com o motivo', () => {
    const issues = portalActionIssues(mailbox(['accept', 'elsewhere', 'copy', 'ask', 'off']), ACTIONS);
    expect(issues).toEqual([
      { message: '@core.records/portal.issue.action.unknown', messageParams: { action: 'elsewhere' } },
      { message: '@core.records/portal.issue.action.not-runnable', messageParams: { action: 'copy' } },
      { message: '@core.records/portal.issue.action.prompts', messageParams: { action: 'ask' } },
      { message: '@core.records/portal.issue.action.disabled', messageParams: { action: 'off' } },
    ]);
  });

  it('a conferência geral só olha as ações quando as recebe', () => {
    const screen = mailbox(['elsewhere']);
    expect(portalDeclarationIssues(screen, [screen])).toEqual([]);
    expect(portalDeclarationIssues(screen, [screen], ACTIONS).map((issue) => issue.message))
      .toEqual(['@core.records/portal.issue.action.unknown']);
  });
});
