import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { InstalledExtensionStoreContext, type InstallExtensionInput } from './useInstalledExtensions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { applyPackageArtifacts, releasePackageArtifacts, type ArtifactDeps } from '../domain/usecases/plugins/MarketplaceInstallUseCases';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import type { InstalledExtension } from '../domain/entities/InstalledExtension';
import { hashExtensionCode } from '../domain/usecases/plugins/extensionCodeTrust';
import { translationOverwriteIssue } from '../domain/usecases/i18n/translationPackage';
import { transpileScriptSource } from '../domain/services/scriptSource';
import { appliedMigrationIds, planPluginMigrations, pendingPluginMigrations } from '../domain/services/pluginMigrations';
import {
  claimMigrationRun,
  recordMigrationBaseline,
  releaseMigrationRun,
  runMigrationQueue,
  type MigrationRunContext,
  type MigrationRunnerDeps,
  type MigrationRunOutcome,
} from '../domain/usecases/plugins/runPluginMigrations';
import type { ExtensionMigrationState } from '../domain/entities/ExtensionMigration';
import type { ExtensionHistory } from '../domain/entities/ExtensionHistory';
import { packageRevision } from '../domain/usecases/plugins/extensionHistory';
import type { PluginMigration } from '../domain/schema/plugin/migration';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import { buildScreenKeyMap } from '../domain/usecases/plugins/screenModule';

import { LocalizedError } from '../domain/errors/LocalizedError';
// Telas usam refresh por evento (não assinam onSnapshot ao vivo como workflows/actions/scripts).
// Sem estes emits, uma tela materializada na instalação não aparece no Form Design nem no menu.
const notifyArtifactStores = (): void => {
  storeEvents.emit(StoreEvents.SCREEN_DEFINITIONS_UPDATED);
  storeEvents.emit(StoreEvents.ACTIONS_UPDATED);
};

export const InstalledExtensionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const {
    installedExtensionRepository,
    extensionMigrationRepository,
    extensionHistoryRepository,
    screenDefinitionRepository,
    workflowDefinitionRepository,
    scriptRepository,
    lookupDefinitionRepository,
    lookupRepository,
    tagDefinitionRepository,
    actionRepository,
  } = useDI();

  const artifactDeps = useMemo<ArtifactDeps>(
    () => ({
      screenRepository: screenDefinitionRepository,
      workflowRepository: workflowDefinitionRepository,
      scriptRepository,
      lookupDefinitionRepository,
      lookupRepository,
      tagDefinitionRepository,
      actionRepository,
    }),
    [screenDefinitionRepository, workflowDefinitionRepository, scriptRepository, actionRepository, lookupDefinitionRepository, lookupRepository, tagDefinitionRepository],
  );

  const [installed, setInstalled] = useState<InstalledExtension[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [migrationStates, setMigrationStates] = useState<ReadonlyMap<string, ExtensionMigrationState>>(new Map());
  const [histories, setHistories] = useState<ReadonlyMap<string, ExtensionHistory>>(new Map());

  /**
   * O executor de migração é o sandbox do servidor, pela callable que já existe: ela recebe o código
   * compilado no payload, então uma migração não precisa ser materializada como Script do escritório
   * nem exige function nova. A transpilação é a MESMA do Script (`transpileScriptSource`) — as duas
   * rodam no mesmo sandbox e por isso obedecem à mesma proibição de módulos.
   */
  const migrationDeps = useMemo<MigrationRunnerDeps>(
    () => ({
      transpile: transpileScriptSource,
      run: (compiledJs, providedParams) =>
        scriptRepository.runScript({
          tenantId: currentTenant?.id ?? '',
          compiledJs,
          inputParams: [],
          providedParams,
        }),
      repository: extensionMigrationRepository,
    }),
    [scriptRepository, extensionMigrationRepository, currentTenant],
  );

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar estado local na troca de tenant é exigência arquitetural
      setInstalled([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = installedExtensionRepository.subscribe(currentTenant.id, (list) => {
      setInstalled(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, installedExtensionRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar estado local na troca de tenant é exigência arquitetural
      setMigrationStates(new Map());
      return;
    }
    const unsubscribe = extensionMigrationRepository.subscribe(currentTenant.id, (states) => {
      setMigrationStates(new Map(states.map((state) => [state.pluginId, state])));
    });
    return () => unsubscribe();
  }, [currentTenant, extensionMigrationRepository]);

  /**
   * Só o ÍNDICE do histórico é assinado — dez linhas de metadados por extensão. O pacote de cada
   * entrada fica na subcoleção e só é lido por quem escolhe voltar àquela versão: assiná-lo aqui
   * traria megabytes a cada carga da aplicação para uma pergunta que quase ninguém faz.
   */
  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar estado local na troca de tenant é exigência arquitetural
      setHistories(new Map());
      return;
    }
    const unsubscribe = extensionHistoryRepository.subscribe(currentTenant.id, (list) => {
      setHistories(new Map(list.map((history) => [history.pluginId, history])));
    });
    return () => unsubscribe();
  }, [currentTenant, extensionHistoryRepository]);

  /**
   * O contexto de uma execução. `collections` é lido do escritório NA HORA (e não uma vez por
   * instalação) porque a fase `before` corre antes de os artefatos convergirem e a `after` depois: as
   * duas precisam do mapa como ele está no momento em que o código roda.
   */
  const contextOf = useCallback(
    async (pluginId: string, pkg: MarketplacePlugin, toVersion: string, fromVersion: string | null): Promise<MigrationRunContext> => {
      const tenantId = currentTenant?.id ?? '';
      const screens = tenantId ? await screenDefinitionRepository.getAll(tenantId) : [];
      const keyMap = buildScreenKeyMap(pkg.screens ?? [], screens);
      return {
        pluginId,
        toVersion,
        fromVersion,
        collections: Object.fromEntries(keyMap),
        actor: { tenantId, userId: user?.id ?? '', now: new Date() },
      };
    },
    [currentTenant, user, screenDefinitionRepository],
  );

  /**
   * Uma execução por vez, por escritório e por extensão. A reserva é transacional porque é aqui que
   * dois admins clicando "Atualizar" ao mesmo tempo se encontram; ela expira sozinha, para que uma aba
   * fechada no meio não deixe a extensão travada.
   */
  const withMigrationLock = useCallback(
    async (ctx: MigrationRunContext, work: () => Promise<void>): Promise<void> => {
      const claimed = await claimMigrationRun(migrationDeps, ctx, crypto.randomUUID());
      if (!claimed) throw new LocalizedError('@core.marketplace/migration.error.locked');
      try {
        await work();
      } finally {
        await releaseMigrationRun(migrationDeps, ctx);
      }
    },
    [migrationDeps],
  );

  const failIfNotOk = useCallback((outcome: MigrationRunOutcome): void => {
    if (outcome.ok) return;
    throw new LocalizedError(outcome.failure.message, outcome.failure.messageParams);
  }, []);

  const installedOf = useCallback(
    (id: string) => installed.find((extension) => extension.id === id),
    [installed],
  );

  const install = useCallback(async (input: InstallExtensionInput) => {
    if (!currentTenant || !user) return;
    const id = input.package.manifest.id;
    const existing = installed.find((extension) => extension.id === id);

    /**
     * A guarda fica AQUI, e não na tela que importa, porque esta é a porta por onde toda instalação
     * passa — do catálogo embutido, do registro público, da extensão privada e do arquivo escolhido
     * à mão. Posta em qualquer tela, bastaria importar pela outra para burlá-la.
     */
    const overwrite = translationOverwriteIssue(input.package, existing?.package);
    if (overwrite) throw new LocalizedError(overwrite.message, overwrite.messageParams);
    // Cópia independente e fiel: preserva apenas o estado local `active`; todo o resto vem da fonte.
    const extension: InstalledExtension = {
      id,
      tenantId: currentTenant.id,
      active: existing?.active ?? true,
      package: input.package,
      source: input.source,
      installedVersion: input.version,
      authorId: input.authorId,
      authorName: input.authorName,
      authorPhotoURL: input.authorPhotoURL,
      installedBy: existing?.installedBy ?? user.id,
      // Preservar é seguro: quem decide é o HASH. Código igual mantém a revisão; código alterado
      // deixa de casar com o hash gravado e volta a exigir o gesto.
      codeTrust: existing?.codeTrust ?? null,
      // Mesma razão, outro carimbo: quem aplica os artefatos de backend é o Microteia Console, e a
      // aplicação não pode apagar o que já existe no projeto. Se a versão nova exigir outra coisa, é o
      // FINGERPRINT que deixa de bater — e a extensão volta a ficar pendente sozinha.
      backendState: existing?.backendState ?? null,
      installedAt: existing?.installedAt ?? new Date(),
      updatedAt: new Date(),
    };
    /**
     * A fila de migração é planejada contra o pacote que ESTÁ CHEGANDO e contra o que este escritório
     * já aplicou — nunca por intervalo de versões. Instalação nova (sem `existing`) apenas carimba a
     * fila: migração conserta dado escrito por uma versão anterior desta extensão, e aqui esse dado
     * não existe.
     */
    const plan = planPluginMigrations({
      migrations: input.package.migrations,
      appliedIds: appliedMigrationIds(migrationStates.get(id)),
      freshInstall: existing === undefined,
    });
    const hasMigrationWork = plan.before.length + plan.after.length + plan.baseline.length > 0;

    const applyArtifacts = async (): Promise<void> => {
      // Materializa os artefatos de DADOS (telas/actions/workflows/scripts) da cópia no tenant, antes de
      // gravar o registro — se falhar, nada fica "instalado". Idempotente: reinstalar/atualizar reusa por
      // sourceId. Código-only (ex.: Kanban) = no-op barato. As telas/menus surgem via os stores de dados.
      await applyPackageArtifacts(artifactDeps, input.package, { tenantId: currentTenant.id, userId: user.id, now: new Date() });
      /**
       * A versão APLICADA entra no histórico antes de o registro ser gravado, pela mesma razão dos
       * artefatos acima: se o histórico não puder ser escrito, nada fica instalado.
       *
       * Quem entra é a versão que está sendo aplicada, e não a que sai. Assim a última que o
       * escritório teve já está registrada quando ele desinstalar — não há nada a gravar num gesto
       * que remove —, e reaplicar uma versão vinda do próprio histórico não cria item nenhum: o
       * `record` é idempotente pela revisão.
       */
      const revision = await packageRevision(input.package);
      await extensionHistoryRepository.record(
        currentTenant.id,
        id,
        {
          revision,
          version: input.version,
          source: input.source,
          appliedAt: new Date(),
          appliedBy: user.id,
          appliedByName: effectiveName,
        },
        {
          revision,
          package: input.package,
          source: input.source,
          version: input.version,
          authorId: input.authorId,
          authorName: input.authorName,
          authorPhotoURL: input.authorPhotoURL,
        },
      );
      await installedExtensionRepository.upsert(currentTenant.id, extension);
      notifyArtifactStores();
      setInstalled((prev) =>
        existing ? prev.map((e) => (e.id === id ? extension : e)) : [...prev, extension],
      );
    };

    // O caminho da esmagadora maioria: extensão sem migração não paga leitura, trava nem rodada.
    if (!hasMigrationWork) {
      await applyArtifacts();
      return;
    }

    const ctx = await contextOf(id, input.package, input.version, existing?.installedVersion ?? null);
    await withMigrationLock(ctx, async () => {
      await recordMigrationBaseline(migrationDeps, plan.baseline, ctx);
      /**
       * A fase `before` roda enquanto a declaração ANTIGA ainda vale — é a única janela em que um
       * campo que a versão nova retira continua legível. Falha aqui aborta a atualização inteira, e
       * nada foi tocado ainda.
       */
      failIfNotOk(await runMigrationQueue(migrationDeps, plan.before, ctx));

      await applyArtifacts();

      /**
       * A fase `after` roda com os campos novos já declarados — o caso normal, e por isso com o mapa
       * de coleções relido: a convergência acabou de acontecer. Falha aqui NÃO desfaz a atualização
       * (não há `down`): a versão nova fica instalada e a extensão fica pendente, fora do boot, com o
       * erro na tela de Extensões e o gesto de retentar. Ver `extensionMigrationState`.
       */
      if (plan.after.length === 0) return;
      failIfNotOk(await runMigrationQueue(
        migrationDeps,
        plan.after,
        await contextOf(id, input.package, input.version, existing?.installedVersion ?? null),
      ));
    });
  }, [
    currentTenant, user, effectiveName, installed, installedExtensionRepository, artifactDeps,
    extensionHistoryRepository, migrationStates, migrationDeps, contextOf, withMigrationLock, failIfNotOk,
  ]);

  /**
   * Voltar a uma versão do histórico. O pacote é lido da entrada e entregue à MESMA `install` — não há
   * caminho de rollback separado, e por isso a volta paga tudo o que uma aplicação paga: artefatos
   * convergidos, migração planejada contra o que este escritório já aplicou, e a confiança de código
   * reavaliada pelo hash.
   */
  const restore = useCallback(async (id: string, revision: string) => {
    if (!currentTenant) return;
    const version = await extensionHistoryRepository.getVersion(currentTenant.id, id, revision);
    if (!version) throw new LocalizedError('@core.marketplace/history.error.missing');
    await install({
      package: version.package,
      source: version.source,
      version: version.version,
      authorId: version.authorId,
      authorName: version.authorName,
      authorPhotoURL: version.authorPhotoURL,
    });
  }, [currentTenant, extensionHistoryRepository, install]);

  const pendingMigrationsOf = useCallback(
    (id: string): PluginMigration[] => {
      const extension = installed.find((candidate) => candidate.id === id);
      if (!extension) return [];
      return pendingPluginMigrations(extension.package.migrations, migrationStates.get(id) ?? null);
    },
    [installed, migrationStates],
  );

  /**
   * Retentar a fila fora de uma atualização. Aqui não há artefato a convergir no meio, então as duas
   * fases correm na mesma ordem em que foram declaradas — `before` e `after` só se distinguem quando
   * existe uma convergência entre elas.
   */
  const runMigrations = useCallback(async (id: string) => {
    if (!currentTenant || !user) return;
    const extension = installed.find((candidate) => candidate.id === id);
    if (!extension) return;
    const pending = pendingPluginMigrations(extension.package.migrations, migrationStates.get(id) ?? null);
    if (pending.length === 0) return;
    const ctx = await contextOf(id, extension.package, extension.installedVersion, extension.installedVersion);
    await withMigrationLock(ctx, async () => {
      failIfNotOk(await runMigrationQueue(migrationDeps, pending, ctx));
    });
  }, [currentTenant, user, installed, migrationStates, contextOf, withMigrationLock, migrationDeps, failIfNotOk]);

  const setActive = useCallback(async (id: string, active: boolean) => {
    if (!currentTenant) return;
    await installedExtensionRepository.setActive(currentTenant.id, id, active);
    setInstalled((prev) => prev.map((e) => (e.id === id ? { ...e, active } : e)));
  }, [currentTenant, installedExtensionRepository]);

  const trustCode = useCallback(async (id: string) => {
    if (!currentTenant || !user) return;
    const extension = installed.find((candidate) => candidate.id === id);
    if (!extension) return;
    const hash = await hashExtensionCode(extension.package);
    if (!hash) return;
    const trust = {
      hash,
      trustedBy: user.id,
      trustedByName: effectiveName,
      trustedAt: new Date(),
    };
    await installedExtensionRepository.setCodeTrust(currentTenant.id, id, trust);
    setInstalled((prev) => prev.map((e) => (e.id === id ? { ...e, codeTrust: trust } : e)));
  }, [currentTenant, user, effectiveName, installed, installedExtensionRepository]);

  const uninstall = useCallback(async (id: string) => {
    if (!currentTenant || !user) return;
    // Libera (refcount) os artefatos de dados: só apaga o que nenhuma outra extensão usa. Os registros
    // das telas removidas ficam órfãos (estrutura some, dados ficam). Depois remove o registro da cópia.
    await releasePackageArtifacts(artifactDeps, id, { tenantId: currentTenant.id, userId: user.id, now: new Date() });
    await installedExtensionRepository.delete(currentTenant.id, id);
    notifyArtifactStores();
    setInstalled((prev) => prev.filter((e) => e.id !== id));
  }, [currentTenant, user, installedExtensionRepository, artifactDeps]);

  const value = useMemo(
    () => ({
      installed,
      isLoading,
      migrationStates,
      histories,
      install,
      setActive,
      trustCode,
      uninstall,
      installedOf,
      pendingMigrationsOf,
      runMigrations,
      restore,
    }),
    [
      installed, isLoading, migrationStates, histories, install, setActive, trustCode, uninstall,
      installedOf, pendingMigrationsOf, runMigrations, restore,
    ],
  );

  return <InstalledExtensionStoreContext.Provider value={value}>{children}</InstalledExtensionStoreContext.Provider>;
};
