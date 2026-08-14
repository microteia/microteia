import type { PluginRecord } from '../../kernel';
import { ptBrLicensePlugin } from './ptBrLicense';

/**
 * Os pacotes de idioma que viajam NO BUNDLE, e não instalados por escritório.
 *
 * Só entra aqui o que serve às telas PÚBLICAS. O `LocaleProvider` de cima — o que atende `/login` e
 * `/license` — enxerga apenas `CORE_PLUGINS`, porque ali ainda não há escritório nem sessão; um
 * pacote instalado num tenant jamais chegaria a essas telas.
 *
 * Todo o resto da tradução continua sendo extensão instalável, e deve continuar: o idioma da
 * INTERFACE é escolha do escritório. O que está aqui é o que é igual para todos.
 *
 * **Acrescentar um idioma é criar o arquivo ao lado e somar uma linha nesta lista.** Nada no Kernel
 * muda, e nenhum outro plugin precisa saber.
 */
export const BUNDLED_LOCALE_PLUGINS: PluginRecord[] = [ptBrLicensePlugin];
