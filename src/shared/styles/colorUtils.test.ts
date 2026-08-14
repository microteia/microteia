import { describe, expect, it } from 'vitest';
import { DEFAULT_TAG_COLOR_LABEL, nextLookupOptionColor } from './colorUtils';
import { darkTheme } from './theme';

const AZUL = darkTheme.tagColors.find((color) => color.label === DEFAULT_TAG_COLOR_LABEL)!.value;
const INDIGO = darkTheme.tagColors.find((color) => color.label === '@core.ui/color.indigo')!.value;

/**
 * A opção criada pelo usuário no próprio campo tinha de nascer com cor: numa lista colorida, ela
 * ficava apagada ao lado das que vieram declaradas pela extensão.
 */
describe('nextLookupOptionColor', () => {
  it('não inventa cor em lista sem cor', () => {
    expect(nextLookupOptionColor([], false, darkTheme)).toBeUndefined();
    expect(nextLookupOptionColor([undefined, undefined], undefined, darkTheme)).toBeUndefined();
  });

  it('a lista declarada como colorida nasce colorida mesmo vazia', () => {
    expect(nextLookupOptionColor([], true, darkTheme)).toBe(AZUL);
  });

  /** A lista mostra o que é: se as opções existentes têm cor, a nova também tem. */
  it('lista com opções coloridas colore a nova sem precisar da declaração', () => {
    expect(nextLookupOptionColor(['caseStatusWon'], false, darkTheme)).toBe(AZUL);
  });

  it('não repete a cor de uma opção que já está na lista', () => {
    expect(nextLookupOptionColor([AZUL], true, darkTheme)).toBe(INDIGO);
  });

  /** Token do tema entra na comparação resolvido, senão a mesma cor sairia duas vezes. */
  it('compara token do tema pela cor que ele produz', () => {
    const theme = { ...darkTheme, colors: { ...darkTheme.colors, success: AZUL } };
    expect(nextLookupOptionColor(['success'], true, theme)).toBe(INDIGO);
  });

  it('esgotada a paleta, volta a girar em vez de ficar sem cor', () => {
    const all = darkTheme.tagColors.map((color) => color.value);
    expect(all).toContain(nextLookupOptionColor(all, true, darkTheme));
  });
});
