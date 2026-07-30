import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeDeclarativeLookupService } from './DeclarativeLookupService';
import type { LookupProviderSpec } from '../../domain/schema/lookupProviderSpec';
import {
  buildLookupProviderCatalog,
  CORE_LOOKUP_PROVIDERS,
  isAllowedLookupUrl,
  lookupTimeoutOf,
  MAX_LOOKUP_RESPONSE_BYTES,
  MAX_LOOKUP_TIMEOUT_MS,
} from '../../domain/schema/lookupProviderSpec';

const viaCepSpec = CORE_LOOKUP_PROVIDERS.find((provider) => provider.key === 'viacep')!;
const viacep = makeDeclarativeLookupService(viaCepSpec);

const mockJson = (payload: unknown): ReturnType<typeof vi.fn> => {
  const spy = vi.fn(async () => ({ ok: true, text: async () => JSON.stringify(payload) }) as unknown as Response);
  vi.stubGlobal('fetch', spy);
  return spy;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Os sete casos que cobriam o `ViaCepLookupService` removido, agora exercidos pelo executor genérico
 * rodando a DECLARAÇÃO do ViaCEP. É este bloco que autoriza a exclusão da classe.
 */
describe('paridade com o ViaCepLookupService removido', () => {
  it('mapeia a resposta do ViaCEP para as chaves do endereço', async () => {
    mockJson({ logradouro: 'Av. Paulista', bairro: 'Bela Vista', localidade: 'São Paulo', uf: 'SP' });

    const result = await viacep.lookup('01310-100');
    expect(result.ok).toBe(true);
    expect(result.values).toEqual({
      street: 'Av. Paulista',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    });
  });

  it('omite as chaves que vieram vazias, para não apagar o que o usuário digitou', async () => {
    mockJson({ logradouro: '', bairro: '', localidade: 'Brasília', uf: 'DF' });

    const result = await viacep.lookup('70000000');
    expect(result.values).toEqual({ city: 'Brasília', state: 'DF' });
  });

  it('trata o CEP inexistente sinalizado por `erro`', async () => {
    mockJson({ erro: true });

    const result = await viacep.lookup('00000000');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('CEP não encontrado');
  });

  it('trata falha HTTP sem lançar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, text: async () => '' }) as unknown as Response));

    const result = await viacep.lookup('01310100');
    expect(result.ok).toBe(false);
    expect(result.values).toEqual({});
  });

  it('trata exceção de rede sem lançar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    const result = await viacep.lookup('01310100');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Não foi possível consultar o CEP');
  });

  it('não consulta enquanto o CEP está incompleto', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);

    const result = await viacep.lookup('0131');
    expect(spy).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it('aceita o CEP com máscara', async () => {
    const spy = mockJson({ uf: 'SP' });

    await viacep.lookup('01310-100');
    expect(spy).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/', expect.anything());
  });
});

describe('garantias que o executor impõe a qualquer declaração', () => {
  it('nunca envia credencial do app', async () => {
    const spy = mockJson({ uf: 'SP' });

    await viacep.lookup('01310100');
    expect(spy.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store' });
  });

  it('recusa URL que não seja https', () => {
    expect(isAllowedLookupUrl('http://viacep.com.br/ws/{value}/json/')).toBe(false);
    expect(isAllowedLookupUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedLookupUrl('data:text/html,x')).toBe(false);
    expect(isAllowedLookupUrl('https://viacep.com.br/ws/{value}/json/')).toBe(true);
  });

  it('descarta declaração com URL proibida ao montar o catálogo', () => {
    const catalog = buildLookupProviderCatalog([
      { key: 'x/inseguro', label: 'Inseguro', request: { url: 'http://x.test/{value}' }, map: { a: 'a' } },
    ]);
    expect(catalog.has('x/inseguro')).toBe(false);
  });

  it('limita o timeout declarado ao teto do kernel', () => {
    expect(lookupTimeoutOf({ url: 'https://x.test' })).toBe(8000);
    expect(lookupTimeoutOf({ url: 'https://x.test', timeoutMs: 999_999 })).toBe(MAX_LOOKUP_TIMEOUT_MS);
    expect(lookupTimeoutOf({ url: 'https://x.test', timeoutMs: -1 })).toBe(8000);
  });

  it('escapa o valor ao montar a URL', async () => {
    const spec: LookupProviderSpec = {
      key: 'x/busca',
      label: 'Busca',
      request: { url: 'https://api.test/q?termo={value}' },
      map: { nome: 'nome' },
    };
    const spy = mockJson({ nome: 'ok' });

    await makeDeclarativeLookupService(spec).lookup('a b&c=1');
    expect(spy).toHaveBeenCalledWith('https://api.test/q?termo=a%20b%26c%3D1', expect.anything());
  });

  it('recusa resposta acima do teto de tamanho', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => 'x'.repeat(MAX_LOOKUP_RESPONSE_BYTES + 1) }) as unknown as Response),
    );

    const result = await viacep.lookup('01310100');
    expect(result.ok).toBe(false);
  });

  it('devolve só as chaves declaradas em map — a resposta bruta não vaza', async () => {
    const spec: LookupProviderSpec = {
      key: 'x/parcial',
      label: 'Parcial',
      request: { url: 'https://api.test/{value}' },
      map: { nome: 'dados.nome' },
    };
    mockJson({ dados: { nome: 'Ana', cpf: '52998224725' }, token: 'segredo' });

    const result = await makeDeclarativeLookupService(spec).lookup('1');
    expect(result.values).toEqual({ nome: 'Ana' });
  });

  it('caminho inexistente no map simplesmente não preenche', async () => {
    const spec: LookupProviderSpec = {
      key: 'x/ausente',
      label: 'Ausente',
      request: { url: 'https://api.test/{value}' },
      map: { nome: 'nao.existe' },
    };
    mockJson({ outro: 1 });

    const result = await makeDeclarativeLookupService(spec).lookup('1');
    expect(result).toEqual({ ok: true, values: {} });
  });

  it('guarda quebrada não dispara requisição', async () => {
    const spec: LookupProviderSpec = {
      key: 'x/quebrado',
      label: 'Quebrado',
      when: 'length(',
      request: { url: 'https://api.test/{value}' },
      map: { nome: 'nome' },
    };
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);

    const result = await makeDeclarativeLookupService(spec).lookup('1');
    expect(spy).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
  });

  it('normaliza a entrada pelo pipeline declarado antes de montar a URL', async () => {
    const spec: LookupProviderSpec = {
      key: 'x/upper',
      label: 'Upper',
      input: [{ op: 'trim' }, { op: 'upper' }],
      request: { url: 'https://api.test/{value}' },
      map: { nome: 'nome' },
    };
    const spy = mockJson({ nome: 'ok' });

    await makeDeclarativeLookupService(spec).lookup('  abc  ');
    expect(spy).toHaveBeenCalledWith('https://api.test/ABC', expect.anything());
  });

  it('expõe as chaves de saída derivadas do map', () => {
    expect(viacep.outputKeys).toEqual(['street', 'neighborhood', 'city', 'state']);
  });

  it('não deixa extensão redefinir um provedor do núcleo', () => {
    const catalog = buildLookupProviderCatalog([
      { key: 'viacep', label: 'Sequestrado', request: { url: 'https://evil.test/{value}' }, map: { a: 'a' } },
    ]);
    expect(catalog.get('viacep')?.label).toBe('Endereço pelo CEP (ViaCEP)');
  });
});
