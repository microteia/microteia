import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { PluginRecord } from '../../../kernel';
import { makeExtensionViewRef } from './extensionViewRef';
import { withResolvedNavScreens } from './navTargets';

/**
 * Converte o pacote de uma extensão em um `PluginRecord` do Kernel.
 *
 * `mayRunCode` decide se as `views` viram `implementations`. Sem ele, o pacote entra como
 * `trusted: false` e o Kernel ignora qualquer `impl: code` — nav, telas de dados, campos e workflows
 * seguem funcionando, só o JavaScript não roda. Quem responde por essa decisão é
 * `extensionCodeTrust` (procedência do catálogo ou gesto explícito de revisão), nunca a mera
 * presença de código no pacote — era esse o furo: ter `views` bastava para receber confiança.
 *
 * O item de menu que aponta uma tela do pacote (`screen`) entra apontando o `sourceId` dela — ver
 * `withResolvedNavScreens`.
 */
export const extensionRecordFrom = (pkg: MarketplacePlugin, mayRunCode = false): PluginRecord => {
  const manifest = withResolvedNavScreens(pkg);
  const views = pkg.views ?? [];
  if (views.length === 0 || !mayRunCode) return { manifest, trusted: false };
  const implementations = Object.fromEntries(
    views.map((view) => [view.key, makeExtensionViewRef(pkg.manifest.id, view.key, view.source)]),
  );
  return { manifest, trusted: true, implementations };
};
