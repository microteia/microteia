import { useMemo } from 'react';
import { useKernel } from '../../../stores/useKernel';
import { useInstalledExtensions } from '../../../stores/useInstalledExtensions';
import { reportCodeViewOf } from '../../../domain/usecases/plugins/reportModule';
import { isExtensionViewRef } from '../../../domain/usecases/plugins/extensionViewRef';
import { evaluateExtensionView } from '../extensions/evaluateExtensionView';
import type { ExtensionPageComponent } from '../extensions/evaluateExtensionView';
import type { ReportDefinition } from '../../../domain/entities/Report';

/**
 * A view que desenha o corpo da aba deste relatório, quando o pacote dono declara uma
 * (`reports[].view`) E o código dele pode rodar aqui.
 *
 * A segunda condição não é conferida à parte: o registro de implementações só recebe as `views` de um
 * pacote confiado (`extensionRecordFrom`) e ligado. Sem confiança — ou com a extensão desligada, ou num
 * kernel que ainda não leu o pacote —, a resposta é `undefined`, e a aba mostra o corpo padrão. Nunca
 * fica em branco.
 */
export const useReportCodeView = (report: ReportDefinition | undefined): ExtensionPageComponent | undefined => {
  const { host } = useKernel();
  const { installedOf } = useInstalledExtensions();

  return useMemo(() => {
    if (!report) return undefined;
    const declared = reportCodeViewOf(report, (pluginId) => installedOf(pluginId)?.package);
    if (!declared) return undefined;
    const impl = host.implementations.resolve<unknown>(declared.pluginId, declared.viewKey);
    return isExtensionViewRef(impl) ? evaluateExtensionView(`${impl.pluginId}::${impl.viewKey}`, impl.source) : undefined;
  }, [report, host, installedOf]);
};
