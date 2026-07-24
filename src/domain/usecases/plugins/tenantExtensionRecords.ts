import type { TenantExtension } from '../../entities/TenantExtension';
import type { PluginRecord } from '../../../kernel';
import { makeExtensionViewRef } from './extensionViewRef';

/**
 * Extensões AUTORAIS ATIVAS do próprio escritório viram `PluginRecord`s do Kernel do tenant — o
 * espelho de `installedPluginRecords`, mas com a fonte no próprio tenant. **Self-trust:** é código
 * que o próprio autor escreveu e ativou no seu escritório, então roda sem aprovação (decisão do
 * usuário); a aprovação do SYSTEM só é exigida para publicar/instalar em OUTROS escritórios.
 *
 * Extensão com `views` é `trusted: true` e recebe os marcadores `ExtensionViewRef` (avaliados sob
 * demanda pela apresentação). Sem `views`, `trusted: false` — nav/telas de dados seguem sem código.
 */
export const tenantExtensionRecords = (extensions: TenantExtension[]): PluginRecord[] =>
  extensions
    .filter((extension) => extension.active)
    .map((extension) => {
      const views = extension.package.views ?? [];
      if (views.length === 0) return { manifest: extension.package.manifest, trusted: false };
      const implementations = Object.fromEntries(
        views.map((view) => [view.key, makeExtensionViewRef(extension.package.manifest.id, view.key, view.source)]),
      );
      return { manifest: extension.package.manifest, trusted: true, implementations };
    });
