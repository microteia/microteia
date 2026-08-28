import type { BackendResidue } from '../../entities/BackendResidue';

/**
 * A retirada tem duas metades, e esta é a que faltava aparecer na tela.
 *
 * `forInstalledExtension` impede a function de agir no escritório que a desinstalou; `provision --prune`
 * a tira do projeto quando nenhum escritório a quer mais. A segunda é um ato explícito de quem tem o
 * projeto — apagar é destrutivo e irreversível, e isso está certo. O que estava errado é que ninguém
 * tinha como saber que ele era necessário: a conclusão do `provision` morria no terminal de quem rodou o
 * comando, e quem lê a tela de Extensões não é necessariamente quem tem acesso ao projeto Firebase.
 *
 * O selo "Backend pendente" já cobre a INSTALAÇÃO. Isto é o par dele, o da RETIRADA.
 */
export const backendResidueCount = (residue: BackendResidue | null): number =>
  residue === null ? 0 : residue.orphanFunctions.length + residue.orphanIndexes.length;

export const hasBackendResidue = (residue: BackendResidue | null): boolean =>
  backendResidueCount(residue) > 0;
