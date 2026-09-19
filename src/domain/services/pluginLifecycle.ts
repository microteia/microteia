/**
 * QUEM executa uma operação de ciclo de vida de extensão, e quando.
 *
 * O `now` vem de fora de propósito: a data é decidida por quem chama, e nenhuma regra de domínio lê
 * o relógio — é o que faz a materialização de um pacote ser reproduzível num teste.
 *
 * O resto do ciclo de vida (instalar, habilitar, atualizar, desinstalar como transições de um
 * registro) morava aqui e saiu junto com `plugin_installations`: hoje a instalação é a cópia em
 * `installed_extensions`, e a materialização dos artefatos é `applyPackageArtifacts`.
 */
export interface LifecycleActor {
  tenantId: string;
  userId: string;
  now: Date;
}
