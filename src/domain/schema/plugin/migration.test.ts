import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIGRATION_MAX_ROUNDS,
  isMigrationRequired,
  migrationMaxRounds,
  migrationPhaseOf,
  migrationRunsOnInstall,
  sortMigrations,
  validateMigrations,
  type PluginMigration,
} from './migration';

const migration = (overrides: Partial<PluginMigration> = {}): PluginMigration => ({
  id: 'backfill-status',
  version: '1.1.0',
  name: 'Preenche o status',
  sourceTs: 'main()',
  ...overrides,
});

describe('contrato de migração de extensão', () => {
  describe('padrões', () => {
    it('roda depois dos artefatos, é obrigatória e não roda em instalação nova', () => {
      const m = migration();
      expect(migrationPhaseOf(m)).toBe('after');
      expect(isMigrationRequired(m)).toBe(true);
      expect(migrationRunsOnInstall(m)).toBe(false);
      expect(migrationMaxRounds(m)).toBe(DEFAULT_MIGRATION_MAX_ROUNDS);
    });

    it('teto de rodadas inválido cai no padrão em vez de virar loop sem limite', () => {
      expect(migrationMaxRounds(migration({ maxRounds: 0 }))).toBe(DEFAULT_MIGRATION_MAX_ROUNDS);
      expect(migrationMaxRounds(migration({ maxRounds: 7 }))).toBe(7);
    });
  });

  describe('ordenação', () => {
    it('ordena por versão, e a ordem declarada desempata dentro da mesma versão', () => {
      const ordered = sortMigrations([
        migration({ id: 'c', version: '1.10.0' }),
        migration({ id: 'a', version: '1.2.0' }),
        migration({ id: 'b', version: '1.2.0' }),
      ]);
      expect(ordered.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    });

    it('1.10.0 vem depois de 1.9.0 — comparação por semver, não por texto', () => {
      const ordered = sortMigrations([
        migration({ id: 'dez', version: '1.10.0' }),
        migration({ id: 'nove', version: '1.9.0' }),
      ]);
      expect(ordered.map((m) => m.id)).toEqual(['nove', 'dez']);
    });
  });

  describe('validação', () => {
    it('aceita uma fila bem formada', () => {
      expect(validateMigrations([migration(), migration({ id: 'outra', version: '1.2.0' })])).toEqual([]);
    });

    it('aceita a ausência da fila — extensão sem migração é o caso normal', () => {
      expect(validateMigrations(undefined)).toEqual([]);
    });

    it('recusa identificador fora do padrão e identificador repetido', () => {
      const issues = validateMigrations([
        migration({ id: 'Backfill_Status' }),
        migration({ id: 'igual' }),
        migration({ id: 'igual' }),
      ]);
      expect(issues.map((i) => i.message)).toEqual([
        '@core.marketplace/issue.migration.id-invalid',
        '@core.marketplace/issue.migration.id-duplicated',
      ]);
    });

    it('recusa versão que não é semver', () => {
      expect(validateMigrations([migration({ version: 'v1' })])[0].message)
        .toBe('@core.marketplace/issue.migration.version-invalid');
    });

    it('recusa código vazio e código com módulos — o sandbox não resolve import', () => {
      expect(validateMigrations([migration({ sourceTs: '  ' })])[0].message)
        .toBe('@core.marketplace/issue.migration.source-missing');
      expect(validateMigrations([migration({ sourceTs: "import x from 'y';" })])[0].message)
        .toBe('@core.marketplace/issue.migration.source-modules');
      expect(validateMigrations([migration({ sourceTs: "const a = require('b');" })])[0].message)
        .toBe('@core.marketplace/issue.migration.source-modules');
    });

    it('recusa fase desconhecida e teto de rodadas inválido', () => {
      expect(validateMigrations([migration({ phase: 'middle' as never })])[0].message)
        .toBe('@core.marketplace/issue.migration.phase-invalid');
      expect(validateMigrations([migration({ maxRounds: 0 })])[0].message)
        .toBe('@core.marketplace/issue.migration.rounds-invalid');
    });

    /** A ordem declarada É a ordem de execução; um array fora de ordem esconde isso de quem lê. */
    it('recusa fila declarada fora de ordem', () => {
      const issues = validateMigrations([
        migration({ id: 'nova', version: '2.0.0' }),
        migration({ id: 'velha', version: '1.0.0' }),
      ]);
      expect(issues[0].message).toBe('@core.marketplace/issue.migration.out-of-order');
      expect(issues[0].messageParams).toEqual({ id: 'velha', previous: 'nova' });
    });

    it('recusa o que não é lista', () => {
      expect(validateMigrations({} as never)[0].message).toBe('@core.marketplace/issue.migration.not-list');
    });
  });
});
