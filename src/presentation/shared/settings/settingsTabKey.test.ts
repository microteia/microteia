import { describe, expect, it } from 'vitest';
import { settingsTabKey, settingsTabTarget } from './settingsTabKey';

describe('a aba de Configurações aberta numa seção', () => {
  it('ida e volta: a chave diz o escopo e a seção', () => {
    expect(settingsTabTarget(settingsTabKey('tenant', 'customization'))).toEqual({ scope: 'tenant', sectionKey: 'customization' });
  });

  it('a aba comum, um escopo desconhecido ou uma seção vazia não apontam para lugar nenhum', () => {
    expect(settingsTabTarget('settings')).toBeNull();
    expect(settingsTabTarget(undefined)).toBeNull();
    expect(settingsTabTarget('settings:office:customization')).toBeNull();
    expect(settingsTabTarget('settings:tenant:')).toBeNull();
  });
});
