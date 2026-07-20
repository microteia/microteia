import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViaCepLookupService } from './ViaCepLookupService';

const service = new ViaCepLookupService();

const mockFetch = (impl: () => unknown): void => {
  vi.stubGlobal('fetch', vi.fn(async () => impl() as Response));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ViaCepLookupService', () => {
  it('mapeia a resposta do ViaCEP para as chaves do endereço', async () => {
    mockFetch(() => ({
      ok: true,
      json: async () => ({ logradouro: 'Av. Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' }),
    }));

    const result = await service.lookup('01310-100');
    expect(result.ok).toBe(true);
    expect(result.values).toEqual({
      street: 'Av. Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
  });

  it('omite as chaves que vieram vazias, para não apagar o que o usuário digitou', async () => {
    mockFetch(() => ({
      ok: true,
      json: async () => ({ logradouro: '', bairro: '', localidade: 'Brasília', uf: 'DF' }),
    }));

    const result = await service.lookup('70000000');
    expect(result.values).toEqual({ city: 'Brasília', state: 'DF' });
  });

  it('trata o CEP inexistente sinalizado por `erro`', async () => {
    mockFetch(() => ({ ok: true, json: async () => ({ erro: true }) }));

    const result = await service.lookup('00000000');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('CEP não encontrado');
  });

  it('trata falha HTTP sem lançar', async () => {
    mockFetch(() => ({ ok: false, json: async () => ({}) }));

    const result = await service.lookup('01310100');
    expect(result.ok).toBe(false);
    expect(result.values).toEqual({});
  });

  it('trata exceção de rede sem lançar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    const result = await service.lookup('01310100');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('não consulta enquanto o CEP está incompleto', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);

    const result = await service.lookup('0131');
    expect(spy).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('aceita o CEP com máscara', async () => {
    const spy = vi.fn(async () => ({ ok: true, json: async () => ({ uf: 'SP' }) }) as unknown as Response);
    vi.stubGlobal('fetch', spy);

    await service.lookup('01310-100');
    expect(spy).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/', expect.anything());
  });
});
