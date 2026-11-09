import { describe, expect, it } from 'vitest';
import { PassThrough } from 'node:stream';
import { gzipSync } from 'node:zlib';
import type { LookupAddress } from 'node:dns';
import { decodeBody, guardedLookup, readLimited, SafeHttpClient, type ResolveAll } from './SafeHttpClient';
import { HttpClientError } from '../../domain/repositories/IHttpClient';

const resolver = (addresses: LookupAddress[], error?: NodeJS.ErrnoException): ResolveAll =>
  (_hostname, _options, callback) => callback(error ?? null, addresses);

const lookupOnce = (resolve: ResolveAll, all: boolean) =>
  new Promise<{ error: NodeJS.ErrnoException | null; address: unknown; family?: number }>((done) => {
    guardedLookup(resolve)('api.exemplo.com', { all }, (error, address, family) => done({ error, address, family }));
  });

describe('guardedLookup — o IP conferido é o IP conectado', () => {
  it('entrega o endereço público resolvido', async () => {
    const result = await lookupOnce(resolver([{ address: '93.184.216.34', family: 4 }]), false);
    expect(result).toEqual({ error: null, address: '93.184.216.34', family: 4 });
  });

  it('com `all`, entrega a lista inteira', async () => {
    const list = [{ address: '93.184.216.34', family: 4 }, { address: '2606:2800:220:1::248', family: 6 }];
    const result = await lookupOnce(resolver(list), true);
    expect(result.address).toEqual(list);
  });

  it('recusa o nome que resolve para rede interna — o caso do DNS que aponta para os metadados', async () => {
    const result = await lookupOnce(resolver([{ address: '169.254.169.254', family: 4 }]), false);
    expect(result.error?.code).toBe('EMICROTEIA_BLOCKED');
  });

  it('basta UM endereço interno entre vários para recusar: o resultado não depende da ordem do DNS', async () => {
    const result = await lookupOnce(resolver([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]), true);
    expect(result.error?.code).toBe('EMICROTEIA_BLOCKED');
  });

  it('nome sem endereço é recusado; erro do DNS passa adiante', async () => {
    expect((await lookupOnce(resolver([]), false)).error?.code).toBe('EMICROTEIA_BLOCKED');
    const dnsError: NodeJS.ErrnoException = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    expect((await lookupOnce(resolver([], dnsError), false)).error?.code).toBe('ENOTFOUND');
  });
});

describe('SafeHttpClient.send — sem tocar a rede', () => {
  it('nome que resolve para rede interna vira `address-blocked`, antes de qualquer conexão', async () => {
    const client = new SafeHttpClient(resolver([{ address: '127.0.0.1', family: 4 }]));
    await expect(client.send(
      { method: 'GET', url: new URL('https://api.exemplo.com/x'), headers: {} },
      { timeoutMs: 2000, maxBytes: 1024 },
    )).rejects.toMatchObject({ code: 'address-blocked' });
  });

  it('falha do DNS vira `network`, com o código', async () => {
    const dnsError: NodeJS.ErrnoException = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    const client = new SafeHttpClient(resolver([], dnsError));
    await expect(client.send(
      { method: 'GET', url: new URL('https://nao-existe.exemplo.com/x'), headers: {} },
      { timeoutMs: 2000, maxBytes: 1024 },
    )).rejects.toMatchObject({ code: 'network', message: 'ENOTFOUND' });
  });
});

describe('readLimited — o corpo nunca passa do teto', () => {
  it('lê até o fim quando cabe', async () => {
    const stream = new PassThrough();
    const reading = readLimited(stream, 10);
    stream.end(Buffer.from('abc'));
    expect((await reading).toString()).toBe('abc');
  });

  it('derruba a conexão assim que passa do teto', async () => {
    const stream = new PassThrough();
    const reading = readLimited(stream, 4);
    stream.write(Buffer.from('abc'));
    stream.write(Buffer.from('def'));
    await expect(reading).rejects.toBeInstanceOf(HttpClientError);
    await expect(reading).rejects.toMatchObject({ code: 'too-large' });
    expect(stream.destroyed).toBe(true);
  });
});

describe('decodeBody — a compressão não fura o teto', () => {
  it('abre gzip que cabe', () => {
    expect(decodeBody(gzipSync(Buffer.from('{"a":1}')), 'gzip', 100).toString()).toBe('{"a":1}');
  });

  it('recusa a "bomba": pouco comprimido que se abre em muito', () => {
    const bomb = gzipSync(Buffer.alloc(1_000_000, 'a'));
    expect(bomb.length).toBeLessThan(5_000);
    expect(() => decodeBody(bomb, 'gzip', 100_000)).toThrow(HttpClientError);
  });

  it('sem codificação, devolve como veio', () => {
    expect(decodeBody(Buffer.from('x'), undefined, 10).toString()).toBe('x');
  });
});
