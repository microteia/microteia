import { describe, it, expect } from 'vitest';
import { createImplementationRegistry } from './ImplementationRegistry';

describe('createImplementationRegistry', () => {
  it('começa vazio', () => {
    const registry = createImplementationRegistry();
    expect(registry.size()).toBe(0);
    expect(registry.resolve('a', 'x')).toBeUndefined();
    expect(registry.has('a', 'x')).toBe(false);
  });

  it('guarda e devolve a implementação', () => {
    const registry = createImplementationRegistry();
    const impl = () => 'oi';
    registry.register('com.acme.x', 'saudacao', impl);

    expect(registry.resolve<typeof impl>('com.acme.x', 'saudacao')).toBe(impl);
    expect(registry.has('com.acme.x', 'saudacao')).toBe(true);
  });

  it('isola por plugin: a mesma chave em plugins diferentes não colide', () => {
    const registry = createImplementationRegistry();
    registry.register('a', 'Pagina', 'implA');
    registry.register('b', 'Pagina', 'implB');

    expect(registry.resolve('a', 'Pagina')).toBe('implA');
    expect(registry.resolve('b', 'Pagina')).toBe('implB');
    expect(registry.size()).toBe(2);
  });

  it('a última declaração do mesmo plugin substitui a anterior', () => {
    const registry = createImplementationRegistry();
    registry.register('a', 'x', 1);
    registry.register('a', 'x', 2);

    expect(registry.resolve('a', 'x')).toBe(2);
    expect(registry.size()).toBe(1);
  });

  it('lista as chaves de um plugin em ordem', () => {
    const registry = createImplementationRegistry();
    registry.register('a', 'zeta', 1);
    registry.register('a', 'alpha', 2);
    registry.register('b', 'outro', 3);

    expect(registry.keysOf('a')).toEqual(['alpha', 'zeta']);
    expect(registry.keysOf('inexistente')).toEqual([]);
  });

  it('não confunde plugins com prefixo comum', () => {
    const registry = createImplementationRegistry();
    registry.register('com.acme', 'x', 1);
    registry.register('com.acme.extra', 'y', 2);

    expect(registry.keysOf('com.acme')).toEqual(['x']);
    expect(registry.removeByPlugin('com.acme')).toBe(1);
    expect(registry.resolve('com.acme.extra', 'y')).toBe(2);
  });

  it('removeByPlugin devolve quantas removeu', () => {
    const registry = createImplementationRegistry();
    registry.register('a', 'x', 1);
    registry.register('a', 'y', 2);
    registry.register('b', 'z', 3);

    expect(registry.removeByPlugin('a')).toBe(2);
    expect(registry.size()).toBe(1);
    expect(registry.removeByPlugin('a')).toBe(0);
  });

  it('clear zera tudo', () => {
    const registry = createImplementationRegistry();
    registry.register('a', 'x', 1);
    registry.clear();
    expect(registry.size()).toBe(0);
  });
});
