import { describe, expect, it, vi } from 'vitest';
import { createInstallationGate } from './installationGate';

const event = (params: Record<string, string>): { params: Record<string, string> } => ({ params });

describe('o portão de instalação', () => {
  it('deixa o handler rodar no escritório que instalou a extensão', async () => {
    const handler = vi.fn();
    const guarded = createInstallationGate(async () => true)
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
    const guarded = createInstallationGate(async (tenantId) => tenantId === 'escritorio-b')
      .forInstalledExtension('com.acme.crm', handler);

    await guarded(event({ tenantId: 'escritorio-a' }));
    expect(handler).not.toHaveBeenCalled();

    await guarded(event({ tenantId: 'escritorio-b' }));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('nem no que nunca a instalou', async () => {
    const handler = vi.fn();
    const guarded = createInstallationGate(async () => false)
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
    const guarded = createInstallationGate(async () => true, { warn })
      .forInstalledExtension('com.acme.crm', handler);

    await guarded(event({ id: 'abc' }));
    expect(handler).not.toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toContain('com.acme.crm');
    expect(warn.mock.calls[0][0]).toContain('tenants/{tenantId}/');
  });

  it('o erro do handler continua sendo o erro da function', async () => {
    const guarded = createInstallationGate(async () => true)
      .forInstalledExtension('com.acme.crm', () => { throw new Error('boom'); });

    await expect(guarded(event({ tenantId: 'escritorio-a' }))).rejects.toThrow('boom');
  });
});

describe('o custo da pergunta', () => {
  it('uma rajada de gravações do mesmo escritório custa uma leitura só', async () => {
    const read = vi.fn(async () => true);
    const guarded = createInstallationGate(read, { now: () => 1_000 })
      .forInstalledExtension('com.acme.crm', () => {});

    for (let index = 0; index < 5; index += 1) await guarded(event({ tenantId: 'escritorio-a' }));
    expect(read).toHaveBeenCalledOnce();
  });

  it('escritórios diferentes são perguntas diferentes', async () => {
    const read = vi.fn(async () => true);
    const gate = createInstallationGate(read, { now: () => 1_000 });

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
    const gate = createInstallationGate(async () => installed, { ttlMs: 60_000, now: () => clock });

    expect(await gate.isExtensionInstalled('escritorio-a', 'com.acme.crm')).toBe(false);

    installed = true;
    clock = 59_000;
    expect(await gate.isExtensionInstalled('escritorio-a', 'com.acme.crm')).toBe(false);

    clock = 61_000;
    expect(await gate.isExtensionInstalled('escritorio-a', 'com.acme.crm')).toBe(true);
  });
});
