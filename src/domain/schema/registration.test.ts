import { describe, expect, it } from 'vitest';
import { registrationPolicyOf } from './registration';

describe('registrationPolicyOf — defaultLocale', () => {
  it('documento ausente: o escritório novo nasce sem idioma escolhido', () => {
    expect(registrationPolicyOf(undefined).defaultLocale).toBeNull();
  });

  it('normaliza a forma escrita à mão', () => {
    expect(registrationPolicyOf({ defaultLocale: 'pt_br' }).defaultLocale).toBe('pt-BR');
  });

  it('o que não é idioma vale como nenhum', () => {
    for (const value of [null, '', '  ', 42, 'português', 'pt BR']) {
      expect(registrationPolicyOf({ defaultLocale: value }).defaultLocale).toBeNull();
    }
  });

  it('idioma sem tradução instalada é aceito — a validação é pela forma', () => {
    expect(registrationPolicyOf({ defaultLocale: 'es-MX' }).defaultLocale).toBe('es-MX');
  });
});
