import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { packageFingerprint } from './packageSerialization';
import { isVersionGreater } from './publicExtension';

/**
 * De onde uma cópia instalada pode receber atualização: as VERSÕES que alguém oferece — a autoria
 * privada do escritório e o catálogo público aprovado — e o pacote do catálogo EMBUTIDO no bundle,
 * quando a extensão é de primeira parte.
 */
export interface ExtensionUpdateSources {
  offeredVersions: string[];
  builtin: MarketplacePlugin | null;
}

/**
 * Se esta cópia instalada tem atualização à espera.
 *
 * São duas perguntas diferentes, e as duas contam: alguém oferece versão MAIOR que a instalada, ou o
 * pacote embutido no bundle DIFERE do que está gravado. A segunda não olha versão de propósito —
 * durante o desenvolvimento de uma extensão de primeira parte a versão fica parada enquanto o
 * conteúdo muda, e comparar a impressão canônica é o que faz a atualização aparecer na hora certa.
 *
 * Está no domínio porque a resposta é a MESMA em dois lugares que não se conhecem: o selo da barra
 * lateral e do alto da tela, e o selo "Atualização" de cada linha do Marketplace. Um número que
 * discordasse do que a tela mostra seria pior do que número nenhum.
 */
export const hasExtensionUpdate = (
  installedVersion: string,
  installedPackage: MarketplacePlugin,
  sources: ExtensionUpdateSources,
): boolean =>
  sources.offeredVersions.some((offered) => isVersionGreater(offered, installedVersion))
  || (sources.builtin !== null
    && packageFingerprint(sources.builtin) !== packageFingerprint(installedPackage));
