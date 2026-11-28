// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/decimalPrecision.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A conta decimal que o escritório espera de um número de negócio (#48).
 *
 * O valor monetário é um `number` do JavaScript, binário: `0.1 + 0.2` dá `0.30000000000000004`, e um
 * lançamento com débito e crédito iguais ao centavo ficava com a ação desligada por `totalDebit ==
 * totalCredit`. Trocar o armazenamento para inteiro de centavos mudaria o formato de todo dado já
 * gravado — de todo escritório e de toda extensão —, e o defeito não está no valor guardado: está no
 * RESÍDUO que a conta binária deixa. Por isso a correção é assentar o resultado, não mudar o dado.
 *
 * 15 dígitos significativos é o que um `double` representa sem perda (`Number.MAX_SAFE_INTEGER` tem
 * 16): todo valor decimal escrito com até 15 dígitos volta idêntico, e o resíduo, que mora no 16º e
 * no 17º, some. Um valor de negócio — até trilhões com centavos — cabe com folga.
 */
export const DECIMAL_SIGNIFICANT_DIGITS = 15;

/**
 * O número sem o resíduo binário. Inteiro passa intacto: um id ou uma contagem acima de 15 dígitos não
 * pode ser "arredondado", e a conta entre inteiros seguros já é exata.
 */
export const settleDecimal = (value: number): number =>
  Number.isFinite(value) && !Number.isInteger(value)
    ? Number(value.toPrecision(DECIMAL_SIGNIFICANT_DIGITS))
    : value;

/** `settleDecimal` para o resultado de um operador, que pode não ser número (`+` também concatena). */
export const settleIfNumber = (value: unknown): unknown =>
  typeof value === 'number' ? settleDecimal(value) : value;

/**
 * A soma assentada A CADA PASSO, e não só no fim: somando milhares de valores, o resíduo acumulado
 * chegaria ao 15º dígito e o assentamento final já não o separaria do valor. Passo a passo, cada
 * parcial é o decimal exato, e o total também.
 */
export const sumDecimal = (values: readonly number[]): number =>
  values.reduce((total, value) => settleDecimal(total + value), 0);

/**
 * Arredonda em `places` casas como se arredonda dinheiro: no decimal ESCRITO, metade para longe do
 * zero. `Math.round(1.005 * 100) / 100` dá `1`, porque `1.005` é guardado como `1.00499999…`; aqui
 * dá `1.01`. E `-2.5` vai a `-3`, não a `-2` como em `Math.round` — o valor negativo é arredondado
 * como o positivo, que é o que uma tabela de imposto ou um rateio esperam.
 */
export const roundDecimal = (value: number, places = 0): number => {
  if (!Number.isFinite(value)) return value;
  const digits = Number.isFinite(places) ? Math.trunc(places) : 0;
  const factor = 10 ** digits;
  const shifted = settleDecimal(Math.abs(value) * factor);
  const rounded = Math.round(shifted) / factor;
  return settleDecimal(value < 0 ? -rounded : rounded);
};
