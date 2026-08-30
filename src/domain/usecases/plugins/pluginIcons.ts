import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { isScreenIconKey } from '../../schema/ui/screenIconCatalog';
import { UI_EXTENSION_POINTS } from '../../schema/ui/uiExtensionPoints';
import type { LocalizedIssue } from './pluginReferences';

/**
 * Os pontos cujo `metadata.icon` é uma chave do catálogo de ícones. É a lista dos pontos de UI do
 * núcleo, e não "qualquer contribuição com um campo `icon`", porque um ponto de OUTRA extensão pode
 * dar a esse nome o significado que quiser — recusá-lo aqui seria o núcleo legislando sobre um
 * vocabulário que não é dele.
 */
const ICON_BEARING_POINTS: ReadonlySet<string> = new Set(UI_EXTENSION_POINTS.map((point) => point.id));

const iconIssue = (icon: string, where: string): LocalizedIssue => ({
  message: '@core.marketplace/issue.package.icon.unknown',
  messageParams: { icon, where },
});

const checked = (icon: unknown, where: string): LocalizedIssue[] =>
  typeof icon === 'string' && icon.trim() !== '' && !isScreenIconKey(icon) ? [iconIssue(icon, where)] : [];

/**
 * Recusa o pacote que escreve um ícone que não existe.
 *
 * Existe porque `icon` era string livre em todos os lugares em que aparece — manifest, contribuição,
 * tela, campo de cartão, ação, view —, e o kernel desenha o marcador genérico para o que não
 * reconhece. Somadas, as duas coisas davam o pior arranjo possível: nada validava, nada falhava, e o
 * nome inventado só se revelava na tela de quem instalou. Foi assim que um exemplo de primeira parte
 * viajou com `refresh`, que nunca existiu, sem que nada o dissesse.
 *
 * Fica no portão do PACOTE — e não em cada tela que desenha — porque é ali que o autor ainda pode
 * corrigir: o `check` do terminal, o `validate_plugin` do MCP e a instalação fazem a mesma pergunta.
 */
export const packageIconIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => [
  ...checked(pkg.manifest?.icon, 'manifest.icon'),
  ...(pkg.manifest?.contributes ?? []).flatMap((contribution, index) =>
    ICON_BEARING_POINTS.has(contribution?.point)
      ? checked(contribution?.metadata?.icon, `contributes[${index}].metadata.icon`)
      : [],
  ),
  ...(pkg.screens ?? []).flatMap((screen, index) => [
    ...checked(screen.icon, `screens[${index}].icon`),
    ...(screen.fields ?? []).flatMap((field) =>
      checked(field.listIcon, `screens[${index}].fields.${field.key}.listIcon`),
    ),
  ]),
  ...(pkg.screenPatches ?? []).flatMap((patch, index) =>
    (patch.fields ?? []).flatMap((field) =>
      checked(field.listIcon, `screenPatches[${index}].fields.${field.key}.listIcon`),
    ),
  ),
  ...(pkg.actions ?? []).flatMap((action, index) => checked(action.icon, `actions[${index}].icon`)),
  ...(pkg.views ?? []).flatMap((view, index) => checked(view.icon, `views[${index}].icon`)),
];
