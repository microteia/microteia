import { describe, expect, it } from 'vitest';
import { PRE_LOGIN_POINTS } from './preLoginPoints';
import { AUTH_PROVIDER_POINT } from '../auth';
import { I18N_MESSAGES_POINT } from '../i18n/extensionPoints';
import { THEME_DEFINITION_POINT, THEME_TOKENS_POINT } from '../theme/extensionPoints';
import { UI_SLOT_POINT } from '../ui/uiExtensionPoints';

describe('os pontos que valem antes do login', () => {
  /**
   * A lista é de STRINGS porque viaja no manifesto do pacote, e um `import` de cada ponto a
   * amarraria ao bundle. O teste é a ponte: um ponto renomeado quebra aqui, e não numa instalação.
   */
  it('cada entrada é um ponto que existe', () => {
    expect([...PRE_LOGIN_POINTS].sort()).toEqual([
      AUTH_PROVIDER_POINT,
      I18N_MESSAGES_POINT,
      THEME_DEFINITION_POINT,
      THEME_TOKENS_POINT,
      UI_SLOT_POINT,
    ].sort());
  });

  it('não repete nenhum', () => {
    expect(new Set(PRE_LOGIN_POINTS).size).toBe(PRE_LOGIN_POINTS.length);
  });
});
