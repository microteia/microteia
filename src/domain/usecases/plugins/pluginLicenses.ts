import { isWidgetSpec } from '../../schema/ui/widgetSpec';
import type { WidgetSpec } from '../../schema/ui/widgetSpec';
import type { PluginManifest } from '../../schema/plugin/pluginManifest';

/**
 * O termo de licença de UM plugin, já separado do resto do manifest.
 *
 * `name` viaja como está no manifest — literal ou referência `@ns/chave`. Resolver aqui exigiria um
 * idioma, e a mesma lista é lida pela tela de Termos e pela de Extensões, cada uma no seu ponto de
 * render. Quem exibe chama `resolveLabel`.
 */
export interface PluginLicense {
  pluginId: string;
  name: string;
  license: WidgetSpec;
}

/**
 * O termo do plugin, ou `null` quando não há o que mostrar.
 *
 * A pergunta é `isWidgetSpec`, e não "declarou alguma coisa?", porque quem oferece o gesto tem de
 * saber se aquilo DESENHA: um manifest com `license: {}` passaria por qualquer teste de presença e
 * abriria um modal vazio, que ensina "esta extensão não tem licença" — o contrário de o autor ter
 * escrito um termo malformado.
 */
export const licenseOf = (manifest: PluginManifest | undefined): WidgetSpec | null =>
  isWidgetSpec(manifest?.license) ? manifest.license : null;

/**
 * Os termos dos plugins que declararam um, na ordem em que os manifests chegam.
 *
 * É a lista que a página de Termos acrescenta ao contrato da Microteia. Ela vem do que o Kernel
 * CARREGOU, e não do que está instalado: extensão desativada, reprovada por dependência ou com
 * migração em dívida não está no ar, e um termo que não vale não deve aparecer num documento cuja
 * função é dizer exatamente o que vale.
 */
export const collectPluginLicenses = (
  manifests: (PluginManifest | undefined)[],
): PluginLicense[] =>
  manifests.flatMap((manifest) => {
    const license = licenseOf(manifest);
    return license === null || manifest === undefined
      ? []
      : [{ pluginId: manifest.id, name: manifest.name, license }];
  });
