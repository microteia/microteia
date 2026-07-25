import type { ICommandPaletteProvider } from '../../components/ui/CommandPalette/providers/ICommandPaletteProvider';
import { registerCommandProvider } from './extensionServices';

/**
 * A superfície de REGISTRO de serviços entregue ao `startup(host)` de uma extensão. É o teto do que o
 * código de inicialização pode registrar no host — hoje, provedores de comando (⌘K). Ampliar é uma
 * decisão consciente: adicione um serviço aqui (busca universal, links de markdown…), nunca um objeto
 * amplo. O escopo por `pluginId` garante o teardown correto ao desativar a extensão.
 */
export interface ExtensionHost {
  commands: {
    /** Registra um provedor de itens para o ⌘K (mesmo contrato dos provedores nativos). */
    register: (provider: ICommandPaletteProvider) => void;
  };
}

export const makeExtensionHost = (pluginId: string): ExtensionHost => ({
  commands: {
    register: (provider) => registerCommandProvider(pluginId, provider),
  },
});
