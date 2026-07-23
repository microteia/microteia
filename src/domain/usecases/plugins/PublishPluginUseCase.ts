import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { IPluginRegistryRepository } from '../../repositories/IPluginRegistryRepository';
import type { ExtensionPointDefinition } from '../../schema/plugin/extensionPoint';
import type { PluginDiagnostic } from '../../schema/plugin/diagnostics';
import { errorsOf, hasErrors } from '../../schema/plugin/diagnostics';
import { validatePluginManifest } from '../../schema/plugin/pluginManifest';

export interface PublishContext {
  points: Map<string, ExtensionPointDefinition>;
  kernelVersion: string;
}

export type PublishResult = { ok: true } | { ok: false; errors: PluginDiagnostic[] };

export type PublishPluginUseCase = {
  execute: (plugin: MarketplacePlugin, publishedBy: string, context: PublishContext) => Promise<PublishResult>;
};

/**
 * Publica um plugin no registro global — SÓ se o manifest for válido contra o kernel em execução.
 * É a guarda de integridade do Marketplace: sem ela, um admin poderia publicar um plugin que
 * falharia ao carregar em todos os escritórios. Validamos como o plugin vai rodar nos tenants:
 * `trusted: false` (terceiro não roda `code`), contra os pontos e a versão do kernel atuais.
 */
export const makePublishPluginUseCase = (repo: IPluginRegistryRepository): PublishPluginUseCase => ({
  execute: async (plugin, publishedBy, context) => {
    const diagnostics = validatePluginManifest(plugin.manifest, {
      trusted: false,
      kernelVersion: context.kernelVersion,
      points: context.points,
    });

    if (hasErrors(diagnostics)) return { ok: false, errors: errorsOf(diagnostics) };

    await repo.publish(plugin, publishedBy);
    return { ok: true };
  },
});
