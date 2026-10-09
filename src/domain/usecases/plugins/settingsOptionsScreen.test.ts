import { describe, expect, it } from 'vitest';
import { resolveSettingsOptionsScreen } from './settingsOptionsScreen';

const screen = (id: string, extra: { sourceId?: string; dataCollection?: string } = {}) => ({ id, ...extra });

describe('resolveSettingsOptionsScreen — a coleção de optionsFrom, lida no escritório', () => {
  /** A instalação deu sufixo à chave: o nome declarado agora é de OUTRA tela, que não é a do pacote. */
  it('a tela do próprio pacote é achada pelo sourceId, mesmo com a chave desambiguada', () => {
    const own = screen('medicos_2', { sourceId: 'acme:medico' });
    const other = screen('medicos');
    const found = resolveSettingsOptionsScreen(
      'medicos',
      [{ key: 'medicos', sourceId: 'acme:medico' }],
      [other, own],
    );
    expect(found).toBe(own);
  });

  it('um nome global vai para a tela que descreve a coleção, preferindo a dona', () => {
    const view = screen('clientes', { dataCollection: 'persons' });
    const owner = screen('persons');
    expect(resolveSettingsOptionsScreen('persons', [], [view, owner])).toBe(owner);
    expect(resolveSettingsOptionsScreen('persons', [], [view])).toBe(view);
  });

  it('aceita a chave de uma tela, como a referência aceita', () => {
    const bound = screen('processos', { dataCollection: 'cases' });
    expect(resolveSettingsOptionsScreen('processos', [], [bound])).toBe(bound);
  });

  it('nada no escritório responde: null', () => {
    expect(resolveSettingsOptionsScreen('persons', [], [screen('outra')])).toBeNull();
  });
});
