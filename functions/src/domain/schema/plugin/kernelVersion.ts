// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/plugin/kernelVersion.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Versão do contrato que o Kernel oferece aos plugins — independente do `version` do
 * package.json, que é o número de release do produto. Sobe o major quando um Extension Point
 * existente muda de forma de maneira incompatível; o minor quando algo é adicionado.
 */
export const KERNEL_VERSION = '2.61.0';

export const KERNEL_PLUGIN_ID = 'core.kernel';
