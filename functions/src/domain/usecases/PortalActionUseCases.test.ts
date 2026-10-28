import { describe, expect, it } from 'vitest';
import {
  makeListPortalRecordActionsUseCase,
  makeRunPortalRecordActionUseCase,
  type PortalActionRunner,
} from './PortalActionUseCases';
import { makeProjectPortalRecordUseCase } from './PortalProjectionUseCases';
import { CITY_SCREENS, makeFakePortalRepository } from '../repositories/fakePortalRepository';
import type { PortalActionDefinition, PortalScreen } from '../repositories/IPortalRepository';

const TENANT = 'salvador';

const definition = (id: string, key: string, extra: Partial<PortalActionDefinition> = {}): PortalActionDefinition => ({
  id,
  key,
  title: `@dte/action.${key}`,
  icon: 'check',
  workflowId: `wf-${key}`,
  enabled: true,
  confirmMessage: null,
  danger: false,
  ...extra,
});

/** A empresa oferece "aceitar" (some depois do aceite) e "pedir contato"; "arquivar" é só do escritório. */
const screensWith = (actions: string[] | null): PortalScreen[] => CITY_SCREENS.map((screen) => (
  screen.id === 'companies'
    ? {
      ...screen,
      fields: [...screen.fields, { key: 'accepted', label: 'accepted', type: 'boolean' }],
      viewActionIds: ['act-accept', 'act-contact', 'act-archive'],
      portal: { ...screen.portal!, ...(actions ? { actions } : {}) },
    }
    : screen
));

const resolve = (value: string) => value.replace('@dte/', '');

const setup = async (actions: string[] | null = ['accept', 'contact']) => {
  const fake = makeFakePortalRepository(screensWith(actions));
  fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
  fake.users.set('bia', { userId: 'bia', email: 'bia@globex.com', displayName: 'Bia', subjectKeys: ['companies/globex'] });
  fake.actions.set('act-accept', definition('act-accept', 'accept', {
    hiddenWhen: 'accepted == true', confirmMessage: '@dte/action.accept.confirm',
  }));
  fake.actions.set('act-contact', definition('act-contact', 'contact', { disabledWhen: 'accepted != true' }));
  fake.actions.set('act-archive', definition('act-archive', 'archive'));
  const company = { name: 'Acme', taxId: '123' };
  fake.records.set('companies/acme', company);
  await makeProjectPortalRecordUseCase(fake.repo).execute({ tenantId: TENANT, collection: 'companies', recordId: 'acme', data: company });

  const calls: Array<Parameters<PortalActionRunner>[0]> = [];
  let reply: Awaited<ReturnType<PortalActionRunner>> = { ok: true, outputs: { status: ['SUCCESS', '@dte/accepted'] } };
  const run: PortalActionRunner = async (input) => {
    calls.push(input);
    if (reply.ok) fake.records.set('companies/acme', { ...fake.records.get('companies/acme'), accepted: true });
    return reply;
  };
  return {
    fake,
    calls,
    answer: (next: typeof reply) => { reply = next; },
    list: makeListPortalRecordActionsUseCase(fake.repo),
    run: makeRunPortalRecordActionUseCase(fake.repo, run),
  };
};

const OPEN = { tenantId: TENANT, userId: 'ana', projectionId: 'companies__acme', resolve };

describe('ações do escritório no portal — os botões', () => {
  it('desenha as declaradas, já traduzidas, com o estado que o registro inteiro dá a elas', async () => {
    const { list } = await setup();
    expect(await list.execute(OPEN)).toEqual([
      { id: 'act-accept', title: 'action.accept', icon: 'check', confirmMessage: 'action.accept.confirm', danger: false, disabled: false },
      { id: 'act-contact', title: 'action.contact', icon: 'check', confirmMessage: null, danger: false, disabled: true },
    ]);
  });

  it('a tela que não declara recusa sem ler ação nenhuma', async () => {
    const { list } = await setup(null);
    await expect(list.execute(OPEN)).rejects.toThrow('@core.tenant/portal.action.unavailable');
  });

  it('quem não enxerga o registro é recusado com a frase de sempre', async () => {
    const { list } = await setup();
    await expect(list.execute({ ...OPEN, userId: 'bia' })).rejects.toThrow('@core.tenant/portal.action.unavailable');
    await expect(list.execute({ ...OPEN, userId: 'ninguem' })).rejects.toThrow('@core.tenant/portal.action.unavailable');
  });

  it('o convite revogado vale no instante, antes de o gatilho refazer o audience', async () => {
    const { list, fake } = await setup();
    fake.users.set('ana', { ...fake.users.get('ana')!, subjectKeys: [] });
    await expect(list.execute(OPEN)).rejects.toThrow('@core.tenant/portal.action.unavailable');
  });
});

describe('ações do escritório no portal — executar', () => {
  it('roda o fluxo com o contexto lido do registro gravado, e devolve só o status e os botões refeitos', async () => {
    const { run, calls } = await setup();
    const outcome = await run.execute({ ...OPEN, actionId: 'act-accept' });
    expect(calls).toEqual([{
      tenantId: TENANT,
      userId: 'ana',
      workflowId: 'wf-accept',
      params: { action: 'accept', source: 'companies', context: { name: 'Acme', taxId: '123' }, recordId: 'acme', isNew: false },
    }]);
    expect(outcome.status).toEqual({ code: 'SUCCESS', message: 'accepted' });
    // O aceite gravado esconde "aceitar" e libera "pedir contato".
    expect(outcome.actions.map((one) => [one.id, one.disabled])).toEqual([['act-contact', false]]);
  });

  it('o result e os comandos do fluxo não saem do escritório', async () => {
    const { run, answer } = await setup();
    answer({ ok: true, outputs: { result: { taxId: 'segredo' }, actions: ['merge', 'save'], status: 'SUCCESS' } });
    const outcome = await run.execute({ ...OPEN, actionId: 'act-accept' });
    expect(outcome).toEqual({ status: { code: 'SUCCESS', message: '' }, actions: expect.any(Array) });
  });

  it('a ação desabilitada ou escondida AGORA não roda, ainda que o botão tenha sido desenhado antes', async () => {
    const { run, calls, fake } = await setup();
    await expect(run.execute({ ...OPEN, actionId: 'act-contact' })).rejects.toThrow('@core.tenant/portal.action.unavailable');
    fake.records.set('companies/acme', { name: 'Acme', accepted: true });
    await expect(run.execute({ ...OPEN, actionId: 'act-accept' })).rejects.toThrow('@core.tenant/portal.action.unavailable');
    expect(calls).toHaveLength(0);
  });

  it('a ação do registro que a tela não oferece ao portal não roda pelo id', async () => {
    const { run, calls } = await setup();
    await expect(run.execute({ ...OPEN, actionId: 'act-archive' })).rejects.toThrow('@core.tenant/portal.action.unavailable');
    expect(calls).toHaveLength(0);
  });

  it('o fluxo que falha volta como erro SEM mensagem — a casca diz a frase no idioma do convidado', async () => {
    const { run, answer } = await setup();
    answer({ ok: false });
    const outcome = await run.execute({ ...OPEN, actionId: 'act-accept' });
    expect(outcome.status).toEqual({ code: 'ERROR', message: '' });
  });
});
