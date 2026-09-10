import { describe, expect, it } from 'vitest';
import { validateMigrations } from '../../domain/schema/plugin/migration';
import { MARKETPLACE_CATALOG, boasVindasPlugin, guiaPlugin } from './catalog';
import { TRAVELLING_EXAMPLES } from './travellingExamples';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';

/**
 * O catálogo embutido, as fixtures e os EXEMPLOS que viajam. Os exemplos entram porque a guarda abaixo
 * existe justamente para quem aprende a escrever migração lendo um deles: um molde que endereça a
 * coleção pelo nome ensina o defeito que este teste existe para impedir.
 */
const ALL: MarketplacePlugin[] = [
  ...MARKETPLACE_CATALOG,
  boasVindasPlugin,
  guiaPlugin,
  ...TRAVELLING_EXAMPLES,
];

/** Toda `table: 'x'` escrita no código de uma migração. */
const hardcodedTables = (source: string): string[] =>
  [...source.matchAll(/table:\s*'([^']+)'/g)].map((match) => match[1]);

describe('migrações de dados das extensões de primeira parte', () => {
  it.each(ALL.map((plugin) => [plugin.manifest.id, plugin] as const))(
    '%s declara uma fila válida',
    (_id, plugin) => {
      expect(validateMigrations(plugin.migrations)).toEqual([]);
    },
  );

  /**
   * A chave de tela declarada no pacote é REIVINDICADA na instalação, e ganha sufixo quando o nome já
   * está ocupado no escritório de destino. Telas e automações são reescritas na materialização; o
   * código de uma migração é texto opaco, e ninguém o reescreveria — escrever o nome à mão produz uma
   * migração que funciona no escritório de teste e falha silenciosamente no do cliente.
   */
  it.each(ALL.map((plugin) => [plugin.manifest.id, plugin] as const))(
    '%s endereça as próprias coleções por `input.collections`, nunca pelo nome escrito à mão',
    (_id, plugin) => {
      const ownKeys = new Set((plugin.screens ?? []).map((screen) => screen.key));
      for (const migration of plugin.migrations ?? []) {
        for (const table of hardcodedTables(migration.sourceTs)) {
          expect(ownKeys, `migração "${migration.id}" escreveu a coleção "${table}" à mão`).not.toContain(table);
        }
      }
    },
  );
});
