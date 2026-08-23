import type { ExpressionFunction } from '../FunctionRegistry';
import { matchesPermission } from '../../../schema/access/permissionPattern';

/**
 * "Esta pessoa PODE?" — a mesma pergunta que o código, as regras e a tela fazem, agora disponível
 * na declaração: a condição de um passo, o `hiddenWhen` de uma ação, o `disabledWhen` de um campo.
 *
 * O argumento é o identificador da PERMISSÃO (`finance.write`), nunca o de um perfil: uma extensão
 * escreve `hasPermission("push.recheck")` sem saber que perfis existem no escritório que a instalou.
 *
 * Aceita curinga: `*.delete`, `pet%.read`. NÃO aceita `<entity>` — uma automação não está presa a
 * uma coleção, e o marcador só significa algo onde há uma tela em volta.
 *
 * Sem ator — a automação que nasce de um gatilho — a resposta é NÃO. Conceder por ausência de pessoa
 * transformaria "ninguém disparou isto" em "pode tudo".
 */
export const hasPermissionFn: ExpressionFunction = {
  name: 'hasPermission',
  call: ([permission], context) => {
    const pattern = typeof permission === 'string' ? permission : '';
    // Sem entidade: uma automação não está presa a uma coleção, então `<entity>` não tem o que
    // significar aqui e o padrão que o usa não casa. Curinga (`*`, `%`) e identificador exato valem.
    return matchesPermission(context?.actor?.permissions ?? [], pattern);
  },
  description: '@core.automation/expr.has-permission.description',
  signature: 'hasPermission(permissao)',
  example: 'hasPermission("finance.write")',
  category: '@core.automation/expr.category.conditional',
  minArgs: 1,
};
