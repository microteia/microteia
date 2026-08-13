import type { ICommandPaletteProvider } from '../../components/ui/CommandPalette/providers/ICommandPaletteProvider';
import {
  registerCommandProvider,
  registerMentionProvider,
  registerSettingsSection,
  registerSurfaceWidget,
  type ExtensionMentionProvider,
  type ExtensionSettingsSection,
  type ExtensionSurfaceWidget,
} from './extensionServices';

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
  mentions: {
    /** Adiciona um tipo de menção `@` no editor de texto, que insere um link para os registros. */
    register: (provider: ExtensionMentionProvider) => void;
  };
  widgets: {
    /**
     * Coloca um cartão numa superfície de outra tela (o Dashboard, por exemplo). A extensão declara o
     * padrão — se vem ligado e com que largura —; quem decide de fato é a configuração da
     * superfície, editada na tela de Configurações.
     */
    register: (widget: ExtensionSurfaceWidget) => void;
  };
  settings: {
    /**
     * Declara uma seção da tela de Configurações. As propriedades declaradas ganham editor
     * automático; `editor` substitui o desenho padrão quando a seção precisa de um gesto próprio.
     */
    register: (section: ExtensionSettingsSection) => void;
  };
}

export const makeExtensionHost = (pluginId: string): ExtensionHost => ({
  commands: {
    register: (provider) => registerCommandProvider(pluginId, provider),
  },
  mentions: {
    register: (provider) => registerMentionProvider(pluginId, provider),
  },
  widgets: {
    register: (widget) => registerSurfaceWidget(pluginId, widget),
  },
  settings: {
    register: (section) => registerSettingsSection(pluginId, section),
  },
});
