import type { ExpressionFunction } from '../FunctionRegistry';
import { grants } from '../../../schema/access/memberPermissions';

/**
 * "Esta pessoa PODE?" — a mesma pergunta que o código, as regras e a tela fazem, agora disponível
 * na declaração: a condição de um passo, o `hiddenWhen` de uma ação, o `disabledWhen` de um campo.
 *
 * O argumento é o identificador da PERMISSÃO (`finance.write`), nunca o de um perfil: uma extensão
 * escreve `hasPermission("push.recheck")` sem saber que perfis existem no escritório que a instalou.
 *
 * Sem ator — a automação que nasce de um gatilho — a resposta é NÃO. Conceder por ausência de pessoa
 * transformaria "ninguém disparou isto" em "pode tudo".
 */
export const hasPermissionFn: ExpressionFunction = {
  name: 'hasPermission',
  call: ([permission], context) => {
    const id = typeof permission === 'string' ? permission.trim() : '';
    if (id === '') return false;
    return grants(context?.actor?.permissions ?? [], id);
  },
  description: '@core.automation/expr.has-permission.description',
  signature: 'hasPermission(permissao)',
  example: 'hasPermission("finance.write")',
  category: '@core.automation/expr.category.conditional',
  minArgs: 1,
};
