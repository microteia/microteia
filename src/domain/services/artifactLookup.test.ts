import { describe, expect, it } from 'vitest';
import { findByArtifactRef } from './artifactLookup';

const utilsScript = { id: 'normalizar-cpf', sourceId: 'normalizar-cpf', ownerPluginIds: ['com.acme.utils'] };
const outroScript = { id: 'normalizar-cpf-2', sourceId: 'normalizar-cpf', ownerPluginIds: ['com.outro.pack'] };
const doEscritorio = { id: 'meu-script', sourceId: null, ownerPluginIds: null };

describe('findByArtifactRef', () => {
  const all = [utilsScript, outroScript, doEscritorio];

  it('acha pelo id local quando a referência não é qualificada', () => {
    expect(findByArtifactRef(all, 'meu-script')).toBe(doEscritorio);
  });

  it('acha pelo sourceId quando a referência é qualificada', () => {
    expect(findByArtifactRef(all, 'com.acme.utils/normalizar-cpf')).toBe(utilsScript);
  });

  /**
   * A deduplicação da instalação é por `sourceId` sozinho, sem olhar de quem é — duas extensões sem
   * relação nenhuma com o mesmo `templateId` já compartilham documento hoje. Sem o filtro de dono,
   * uma referência acharia a cópia da outra, e a troca seria silenciosa.
   */
  it('NÃO acha quando o sourceId bate e o dono não', () => {
    expect(findByArtifactRef(all, 'com.terceiro.pack/normalizar-cpf')).toBeUndefined();
  });

  it('escolhe a cópia do dono certo quando duas dividem o sourceId', () => {
    expect(findByArtifactRef(all, 'com.outro.pack/normalizar-cpf')).toBe(outroScript);
  });

  it('devolve indefinido quando nada casa', () => {
    expect(findByArtifactRef(all, 'com.acme.utils/inexistente')).toBeUndefined();
    expect(findByArtifactRef(all, 'inexistente')).toBeUndefined();
  });
});
