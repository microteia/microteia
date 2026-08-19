import type { LocalizedMessage } from '../i18n/localizedMessage';
import { compareSemVer, parseSemVer } from './semver';

/**
 * Uma MIGRAÇÃO DE DADOS de uma extensão: código que roda UMA VEZ por escritório para consertar,
 * completar ou converter o dado que uma versão anterior da própria extensão escreveu.
 *
 * Por que não basta a convergência de artefatos: `applyPackageArtifacts` reescreve a DECLARAÇÃO
 * (tela, campo, automação, ação) e nunca toca em registro. Num banco sem esquema isso cobre quase
 * tudo — campo novo simplesmente passa a existir vazio —, mas não cobre o que só o autor sabe:
 * qual valor o campo novo deveria ter no registro que já estava lá, ou que o texto de ontem virou
 * número hoje.
 *
 * **Não é um `Script` do escritório.** A migração viaja no pacote e não é materializada em
 * `tenants/{tid}/scripts`: ela não é um artefato que o escritório reusa, edita ou vê na lista de
 * Scripts, e refcontá-la entre extensões não teria sentido. O que ela compartilha com o Script é o
 * EXECUTOR — o sandbox QuickJS, pela callable `runScript`, que já recebe o código compilado no
 * payload. Daí a consequência que decide o desenho: **migração não exige revisão de código**
 * (`extensionCodeTrust`) porque não é código de host — ela só alcança `query`/`upsert`/`remove`,
 * escopados no escritório corrente pelo servidor. É o que permite a uma extensão de TERCEIRO migrar
 * os próprios dados, que é justamente quem mais precisa disso.
 *
 * **O limite do sandbox é o contrato, não um obstáculo.** São 25 consultas, 25 gravações e 10s de
 * parede por execução. Nenhuma migração de verdade cabe numa passada, então ela processa um LOTE e
 * devolve `{ remaining, changed }`; o runner a reinvoca até `remaining` zerar. As duas propriedades
 * que isso exige — ser idempotente e ser retomável — são as mesmas que fazem uma migração sobreviver
 * a uma falha no meio, e como não existe `down` (ver `ARCHITECTURE.md`), são obrigação do autor.
 */
export type MigrationPhase = 'before' | 'after';

export const MIGRATION_PHASES: readonly MigrationPhase[] = ['before', 'after'] as const;

/** Mesmo padrão dos identificadores de tela, ação e script: é por ele que a migração é rastreada. */
export const MIGRATION_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
export const MIGRATION_ID_MAX_LENGTH = 60;
export const DEFAULT_MIGRATION_MAX_ROUNDS = 40;

export interface PluginMigration {
  /**
   * Identidade da migração, ÚNICA na extensão e imutável — é ela, e não a versão, que fica gravada
   * no escritório como "já aplicada". Versão não serve como identidade: uma versão pode precisar de
   * duas migrações, e uma migração acrescentada depois a uma versão antiga ainda tem de rodar.
   */
  id: string;
  /** A versão da extensão em que a migração nasceu — ordena a fila e explica ao escritório o porquê. */
  version: string;
  /** Rótulo para a tela de Extensões. Aceita referência de mensagem (`@namespace/chave`). */
  name: string;
  /** TypeScript sem `import`/`export`/`require`, transpilado no cliente e executado no sandbox. */
  sourceTs: string;
  /**
   * `after` (padrão) roda depois de os artefatos do pacote convergirem — é o caso normal, porque a
   * migração quer os campos novos já declarados.
   *
   * `before` existe para o caso que só funciona antes: `applyPackageArtifacts` RETIRA da tela o campo
   * que sumiu do pacote, e `query`/`upsert` validam caminho contra a tela. Depois da convergência,
   * ler ou gravar o campo antigo passa a ser recusado — então uma migração que copia
   * `campo_antigo` para `campo_novo` precisa rodar enquanto os dois existem.
   */
  phase?: MigrationPhase;
  /**
   * Roda também numa instalação NOVA. O padrão é `false`, e é o padrão certo: migração conserta dado
   * escrito por uma versão anterior DESTA extensão, e num escritório que instala agora esse dado não
   * existe — a instalação nova só carimba a fila como aplicada (baseline).
   *
   * A exceção é real: uma extensão que acrescenta campos a uma coleção que já existe no escritório
   * (`persons`) pode precisar preencher registros que sempre estiveram lá, e esse escritório precisa
   * do preenchimento mesmo instalando pela primeira vez.
   */
  runOnInstall?: boolean;
  /**
   * Migração pendente mantém a extensão FORA do boot (padrão). Mesma decisão do `backendState`:
   * extensão que roda sobre dado que ela mesma considera inconsistente obriga cada tela dela a
   * tolerar os dois formatos para sempre. Use `false` para o preenchimento cosmético, que pode
   * esperar sem que nada quebre.
   */
  required?: boolean;
  /** Teto de reinvocações do lote. Estourar é ERRO, não sucesso — o dado ficou pela metade. */
  maxRounds?: number;
}

export const migrationPhaseOf = (migration: PluginMigration): MigrationPhase =>
  migration.phase === 'before' ? 'before' : 'after';

export const isMigrationRequired = (migration: PluginMigration): boolean => migration.required !== false;

export const migrationRunsOnInstall = (migration: PluginMigration): boolean => migration.runOnInstall === true;

export const migrationMaxRounds = (migration: PluginMigration): number =>
  typeof migration.maxRounds === 'number' && Number.isFinite(migration.maxRounds) && migration.maxRounds >= 1
    ? Math.floor(migration.maxRounds)
    : DEFAULT_MIGRATION_MAX_ROUNDS;

/**
 * Ordem de execução: por versão, e a ordem DECLARADA desempata. Não é detalhe — duas migrações da
 * mesma versão que rodem trocadas produzem estados diferentes, e a validação abaixo cobra que o
 * array já esteja ordenado, para que o que se lê no pacote seja o que acontece no escritório.
 */
export const sortMigrations = (migrations: PluginMigration[]): PluginMigration[] =>
  migrations
    .map((migration, index) => ({ migration, index }))
    .sort((left, right) => {
      const a = parseSemVer(left.migration.version);
      const b = parseSemVer(right.migration.version);
      const byVersion = a && b ? compareSemVer(a, b) : 0;
      return byVersion !== 0 ? byVersion : left.index - right.index;
    })
    .map((entry) => entry.migration);

const issue = (message: string, messageParams?: Record<string, string>): LocalizedMessage =>
  messageParams ? { message, messageParams } : { message };

/**
 * Valida a fila de migrações de um pacote. Nunca lança: todo problema vira mensagem localizável, do
 * mesmo jeito que a validação de referências e de tamanho — é a validação única que a autoria e a
 * importação compartilham, e é ela que impede um pacote de instalar código de migração que nunca
 * poderia rodar.
 */
export const validateMigrations = (migrations: PluginMigration[] | undefined): LocalizedMessage[] => {
  if (migrations === undefined) return [];
  if (!Array.isArray(migrations)) return [issue('@core.marketplace/issue.migration.not-list')];

  const issues: LocalizedMessage[] = [];
  const seen = new Set<string>();
  let previous: PluginMigration | null = null;

  for (const migration of migrations) {
    const id = String(migration?.id ?? '');
    if (!MIGRATION_ID_PATTERN.test(id) || id.length > MIGRATION_ID_MAX_LENGTH) {
      issues.push(issue('@core.marketplace/issue.migration.id-invalid', { id }));
    } else if (seen.has(id)) {
      issues.push(issue('@core.marketplace/issue.migration.id-duplicated', { id }));
    }
    seen.add(id);

    const parsed = parseSemVer(migration?.version);
    if (!parsed) {
      issues.push(issue('@core.marketplace/issue.migration.version-invalid', { id, version: String(migration?.version) }));
    }
    if (!String(migration?.name ?? '').trim()) {
      issues.push(issue('@core.marketplace/issue.migration.name-missing', { id }));
    }
    const source = String(migration?.sourceTs ?? '');
    if (!source.trim()) {
      issues.push(issue('@core.marketplace/issue.migration.source-missing', { id }));
    } else if (/\b(import|export)\b/.test(source) || /\brequire\s*\(/.test(source)) {
      issues.push(issue('@core.marketplace/issue.migration.source-modules', { id }));
    }
    if (migration?.phase !== undefined && !MIGRATION_PHASES.includes(migration.phase)) {
      issues.push(issue('@core.marketplace/issue.migration.phase-invalid', { id, phase: String(migration.phase) }));
    }
    if (
      migration?.maxRounds !== undefined
      && (typeof migration.maxRounds !== 'number' || !Number.isInteger(migration.maxRounds) || migration.maxRounds < 1)
    ) {
      issues.push(issue('@core.marketplace/issue.migration.rounds-invalid', { id, rounds: String(migration.maxRounds) }));
    }

    const previousParsed = previous ? parseSemVer(previous.version) : null;
    if (parsed && previousParsed && compareSemVer(previousParsed, parsed) > 0) {
      issues.push(issue('@core.marketplace/issue.migration.out-of-order', { id, previous: previous?.id ?? '' }));
    }
    previous = migration;
  }

  return issues;
};
