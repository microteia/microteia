/**
 * Versão do contrato que o Kernel oferece aos plugins — independente do `version` do
 * package.json, que é o número de release do produto. Sobe o major quando um Extension Point
 * existente muda de forma de maneira incompatível; o minor quando algo é adicionado.
 */
export const KERNEL_VERSION = '2.101.0';

export const KERNEL_PLUGIN_ID = 'core.kernel';
