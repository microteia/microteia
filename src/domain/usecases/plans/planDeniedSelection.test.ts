import { describe, expect, it } from 'vitest';
import { buildPermissionCatalog } from '../../schema/access';
import { planDeniedSelection } from './planDeniedSelection';

/**
 * O editor de planos só OFERECE o que é declarado (#24). Aqui `pets.update` é declarada por uma extensão;
 * `pets.attach` também, num dos cenários — no outro ela é a derivada da coleção, que a tela não mostra.
 */
const catalog = buildPermissionCatalog(
  [
    { source: 'com.acme.pets', permission: { id: 'pets.update', name: 'Edit' } },
    { source: 'com.acme.pets', permission: { id: 'pets.attach', name: 'Attach' } },
    { source: 'core', permission: { id: 'screens.manage', name: 'Design' } },
  ],
  [],
);

const HIDDEN = ['pets.annotate', 'pets.attach', 'pets.tag'];

describe('planDeniedSelection — o editor de planos sobre as ações contidas (#41)', () => {
  describe('contidas que a tela NÃO mostra', () => {
    const offerable = ['pets.update', 'screens.manage'];

    it('negar editar nega também anexar, anotar e etiquetar', () => {
      expect(planDeniedSelection(catalog, offerable, ['screens.manage'], [])).toEqual([...HIDDEN, 'pets.update'].sort());
    });

    it('liberar editar de volta libera as três — ninguém as veria para desfazer', () => {
      const denied = [...HIDDEN, 'pets.update'];
      expect(planDeniedSelection(catalog, offerable, ['pets.update', 'screens.manage'], denied)).toEqual([]);
    });

    it('mexer em outra permissão não toca nas contidas de quem continua negada', () => {
      const denied = [...HIDDEN, 'pets.update'];
      expect(planDeniedSelection(catalog, offerable, [], denied)).toEqual([...HIDDEN, 'pets.update', 'screens.manage'].sort());
    });
  });

  describe('contida que a tela MOSTRA', () => {
    const offerable = ['pets.update', 'pets.attach'];

    it('a negação NOVA de editar a arrasta', () => {
      expect(planDeniedSelection(catalog, offerable, ['pets.attach'], [])).toContain('pets.attach');
    });

    it('marcada de volta, fica liberada com editar ainda negado — "bloqueia editar, deixa anexar"', () => {
      const denied = ['pets.annotate', 'pets.attach', 'pets.tag', 'pets.update'];
      const next = planDeniedSelection(catalog, offerable, ['pets.attach'], denied);
      expect(next).not.toContain('pets.attach');
      expect(next).toContain('pets.update');
      expect(next).toContain('pets.annotate');
    });
  });

  it('negada que este catálogo não oferece continua negada — o plano é global', () => {
    const denied = ['finance.update', 'finance.attach'];
    expect(planDeniedSelection(catalog, ['screens.manage'], ['screens.manage'], denied)).toEqual(['finance.attach', 'finance.update']);
  });
});
