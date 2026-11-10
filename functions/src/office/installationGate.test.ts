import { describe, expect, it, vi } from 'vitest';
import { createInstallationGate } from './installationGate';
import type {
  CallerReader,
  GateOptions,
  InstallationGate,
  InstallationReader,
  OfficeReader,
  PermissionReader,
} from './installationGate';

const event = (params: Record<string, string>): { params: Record<string, string> } => ({ params });

/**
 * O portão tem duas leituras, e quase todo caso aqui só se importa com uma. `offices` responde vazio por
 * omissão para que um caso sobre o gatilho não precise falar do laço, e vice-versa.
 */
const gateWith = (
  installed: InstallationReader,
  extra: { offices?: OfficeReader; caller?: CallerReader; permission?: PermissionReader } & GateOptions = {},
): InstallationGate => {
  const { offices, caller, permission, ...options } = extra;
  return createInstallationGate({
    installed,
    offices: offices ?? (async () => []),
    // Membro por omissão: quase todo caso aqui é sobre a instalação, e não sobre quem chamou.
    caller: caller ?? (async () => true),
    permission: permission ?? (async () => []),
  }, options);
};

describe('o portão de instalação', () => {
  it('deixa o handler rodar no escritório que instalou a extensão', async () => {
    const handler = vi.fn();
    const guarded = gateWith(async () => true)
      .forInstalledExtension('com.acme.crm', handler);

    await guarded(event({ tenantId: 'escritorio-a' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  /**
   * O caso que a remoção da function nunca alcança: o escritório B mantém a extensão, então ela
   * CONTINUA no ar — e sem o portão o gatilho dela roda sobre os dados do escritório A do mesmo jeito.
   */
  it('não deixa rodar no escritório que desinstalou, mesmo com a function no ar', async () => {
    const handler = vi.fn();
    const guarded = gateWith(async (tenantId) => tenantId === 'escritorio-b')
      .forInstalledExtension('com.acme.crm', handler);

    await guarded(event({ tenantId: 'escritorio-a' }));
    expect(handler).not.toHaveBeenCalled();

    await guarded(event({ tenantId: 'escritorio-b' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('nem no que nunca a instalou', async () => {
    const handler = vi.fn();
    const guarded = gateWith(async () => false)
      .forInstalledExtension('com.acme.crm', handler);

    await guarded(event({ tenantId: 'escritorio-c' }));
    expect(handler).not.toHaveBeenCalled();
  });

  /**
   * Sem escritório no caminho não há instalação que se possa conferir, e correr assim mesmo seria rodar
   * o código de uma extensão contra dados de quem quer que fosse.
   */
  it('falha fechada quando o evento não traz escritório, e diz por quê', async () => {
    const handler = vi.fn();
    const warn = vi.fn();
    const guarded = gateWith(async () => true, { warn })
      .forInstalledExtension('com.acme.crm', handler);

    await guarded(event({ id: 'abc' }));
    expect(handler).not.toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain('com.acme.crm');
    expect(warn.mock.calls[0][0]).toContain('tenants/{tenantId}/');
  });

  it('o erro do handler continua sendo o erro da function', async () => {
    const guarded = gateWith(async () => true)
      .forInstalledExtension('com.acme.crm', () => { throw new Error('boom'); });

    await expect(guarded(event({ tenantId: 'escritorio-a' }))).rejects.toThrow('boom');
  });
});

describe('o custo da pergunta', () => {
  it('uma rajada de gravações do mesmo escritório custa uma leitura só', async () => {
    const read = vi.fn(async () => true);
    const guarded = gateWith(read, { now: () => 1_000 })
      .forInstalledExtension('com.acme.crm', () => {});

    for (let index = 0; index < 5; index += 1) await guarded(event({ tenantId: 'escritorio-a' }));
    expect(read).toHaveBeenCalledOnce();
  });

  it('escritórios diferentes são perguntas diferentes', async () => {
    const read = vi.fn(async () => true);
    const gate = gateWith(read, { now: () => 1_000 });

    await gate.isExtensionInstalled('escritorio-a', 'com.acme.crm');
    await gate.isExtensionInstalled('escritorio-b', 'com.acme.crm');
    await gate.isExtensionInstalled('escritorio-a', 'com.acme.crm');
    expect(read).toHaveBeenCalledTimes(2);
  });

  /**
   * A resposta NEGATIVA expira como a positiva. Guardá-la para sempre economizaria leituras e faria uma
   * extensão recém-instalada não funcionar até a instância reciclar — que é o defeito mais caro de
   * diagnosticar que este mecanismo poderia produzir.
   */
  it('a resposta expira, e a instalação nova passa a valer', async () => {
    let installed = false;
    let clock = 0;
    const gate = gateWith(async () => installed, { ttlMs: 60_000, now: () => clock });

    expect(await gate.isExtensionInstalled('escritorio-a', 'com.acme.crm')).toBe(false);

    installed = true;
    clock = 59_000;
    expect(await gate.isExtensionInstalled('escritorio-a', 'com.acme.crm')).toBe(false);

    clock = 61_000;
    expect(await gate.isExtensionInstalled('escritorio-a', 'com.acme.crm')).toBe(true);
  });
});

/**
 * O laço por escritório é a resposta ao evento que NÃO tem escritório no caminho — o agendado, a
 * mensagem de fila, a requisição HTTP, o evento de Storage. Sem ele, as duas saídas do autor eram
 * erradas: sem portão a function age sobre o projeto inteiro; COM portão ela nunca roda, porque ele
 * falha fechado e nunca acha o `{tenantId}` que não existe.
 */
describe('o laço por escritório instalado', () => {
  const threeOffices: OfficeReader = async () => ['a', 'b', 'c'];

  it('roda uma vez em cada escritório que instalou, e diz em quantos rodou', async () => {
    const seen: string[] = [];
    const ran = await gateWith(async (tenantId) => tenantId !== 'b', { offices: threeOffices })
      .forEachInstalledOffice('com.acme.crm', (tenantId) => { seen.push(tenantId); });

    expect(seen).toEqual(['a', 'c']);
    expect(ran).toBe(2);
  });

  it('não roda em escritório nenhum quando ninguém instalou', async () => {
    const handler = vi.fn();
    const ran = await gateWith(async () => false, { offices: threeOffices })
      .forEachInstalledOffice('com.acme.crm', handler);

    expect(handler).not.toHaveBeenCalled();
    expect(ran).toBe(0);
  });

  it('um projeto sem escritório nenhum não é erro, é zero', async () => {
    expect(await gateWith(async () => true).forEachInstalledOffice('com.acme.crm', vi.fn())).toBe(0);
  });

  /**
   * Parar no primeiro erro faria um dado ruim num escritório suspender a rotina de todos os demais, em
   * silêncio. Engolir o erro faria a rotina "passar" para sempre. As duas coisas juntas são o devido.
   */
  it('o erro de um escritório não tira o turno dos outros — e a function falha no fim', async () => {
    const seen: string[] = [];
    const loop = gateWith(async () => true, { offices: threeOffices })
      .forEachInstalledOffice('com.acme.crm', (tenantId) => {
        seen.push(tenantId);
        if (tenantId === 'b') throw new Error('registro ruim');
      });

    await expect(loop).rejects.toThrow(/failed in 1 of the 3/);
    expect(seen).toEqual(['a', 'b', 'c']);
  });

  it('a falha nomeia o escritório e o motivo, que é o que o log precisa ter', async () => {
    const loop = gateWith(async () => true, { offices: threeOffices })
      .forEachInstalledOffice('com.acme.crm', (tenantId) => {
        if (tenantId !== 'a') throw new Error(`quebrou em ${tenantId}`);
      });

    await expect(loop).rejects.toThrow(/com\.acme\.crm/);
    await expect(loop).rejects.toThrow(/b: quebrou em b/);
    await expect(loop).rejects.toThrow(/c: quebrou em c/);
  });

  /** Uma pergunta por escritório por execução, e a mesma pergunta que o gatilho faz — um cache só. */
  it('pergunta pela instalação pelo mesmo caminho do gatilho, reusando o cache', async () => {
    const read = vi.fn(async () => true);
    const gate = gateWith(read, { offices: threeOffices, now: () => 1_000 });

    await gate.forEachInstalledOffice('com.acme.crm', vi.fn());
    await gate.forEachInstalledOffice('com.acme.crm', vi.fn());

    expect(read).toHaveBeenCalledTimes(3);
  });
});

/**
 * O portão da function COMUM — a de `functions/`, que serve várias extensões. A pergunta ali não é "esta
 * extensão está instalada?", é "ALGUMA das que esta function serve está?", e sem uma resposta na
 * plataforma cada autor decidia sozinho a semântica — com a resposta errada sendo invisível: a function
 * para de agir, ou passa a agir onde não devia.
 */
describe('o portão da function comum a várias extensões', () => {
  const SERVES = ['com.acme.crm', 'com.acme.billing'];

  it('roda quando qualquer uma das extensões que ela serve está instalada', async () => {
    const handler = vi.fn();
    const guarded = gateWith(async (_tenantId, pluginId) => pluginId === 'com.acme.billing')
      .forAnyInstalledExtension(SERVES, handler);

    await guarded(event({ tenantId: 'escritorio-a' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  /**
   * "Basta uma" é a única regra que faz sentido: a function existe porque mais de uma extensão precisa
   * dela. Exigir todas faria desinstalar UMA desligar o comportamento das outras.
   */
  it('roda uma vez só, mesmo com as duas instaladas', async () => {
    const handler = vi.fn();
    const guarded = gateWith(async () => true).forAnyInstalledExtension(SERVES, handler);

    await guarded(event({ tenantId: 'escritorio-a' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('não roda no escritório que não tem nenhuma delas', async () => {
    const handler = vi.fn();
    const guarded = gateWith(async () => false).forAnyInstalledExtension(SERVES, handler);

    await guarded(event({ tenantId: 'escritorio-c' }));
    expect(handler).not.toHaveBeenCalled();
  });

  /** Para na primeira resposta positiva: a segunda leitura não responderia nada que mudasse a decisão. */
  it('para de perguntar na primeira instalada', async () => {
    const read = vi.fn(async () => true);
    const guarded = gateWith(read).forAnyInstalledExtension(SERVES, vi.fn());

    await guarded(event({ tenantId: 'escritorio-a' }));
    expect(read).toHaveBeenCalledOnce();
  });

  it('falha fechada quando o evento não traz escritório, e diz por quê', async () => {
    const handler = vi.fn();
    const warn = vi.fn();
    const guarded = gateWith(async () => true, { warn }).forAnyInstalledExtension(SERVES, handler);

    await guarded(event({ id: 'abc' }));
    expect(handler).not.toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain('com.acme.crm, com.acme.billing');
    expect(warn.mock.calls[0][0]).toContain('tenants/{tenantId}/');
  });

  it('uma lista vazia não roda em lugar nenhum, em vez de rodar em todos', async () => {
    const handler = vi.fn();
    await gateWith(async () => true).forAnyInstalledExtension([], handler)(event({ tenantId: 'a' }));
    expect(handler).not.toHaveBeenCalled();
  });
});

/**
 * As três recusas de uma callable de extensão.
 *
 * "Uma callable órfã é inerte" era verdade de INTERFACE, e não de segurança: o deploy concede a
 * `allUsers` o papel `roles/run.invoker` em cada callable, e o que sobra é a validação do token do
 * Firebase. A tela ir embora com a extensão não fecha nada — o endpoint segue aceitando o token de
 * qualquer usuário do projeto, e o escritório vem no payload.
 */
describe('as recusas de uma callable de extensão', () => {
  const request = (uid?: string) => (uid === undefined ? {} : { auth: { uid } });

  it('devolve o uid de quem chamou quando as três respostas são sim', async () => {
    const uid = await gateWith(async () => true)
      .requireInstalledExtension('com.acme.crm', 'escritorio-a', request('u1'));

    expect(uid).toBe('u1');
  });

  it('recusa a chamada sem autenticação', async () => {
    await expect(
      gateWith(async () => true).requireInstalledExtension('com.acme.crm', 'a', request()),
    ).rejects.toThrow(/office\.unauthenticated/);
  });

  /**
   * É a recusa que fecha o buraco de verdade: a callable aceita o token de qualquer usuário do projeto,
   * e o escritório chega no payload. Sem ela, um usuário do escritório A aponta para o B.
   */
  it('recusa quem entrou mas não é do escritório apontado no payload', async () => {
    await expect(
      gateWith(async () => true, { caller: async () => false })
        .requireInstalledExtension('com.acme.crm', 'escritorio-b', request('u1')),
    ).rejects.toThrow(/office\.not-member/);
  });

  it('recusa o escritório que não tem a extensão, nomeando qual', async () => {
    const call = gateWith(async () => false)
      .requireInstalledExtension('com.acme.crm', 'escritorio-a', request('u1'));

    await expect(call).rejects.toThrow(/extension\.not-installed/);
  });

  /** A ordem importa: não se diz a um estranho se a extensão está instalada naquele escritório. */
  it('a recusa de escritório vem ANTES da pergunta sobre a instalação', async () => {
    const read = vi.fn(async () => true);
    const call = gateWith(read, { caller: async () => false })
      .requireInstalledExtension('com.acme.crm', 'escritorio-b', request('u1'));

    await expect(call).rejects.toThrow(/office\.not-member/);
    expect(read).not.toHaveBeenCalled();
  });

  it('reusa o cache da instalação, como o gatilho e o laço', async () => {
    const read = vi.fn(async () => true);
    const gate = gateWith(read, { now: () => 1_000 });

    await gate.requireInstalledExtension('com.acme.crm', 'a', request('u1'));
    await gate.requireInstalledExtension('com.acme.crm', 'a', request('u1'));

    expect(read).toHaveBeenCalledOnce();
  });
});

/**
 * A quarta recusa: a permissão que a callable cobra. Quem responde é `requirePermission` (injetado aqui);
 * o que se prova neste nível é ONDE ela entra no portão. A regra em si é provada em `index.test.ts`,
 * contra a implementação de verdade.
 */
describe('a permissão cobrada por uma callable de extensão', () => {
  const request = { auth: { uid: 'u1', token: { mfaAt: 1 } } };
  const refuse: PermissionReader = async () => {
    throw new Error('@core.access/permission.denied');
  };

  it('pergunta a permissão com quem chamou, a sessão e o escritório', async () => {
    const permission = vi.fn(async () => []);
    const uid = await gateWith(async () => true, { permission })
      .requireInstalledExtension('com.acme.crm', 'escritorio-a', request, { permission: 'invoices.approve' });

    expect(uid).toBe('u1');
    expect(permission).toHaveBeenCalledWith(
      'escritorio-a',
      { uid: 'u1', token: { mfaAt: 1 } },
      'invoices.approve',
    );
  });

  it('propaga a recusa de permissão, sem trocá-la por outra', async () => {
    const call = gateWith(async () => true, { permission: refuse })
      .requireInstalledExtension('com.acme.crm', 'a', request, { permission: 'invoices.approve' });

    await expect(call).rejects.toThrow(/permission\.denied/);
  });

  /** A permissão é a mais estrita das duas perguntas: perguntar as duas leria o membro duas vezes. */
  it('com permissão, não faz a pergunta de membro', async () => {
    const caller = vi.fn(async () => true);
    await gateWith(async () => true, { caller })
      .requireInstalledExtension('com.acme.crm', 'a', request, { permission: 'invoices.approve' });

    expect(caller).not.toHaveBeenCalled();
  });

  it('sem permissão pedida, não pergunta permissão nenhuma', async () => {
    const permission = vi.fn(async () => []);
    await gateWith(async () => true, { permission }).requireInstalledExtension('com.acme.crm', 'a', request);

    expect(permission).not.toHaveBeenCalled();
  });

  it('a recusa de permissão vem ANTES da pergunta sobre a instalação', async () => {
    const read = vi.fn(async () => true);
    const call = gateWith(read, { permission: refuse })
      .requireInstalledExtension('com.acme.crm', 'a', request, { permission: 'invoices.approve' });

    await expect(call).rejects.toThrow(/permission\.denied/);
    expect(read).not.toHaveBeenCalled();
  });

  it('com a permissão concedida, ainda recusa o escritório sem a extensão', async () => {
    const call = gateWith(async () => false)
      .requireInstalledExtension('com.acme.crm', 'a', request, { permission: 'invoices.approve' });

    await expect(call).rejects.toThrow(/extension\.not-installed/);
  });

  it('a chamada sem autenticação é recusada antes de perguntar a permissão', async () => {
    const permission = vi.fn(async () => []);
    const call = gateWith(async () => true, { permission })
      .requireInstalledExtension('com.acme.crm', 'a', {}, { permission: 'invoices.approve' });

    await expect(call).rejects.toThrow(/office\.unauthenticated/);
    expect(permission).not.toHaveBeenCalled();
  });

  /**
   * Vazia, ela deixaria passar só o dono e o `SYSTEM` — que passam por qualquer pergunta — e recusaria
   * todo o resto. É erro de quem escreveu a function, e aparece antes de qualquer leitura.
   */
  it.each(['', '   ', undefined, 42])('recusa a permissão inválida (%j) sem ler nada', async (value) => {
    const permission = vi.fn(async () => []);
    const read = vi.fn(async () => true);
    const call = gateWith(read, { permission })
      .requireInstalledExtension('com.acme.crm', 'a', request, { permission: value as string });

    await expect(call).rejects.toThrow(/com\.acme\.crm.*requireInstalledExtension/);
    expect(permission).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });
});
