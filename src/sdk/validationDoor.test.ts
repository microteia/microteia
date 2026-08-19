import { describe, expect, it } from 'vitest';
import { validatePluginPackage } from './validate';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';

/**
 * `validatePluginPackage` é UMA porta, e é de propósito.
 *
 * O trio (manifest + integridade referencial + tamanho/migrações) era montado à mão em quatro lugares:
 * a tela de autoria, os dois caminhos de importação e a importação de traduções. Uma checagem
 * acrescentada num deles não chegava aos outros, e o defeito aparecia do lado que ninguém lembrou —
 * tipicamente o do escritório que instalou.
 *
 * Estes casos fixam o que a porta responde. O caso final é o que impede a porta de voltar a ser quatro.
 */
const valid: MarketplacePlugin = {
  manifest: { id: 'com.example.ok', version: '1.0.0', kernel: '^1.0.0', name: 'Ok' },
  summary: 'Uma extensão mínima que instala.',
  workflows: [],
};

const SOURCES = import.meta.glob('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('a porta única de validação de pacote', () => {
  it('não acusa nada num pacote mínimo válido', () => {
    expect(validatePluginPackage(valid)).toEqual([]);
  });

  it('acusa o manifest, e marca a origem', () => {
    const issues = validatePluginPackage({ ...valid, manifest: { ...valid.manifest, id: 'nope' } });
    expect(issues.map((issue) => issue.source)).toContain('manifest');
    expect(issues[0].code).toBeDefined();
  });

  it('acusa o `summary` vazio — sem ele a extensão instala sem ter o que dizer de si', () => {
    const issues = validatePluginPackage({ ...valid, summary: '   ' });
    expect(issues.map((issue) => issue.message)).toContain('@core.marketplace/issue.package.no-summary');
  });

  /** A referência pendente é a única que sabe apontar o artefato — e por isso a única com `ref`. */
  it('acusa a referência pendente e devolve o artefato que ficou faltando', () => {
    const issues = validatePluginPackage({
      ...valid,
      actions: [{
        templateId: 'a1', key: 'doIt', name: 'Do it', screenKey: 's1', workflowId: 'nao-existe',
      } as never],
    });
    const reference = issues.find((issue) => issue.source === 'reference');
    expect(reference?.ref).toEqual(expect.objectContaining({ kind: 'workflow', id: 'nao-existe' }));
  });

  it('toda mensagem é REFERÊNCIA, nunca a frase — quem exibe resolve com o catálogo do usuário', () => {
    const issues = validatePluginPackage({ ...valid, manifest: { ...valid.manifest, id: 'nope' }, summary: '' });
    expect(issues.length).toBeGreaterThan(1);
    for (const issue of issues) expect(issue.message).toMatch(/^@[a-z0-9.-]+\//);
  });

  /**
   * Guarda contra a regressão que motivou a porta: quem valida pacote chama `validatePluginPackage`, e
   * não monta o trio de novo. `validate.ts` é o único lugar onde os três aparecem juntos.
   */
  it('ninguém mais monta o trio à mão', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([path]) => path !== '/src/sdk/validate.ts' && !path.endsWith('.test.ts'))
      .filter(([, source]) =>
        source.includes('validatePluginManifest(')
        && source.includes('validatePackage(')
        && source.includes('packageIssues('))
      .map(([path]) => path);

    expect(offenders, 'chame validatePluginPackage em vez de repetir o trio').toEqual([]);
  });
});
