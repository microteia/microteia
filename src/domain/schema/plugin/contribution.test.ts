import { describe, it, expect } from 'vitest';
import {
  compareContributions,
  contributionKey,
  contributionPriority,
  findDuplicateContributions,
  isValidContributionId,
  sortContributions,
  validateContribution,
} from './contribution';
import type { Contribution, QualifiedContribution } from './contribution';
import type { ExtensionPointDefinition } from './extensionPoint';

const point = (overrides: Partial<ExtensionPointDefinition> = {}): ExtensionPointDefinition => ({
  id: 'ui.page',
  apiVersion: '1.0.0',
  title: 'Página',
  ownerPluginId: 'core.kernel',
  allowedImplKinds: ['code', 'widget'],
  implRequired: true,
  multiple: true,
  ...overrides,
});

const contribution = (overrides: Partial<Contribution> = {}): Contribution => ({
  point: 'ui.page',
  id: 'minha-tela',
  apiVersion: '1.0.0',
  metadata: { title: 'Minha Tela' },
  impl: { kind: 'widget', spec: {} },
  ...overrides,
});

const qualified = (pluginId: string, overrides: Partial<Contribution> = {}): QualifiedContribution => ({
  pluginId,
  ...contribution(overrides),
});

describe('isValidContributionId', () => {
  it.each(['minha-tela', 'a', 'grupo.item', 'item-2'])('aceita "%s"', (id) =>
    expect(isValidContributionId(id)).toBe(true),
  );

  it.each(['Minha-Tela', '-tela', '.tela', 'tela..x', '', 'tela_x'])('rejeita "%s"', (id) =>
    expect(isValidContributionId(id)).toBe(false),
  );
});

describe('contributionKey', () => {
  it('qualifica o id com o plugin dono', () => {
    expect(contributionKey('com.acme.x', 'minha-tela')).toBe('com.acme.x:minha-tela');
  });
});

describe('contributionPriority', () => {
  it('usa 0 como padrão', () => {
    expect(contributionPriority(contribution())).toBe(0);
  });

  it('ignora prioridade não-finita', () => {
    expect(contributionPriority(contribution({ priority: Infinity }))).toBe(0);
  });
});

describe('compareContributions / sortContributions', () => {
  it('coloca a maior prioridade primeiro', () => {
    const ordered = sortContributions([
      qualified('a', { priority: 1, id: 'x' }),
      qualified('a', { priority: 9, id: 'y' }),
    ]);
    expect(ordered.map((c) => c.id)).toEqual(['y', 'x']);
  });

  it('desempata por pluginId e depois por id, em ordem alfabética', () => {
    const ordered = sortContributions([
      qualified('zeta', { id: 'b' }),
      qualified('alpha', { id: 'b' }),
      qualified('alpha', { id: 'a' }),
    ]);
    expect(ordered.map((c) => `${c.pluginId}:${c.id}`)).toEqual(['alpha:a', 'alpha:b', 'zeta:b']);
  });

  it('é determinística: a ordem de entrada não muda o resultado', () => {
    const items = [
      qualified('zeta', { id: 'a', priority: 5 }),
      qualified('alpha', { id: 'b' }),
      qualified('meta', { id: 'c', priority: 5 }),
      qualified('beta', { id: 'd' }),
    ];
    const forward = sortContributions(items).map((c) => c.pluginId);
    const backward = sortContributions([...items].reverse()).map((c) => c.pluginId);
    expect(forward).toEqual(backward);
    expect(forward).toEqual(['meta', 'zeta', 'alpha', 'beta']);
  });

  it('não muta o array recebido', () => {
    const items = [qualified('zeta'), qualified('alpha')];
    sortContributions(items);
    expect(items[0].pluginId).toBe('zeta');
  });

  it('devolve 0 para contribuições idênticas', () => {
    expect(compareContributions(qualified('a'), qualified('a'))).toBe(0);
  });
});

describe('validateContribution', () => {
  const options = { pluginId: 'com.acme.x', trusted: false, point: point() };

  it('aceita contribuição bem formada', () => {
    expect(validateContribution(contribution(), options)).toEqual([]);
  });

  it('reporta id inválido', () => {
    const diagnostics = validateContribution(contribution({ id: 'Tela Inválida' }), options);
    expect(diagnostics[0]).toMatchObject({ code: 'contribution.id.invalid', path: 'contributes[0].id' });
  });

  it('reporta metadata que não é objeto', () => {
    const diagnostics = validateContribution(
      contribution({ metadata: [] as unknown as Record<string, unknown> }),
      options,
    );
    expect(diagnostics.some((d) => d.path === 'contributes[0].metadata')).toBe(true);
  });

  it('reporta ponto desconhecido e para de validar o resto', () => {
    const diagnostics = validateContribution(contribution(), { pluginId: 'com.acme.x', trusted: false });
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'contribution.point.unknown' });
  });

  it('aceita contrato mais antigo que o do ponto (evolução aditiva)', () => {
    const diagnostics = validateContribution(contribution({ apiVersion: '1.0.0' }), {
      ...options,
      point: point({ apiVersion: '1.4.2' }),
    });
    expect(diagnostics).toEqual([]);
  });

  it('rejeita contrato de major diferente', () => {
    const diagnostics = validateContribution(contribution({ apiVersion: '1.0.0' }), {
      ...options,
      point: point({ apiVersion: '2.0.0' }),
    });
    expect(diagnostics[0]).toMatchObject({ code: 'contribution.point.incompatible' });
  });

  it('rejeita contribuição que exige contrato mais novo que o do kernel', () => {
    const diagnostics = validateContribution(contribution({ apiVersion: '1.9.0' }), {
      ...options,
      point: point({ apiVersion: '1.2.0' }),
    });
    expect(diagnostics[0]).toMatchObject({ code: 'contribution.point.incompatible' });
  });

  it('reporta implementação ausente quando o ponto exige', () => {
    const diagnostics = validateContribution(contribution({ impl: undefined }), options);
    expect(diagnostics[0]).toMatchObject({ code: 'contribution.impl.missing' });
  });

  it('aceita ausência de implementação quando o ponto não exige', () => {
    const diagnostics = validateContribution(contribution({ impl: undefined }), {
      ...options,
      point: point({ implRequired: false }),
    });
    expect(diagnostics).toEqual([]);
  });

  it('reporta tipo de implementação não aceito pelo ponto', () => {
    const diagnostics = validateContribution(
      contribution({ impl: { kind: 'script', scriptId: 's1' } }),
      options,
    );
    expect(diagnostics[0]).toMatchObject({ code: 'contribution.impl.forbidden' });
  });

  it('proíbe impl "code" em plugin não confiável', () => {
    const diagnostics = validateContribution(contribution({ impl: { kind: 'code', key: 'PageX' } }), options);
    expect(diagnostics[0]).toMatchObject({ code: 'contribution.impl.forbidden' });
    expect(diagnostics[0].message).toContain('exclusiva de plugins internos');
  });

  it('permite impl "code" em plugin confiável', () => {
    const diagnostics = validateContribution(contribution({ impl: { kind: 'code', key: 'PageX' } }), {
      ...options,
      trusted: true,
    });
    expect(diagnostics).toEqual([]);
  });

  it('reporta implementação malformada', () => {
    const diagnostics = validateContribution(contribution({ impl: { kind: 'code', key: '  ' } }), {
      ...options,
      trusted: true,
    });
    expect(diagnostics.some((d) => d.path === 'contributes[0].impl')).toBe(true);
  });

  it('usa o índice recebido no caminho do diagnóstico', () => {
    const diagnostics = validateContribution(contribution({ id: 'INVÁLIDO' }), { ...options, index: 3 });
    expect(diagnostics[0].path).toBe('contributes[3].id');
  });
});

describe('findDuplicateContributions', () => {
  it('não reclama de ids distintos', () => {
    expect(
      findDuplicateContributions([contribution({ id: 'a' }), contribution({ id: 'b' })], 'com.acme.x'),
    ).toEqual([]);
  });

  it('reporta o mesmo id repetido no mesmo ponto', () => {
    const diagnostics = findDuplicateContributions(
      [contribution({ id: 'a' }), contribution({ id: 'a' })],
      'com.acme.x',
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'contribution.duplicate', path: 'contributes[1].id' });
  });

  it('permite o mesmo id em pontos diferentes', () => {
    expect(
      findDuplicateContributions(
        [contribution({ id: 'a', point: 'ui.page' }), contribution({ id: 'a', point: 'ui.nav' })],
        'com.acme.x',
      ),
    ).toEqual([]);
  });
});
