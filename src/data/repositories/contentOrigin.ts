import { EDIT_ORIGIN } from '../../domain/schema/workflowVersion';

/**
 * Toda gravação de CONTEÚDO diz de onde veio: quem não disse é uma edição. É o que o versionamento do
 * servidor copia para a versão — ele não tem como saber se quem gravou foi a tela ou a instalação de uma
 * extensão. Gravação que não toca conteúdo (ligar, desligar, os donos) não leva origem nenhuma.
 */
export const withContentOrigin = <T extends Record<string, unknown>>(data: T, contentKeys: readonly string[]): T =>
  data.contentOrigin === undefined && contentKeys.some((key) => data[key] !== undefined)
    ? { ...data, contentOrigin: EDIT_ORIGIN }
    : data;
