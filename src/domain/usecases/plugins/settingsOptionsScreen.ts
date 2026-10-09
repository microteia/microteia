import type { ScreenDefinition } from '../../entities';
import type { ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import { templateCollection, templateSourceId } from './screenModule';
import { screenDataCollection } from '../../services/screenDataCollection';

type InstalledScreen = Pick<ScreenDefinition, 'id' | 'sourceId' | 'dataCollection'>;
type PackageScreen = Pick<ScreenModuleTemplate, 'key' | 'sourceId' | 'dataCollection'>;

/**
 * A tela de onde uma propriedade de Configurações `optionsFrom: { kind: 'entity' }` tira os registros.
 *
 * A declaração nomeia a coleção como um campo `reference` a nomearia no pacote — e a instalação
 * reescreve o `refEntity` do campo quando a chave da tela ganha sufixo no escritório (`medicos` →
 * `medicos_2`). Uma contribuição não é reescrita: ela é lida do manifest instalado, tal como veio.
 * Esta função faz, na LEITURA, a mesma tradução que a instalação faz no campo:
 *
 * 1. a coleção é de uma tela do PRÓPRIO pacote → a tela instalada com o mesmo `sourceId`, onde quer
 *    que a chave tenha ido parar;
 * 2. senão, é um nome global (o de uma dependência, como `persons`) → a tela que descreve aquela
 *    coleção, preferindo a que a possui;
 * 3. por fim, a chave de uma tela, como `useReferenceOptions` também aceita.
 *
 * `null` quando nada no escritório responde — a extensão dona da tela não está instalada.
 */
export const resolveSettingsOptionsScreen = <T extends InstalledScreen>(
  collection: string,
  packageScreens: readonly PackageScreen[],
  screens: readonly T[],
): T | null => {
  const own = packageScreens.find((template) =>
    template.key === collection || templateCollection(template) === collection);
  if (own) {
    const installed = screens.find((screen) => (screen.sourceId ?? screen.id) === templateSourceId(own));
    if (installed) return installed;
  }

  const describing = screens.filter((screen) => screenDataCollection(screen) === collection);
  const owner = describing.find((screen) => screen.id === collection) ?? describing[0];
  if (owner) return owner;

  return screens.find((screen) => screen.id === collection) ?? null;
};
