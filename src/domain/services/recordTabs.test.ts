import { describe, expect, it } from 'vitest';
import { childTabKey, childTabScreens, screensWithChildTabs } from './recordTabs';

const screens = [
  { id: 'processos', sourceId: 'microteia:processo' },
  { id: 'pessoas', sourceId: 'microteia:pessoa' },
  { id: 'anexos', sourceId: 'microteia:anexo', parentEntity: 'processos', parentFieldKey: 'processo' },
  { id: 'ocultas', parentEntity: 'pessoas', parentFieldKey: 'pessoa', hideFromParentTabs: true },
  { id: 'sem-vinculo', parentEntity: 'pessoas' },
];

describe('as abas de tela-filha de um registro', () => {
  it('a chave sai do sourceId da filha, e da chave quando ela não tem um', () => {
    expect(childTabKey({ id: 'anexos', sourceId: 'microteia:anexo' })).toBe('child:microteia:anexo');
    expect(childTabKey({ id: 'partes' })).toBe('child:partes');
  });

  it('só vira aba a filha com campo de vínculo e que a Form Design não tirou do pai', () => {
    expect(childTabScreens(screens, 'processos').map((screen) => screen.id)).toEqual(['anexos']);
    expect(childTabScreens(screens, 'pessoas')).toEqual([]);
  });

  it('lista as telas que têm ao menos uma aba de tela-filha', () => {
    expect(screensWithChildTabs(screens)).toEqual(['microteia:processo']);
  });
});
