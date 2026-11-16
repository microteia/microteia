import { describe, expect, it, vi } from 'vitest';
import { makeStageOfficeDefaultsUseCase } from './StageOfficeDefaultsUseCase';
import type { IOfficeDefaultsRepository, OfficeDefaultsIntent } from '../repositories/IOfficeDefaultsRepository';

const setup = (intent: Partial<OfficeDefaultsIntent>, over: Partial<IOfficeDefaultsRepository> = {}) => {
  const order: string[] = [];
  const defaults = {
    readIntent: vi.fn(async () => ({ locale: null, extensions: [], ...intent })),
    readCatalog: vi.fn(async (ids: readonly string[]) => ids.map((id) => ({ id, status: 'approved', proven: true }))),
    setLocale: vi.fn(async (_tenantId: string, locale: string) => { order.push(`locale:${locale}`); }),
    stage: vi.fn(async (_tenantId: string, pending: readonly string[]) => { order.push(`stage:${pending.join(',')}`); }),
    ...over,
  } satisfies IOfficeDefaultsRepository;
  const logger = { error: vi.fn() };
  return { useCase: makeStageOfficeDefaultsUseCase({ defaults, logger }), defaults, logger, order };
};

describe('StageOfficeDefaultsUseCase — extensões padrão', () => {
  it('grava o plano do escritório novo', async () => {
    const { useCase, defaults } = setup({ extensions: ['com.acme.a', 'com.acme.b'] });
    await useCase.execute('t1');
    expect(defaults.stage).toHaveBeenCalledWith('t1', ['com.acme.a', 'com.acme.b']);
  });

  it('sem padrão nenhuma, não grava documento — e nem lê o catálogo', async () => {
    const { useCase, defaults } = setup({});
    await useCase.execute('t1');
    expect(defaults.readCatalog).not.toHaveBeenCalled();
    expect(defaults.stage).not.toHaveBeenCalled();
  });

  it('marcada, mas obsoleta no catálogo: nada a gravar', async () => {
    const { useCase, defaults } = setup(
      { extensions: ['com.acme.a'] },
      { readCatalog: vi.fn(async () => [{ id: 'com.acme.a', status: 'deprecated', proven: true }]) },
    );
    await useCase.execute('t1');
    expect(defaults.stage).not.toHaveBeenCalled();
  });

  it('fora do catálogo é embutida: entra na lista, antes das do catálogo', async () => {
    const { useCase, defaults } = setup(
      { extensions: ['com.acme.a', 'com.microteia.locale-pt-br'] },
      { readCatalog: vi.fn(async () => [{ id: 'com.acme.a', status: 'approved', proven: true }]) },
    );
    await useCase.execute('t1');
    expect(defaults.stage).toHaveBeenCalledWith('t1', ['com.microteia.locale-pt-br', 'com.acme.a']);
  });

  it('a falha não impede o escritório de nascer: vai para o log', async () => {
    const { useCase, logger } = setup({ extensions: ['com.acme.a'] }, { stage: vi.fn(async () => { throw new Error('boom'); }) });
    await expect(useCase.execute('t1')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });
});

describe('StageOfficeDefaultsUseCase — idioma do escritório novo', () => {
  it('o idioma é gravado ANTES da lista: a primeira semente já sai nele', async () => {
    const { useCase, order } = setup({ locale: 'pt-BR', extensions: ['com.acme.a'] });
    await useCase.execute('t1');
    expect(order).toEqual(['locale:pt-BR', 'stage:com.acme.a']);
  });

  it('sem idioma decidido, as configurações do escritório não são tocadas', async () => {
    const { useCase, defaults } = setup({ extensions: ['com.acme.a'] });
    await useCase.execute('t1');
    expect(defaults.setLocale).not.toHaveBeenCalled();
  });

  it('idioma sem extensão padrão nenhuma também é gravado', async () => {
    const { useCase, order } = setup({ locale: 'es' });
    await useCase.execute('t1');
    expect(order).toEqual(['locale:es']);
  });

  it('a falha no idioma não impede as extensões', async () => {
    const { useCase, defaults, logger } = setup(
      { locale: 'pt-BR', extensions: ['com.acme.a'] },
      { setLocale: vi.fn(async () => { throw new Error('sem idioma'); }) },
    );
    await useCase.execute('t1');
    expect(defaults.stage).toHaveBeenCalledWith('t1', ['com.acme.a']);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('sem idioma'));
  });

  it('sem conseguir ler o que a instalação decidiu, o escritório nasce assim mesmo', async () => {
    const { useCase, defaults, logger } = setup({}, { readIntent: vi.fn(async () => { throw new Error('offline'); }) });
    await expect(useCase.execute('t1')).resolves.toBeUndefined();
    expect(defaults.stage).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('offline'));
  });
});
