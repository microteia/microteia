import { join } from 'node:path';
import { WORKSPACE_DIR } from './workspace.js';

/**
 * Onde o Console extrai a fonte das Cloud Functions que veio DENTRO do pacote de uma extensão.
 *
 * Fica em `.microteia/` de propósito, e é a exceção que confirma a regra daquele diretório: nada ali é
 * digitado por ninguém. É derivado do banco — o pacote instalado está em `installed_extensions` —, então
 * o `unpack` apagar tudo não perde nada: o próximo `provision` extrai de novo. O que o autor escreve
 * continua em `extensions/<pasta>/functions/`, e o Console nunca escreve lá.
 */
export const PACKAGED_FUNCTIONS_DIR = 'packaged-functions';

export const packagedFunctionsPath = (root: string): string => join(root, WORKSPACE_DIR, PACKAGED_FUNCTIONS_DIR);

/**
 * Onde fica a cópia para LEITURA da fonte que ainda não foi aprovada. Separada de propósito: o que está
 * em `packaged-functions/` é montado e sobe; o que está aqui só é lido por quem vai decidir. Uma pasta
 * só obrigaria a apagar o código justamente quando alguém precisa lê-lo para aprovar com `--approve`.
 */
export const PACKAGED_REVIEW_DIR = 'packaged-review';

export const packagedReviewPath = (root: string): string => join(root, WORKSPACE_DIR, PACKAGED_REVIEW_DIR);

export const packagedLabel = (slug: string): string => `${WORKSPACE_DIR}/${PACKAGED_FUNCTIONS_DIR}/${slug}`;

/**
 * O diretório da extensão. O prefixo impede colisão com `extensions/<pasta>`, que vai para o mesmo
 * `custom/src/`: as duas origens viram irmãs ali dentro.
 */
export const packagedSlug = (pluginId: string): string => `package-${pluginId.replace(/[^a-zA-Z0-9]+/g, '-')}`;
