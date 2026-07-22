import { describe, it, expect } from 'vitest';
import type { QualifiedContribution } from '../domain/schema/plugin/contribution';
import { createContributionRegistry } from './ContributionRegistry';

const contribution = (
  pluginId: string,
  id: string,
  overrides: Partial<QualifiedContribution> = {},
): QualifiedContribution => ({
  pluginId,
  point: 'ui.nav',
  id,
  apiVersion: '1.0.0',
  metadata: {},
  ...overrides,
});

describe('createContributionRegistry', () => {
  it('começa vazio', () => {
    const registry = createContributionRegistry();
    expect(registry.size()).toBe(0);
    expect(registry.query('ui.nav')).toEqual([]);
    expect(registry.queryOne('ui.nav')).toBeUndefined();
    expect(registry.points()).toEqual([]);
  });

  it('indexa por ponto de extensão', () => {
    const registry = createContributionRegistry();
    registry.register(contribution('a', 'x'));
    registry.register(contribution('b', 'y', { point: 'ui.page' }));

    expect(registry.query('ui.nav').map((c) => c.id)).toEqual(['x']);
    expect(registry.query('ui.page').map((c) => c.id)).toEqual(['y']);
    expect(registry.points()).toEqual(['ui.nav', 'ui.page']);
    expect(registry.size()).toBe(2);
  });

  it('devolve a consulta já ordenada', () => {
    const registry = createContributionRegistry();
    registry.register(contribution('zeta', 'a'));
    registry.register(contribution('alpha', 'b'));
    registry.register(contribution('meta', 'c', { priority: 10 }));

    expect(registry.query('ui.nav').map((c) => c.pluginId)).toEqual(['meta', 'alpha', 'zeta']);
    expect(registry.queryOne('ui.nav')?.pluginId).toBe('meta');
  });

  it('devolve a mesma referência em consultas repetidas (memoização)', () => {
    const registry = createContributionRegistry();
    registry.register(contribution('a', 'x'));
    expect(registry.query('ui.nav')).toBe(registry.query('ui.nav'));
  });

  it('invalida o cache ao registrar', () => {
    const registry = createContributionRegistry();
    registry.register(contribution('a', 'x'));
    const before = registry.query('ui.nav');
    registry.register(contribution('b', 'y'));
    const after = registry.query('ui.nav');

    expect(after).not.toBe(before);
    expect(after).toHaveLength(2);
  });

  it('invalida o cache ao remover', () => {
    const registry = createContributionRegistry();
    registry.register(contribution('a', 'x'));
    registry.register(contribution('b', 'y'));
    registry.query('ui.nav');

    registry.removeByPlugin('a');
    expect(registry.query('ui.nav').map((c) => c.pluginId)).toEqual(['b']);
  });

  it('acha uma contribuição pela chave qualificada', () => {
    const registry = createContributionRegistry();
    registry.register(contribution('a', 'x'));
    expect(registry.find('a', 'x')?.id).toBe('x');
    expect(registry.find('b', 'x')).toBeUndefined();
  });

  it('permite o mesmo id de contribuição em plugins diferentes', () => {
    const registry = createContributionRegistry();
    registry.register(contribution('a', 'dashboard'));
    registry.register(contribution('b', 'dashboard'));

    expect(registry.size()).toBe(2);
    expect(registry.find('a', 'dashboard')?.pluginId).toBe('a');
    expect(registry.find('b', 'dashboard')?.pluginId).toBe('b');
  });

  it('lista as contribuições de um plugin, ordenadas', () => {
    const registry = createContributionRegistry();
    registry.register(contribution('a', 'z'));
    registry.register(contribution('a', 'y', { point: 'ui.page' }));
    registry.register(contribution('b', 'x'));

    expect(registry.byPlugin('a').map((c) => c.id)).toEqual(['y', 'z']);
  });

  it('removeByPlugin devolve quantas removeu e limpa o ponto vazio', () => {
    const registry = createContributionRegistry();
    registry.register(contribution('a', 'x'));
    registry.register(contribution('a', 'y', { point: 'ui.page' }));
    registry.register(contribution('b', 'z'));

    expect(registry.removeByPlugin('a')).toBe(2);
    expect(registry.points()).toEqual(['ui.nav']);
    expect(registry.size()).toBe(1);
    expect(registry.removeByPlugin('inexistente')).toBe(0);
  });

  it('clear zera tudo', () => {
    const registry = createContributionRegistry();
    registry.register(contribution('a', 'x'));
    registry.clear();

    expect(registry.size()).toBe(0);
    expect(registry.all()).toEqual([]);
  });

  it('suporta centenas de plugins com consulta memoizada', () => {
    const registry = createContributionRegistry();
    for (let plugin = 0; plugin < 500; plugin += 1) {
      for (let index = 0; index < 10; index += 1) {
        registry.register(
          contribution(`com.acme.p${String(plugin).padStart(3, '0')}`, `c${index}`, {
            point: `ui.point${index}`,
          }),
        );
      }
    }
    expect(registry.size()).toBe(5000);
    expect(registry.points()).toHaveLength(10);

    const started = performance.now();
    for (let i = 0; i < 1000; i += 1) registry.query('ui.point3');
    const elapsed = performance.now() - started;

    expect(registry.query('ui.point3')).toHaveLength(500);
    expect(registry.query('ui.point3')[0].pluginId).toBe('com.acme.p000');
    expect(elapsed).toBeLessThan(100);
  });
});
