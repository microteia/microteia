import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { recordSurfaceSourceId } from '../../schema/ui/uiExtensionPoints';
import type { LocalizedIssue } from './pluginReferences';

/**
 * Recusa a contribuição endereçada a `record:` sem dizer de QUAL tela.
 *
 * O detalhe de um registro só lê a superfície da própria tela (`record:<sourceId>`), e uma aba em
 * `record:` não casa com nenhuma: instalaria, não daria erro em lugar nenhum e nunca apareceria. Fica
 * no portão do pacote pelo mesmo motivo do ícone — é ali que o autor ainda pode corrigir.
 *
 * O `sourceId` que NÃO se acha não é recusado aqui: a tela pode ser de outra extensão, e este portão
 * só tem um pacote em mãos. Quem diz isso é o `check` do terminal, como aviso.
 */
export const packageSurfaceIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  (pkg.manifest?.contributes ?? []).flatMap((contribution, index) => {
    const surface = contribution?.metadata?.surface;
    if (typeof surface !== 'string' || recordSurfaceSourceId(surface) !== '') return [];
    return [{
      message: '@core.marketplace/issue.package.record-surface.no-source-id',
      messageParams: { id: String(contribution?.id), where: `contributes[${index}].metadata.surface` },
    }];
  });
