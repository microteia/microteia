import { transform } from 'sucrase';
import { usesModuleSyntax } from './scriptModuleSyntax';

export type TranspileScriptResult = { compiledJs: string } | { error: string };

/**
 * TypeScript do usuário → JavaScript que o sandbox executa. A transpilação acontece SEMPRE no
 * cliente, e a Cloud Function nunca transpila: ela recebe `compiledJs` e o trata como hostil de
 * qualquer forma (é o QuickJS que contém, não o transpilador).
 *
 * `import`/`export`/`require` são recusados aqui porque no sandbox não existe resolvedor de módulo —
 * o código que os usasse falharia em execução, com uma mensagem que não diz o motivo. Recusar na
 * gravação é o que transforma isso num erro explicável. Dividir um script em arquivos é coisa da
 * AUTORIA: o compilador do SDK funde a lista (`mergeScriptSources`) antes de o texto chegar aqui.
 *
 * Fonte única do Script (tela "Script") e das MIGRAÇÕES de extensão: as duas rodam no mesmo sandbox
 * e por isso obedecem à mesma regra — duas cópias da regra divergiriam justamente no que ela proíbe.
 */
export const transpileScriptSource = (sourceTs: string): TranspileScriptResult => {
  if (usesModuleSyntax(sourceTs)) {
    return { error: '@core.automation/script.error.no-modules' };
  }
  try {
    const result = transform(sourceTs, { transforms: ['typescript'], disableESTransforms: true });
    if (!result.code.trim()) return { error: '@core.automation/script.error.empty' };
    return { compiledJs: result.code };
  } catch (error) {
    return { error: error instanceof Error ? error.message : '@core.automation/script.error.invalid' };
  }
};
