import type { ThemeBase, ThemeSpec } from './themeSpec';

/**
 * O valor que diz "não escolhi" — e que é o padrão.
 *
 * Ele é uma OPÇÃO visível, e não a mera ausência de preferência, porque as duas coisas se comportam
 * de forma diferente na tela: quem nunca escolheu segue o aparelho e não sabe disso; quem escolheu
 * "Automático" pediu para seguir o aparelho, e continua seguindo quando o aparelho muda de ideia às
 * seis da tarde. Sem o valor explícito não haveria caminho de volta: depois do primeiro clique em
 * "Escuro", só limpando a configuração no banco.
 */
export const AUTOMATIC_THEME = 'automatic';

/**
 * O tema em vigor.
 *
 * A preferência explícita vence, desde que o tema ainda exista — um tema desinstalado não pode
 * deixar a interface sem paleta, então a escolha órfã cai para o automático em vez de quebrar. O
 * automático segue o aparelho, e o aparelho, no fim, cai no primeiro tema do lado pedido.
 *
 * Repare no que NÃO acontece: a preferência órfã não é apagada. Desativar um tema por uma tarde e
 * reativá-lo devolve a aparência de quem o tinha escolhido — do mesmo jeito que uma preferência de
 * idioma sobrevive à desinstalação do pacote.
 */
export const negotiateTheme = (
  preferred: string | null,
  specs: ThemeSpec[],
  systemBase: ThemeBase,
): ThemeSpec | null => {
  if (specs.length === 0) return null;
  if (preferred !== null && preferred !== AUTOMATIC_THEME) {
    const chosen = specs.find((spec) => spec.id === preferred);
    if (chosen) return chosen;
  }
  return specs.find((spec) => spec.extends === systemBase) ?? specs[0];
};
