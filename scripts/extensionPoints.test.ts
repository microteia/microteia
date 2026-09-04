import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { KERNEL_EXTENSION_POINTS } from '../src/domain/schema/extensionPoints';
import { isValidExtensionPointId } from '../src/domain/schema/plugin/extensionPoint';

const SCHEMA_ROOT = join(__dirname, '..', 'src', 'domain', 'schema');

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return entry.endsWith('.ts') && !entry.endsWith('.test.ts') ? [full] : [];
  });

/**
 * As FAMÍLIAS de pontos que existem no código, achadas na fonte.
 *
 * Varre em vez de importar de propósito: importar uma lista para conferir a mesma lista não prova
 * nada. O que se quer saber é se existe uma família que NINGUÉM agregou — e isso só a fonte diz.
 */
const declaredFamilies = (): string[] =>
  sourceFiles(SCHEMA_ROOT)
    .flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return [...source.matchAll(/^export const ([A-Z0-9_]*EXTENSION_POINTS): ExtensionPointDefinition\[\]/gm)]
        .map((match) => match[1]);
    })
    .filter((name) => name !== 'KERNEL_EXTENSION_POINTS')
    .sort();

describe('KERNEL_EXTENSION_POINTS', () => {
  it('agrega TODA família declarada no schema — nenhuma fica de fora', () => {
    // O defeito que isto trava já aconteceu: a agregação do servidor MCP omitia a família de
    // autenticação, e o agente de autoria nunca viu `auth.provider`.
    const source = readFileSync(join(SCHEMA_ROOT, 'extensionPoints.ts'), 'utf8');
    const aggregated = [...source.matchAll(/\.\.\.([A-Z0-9_]+),/g)].map((match) => match[1]).sort();

    expect(aggregated).toEqual(declaredFamilies());
  });

  it('todo id é válido e único', () => {
    const ids = KERNEL_EXTENSION_POINTS.map((point) => point.id);

    expect(ids.every((id) => isValidExtensionPointId(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todo ponto declara o plugin dono e a versão do contrato', () => {
    for (const point of KERNEL_EXTENSION_POINTS) {
      expect(point.ownerPluginId, point.id).toBeTruthy();
      expect(point.apiVersion, point.id).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});
