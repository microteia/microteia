/**
 * Um PERFIL DE ACESSO do escritório: um nome e um conjunto de permissões.
 *
 * Ele não é mecanismo de autorização — é agrupamento administrativo. Nenhuma tela, nenhum ViewModel
 * e nenhuma regra pergunta por um perfil: todos perguntam por permissão. É isso que permite ao
 * escritório inventar "Advogado Sênior" amanhã sem que uma linha de código mude.
 *
 * `permissions` guarda SÓ o que o administrador marcou. O que ele arrasta consigo é recalculado a
 * cada leitura pelo resolver — gravar o resultado congelaria a dependência no dia em que ela mudasse.
 */
export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  /** As explícitas. Ver `resolveEffective` para as efetivas. */
  permissions: string[];
  /**
   * Perfil controlado pelo SISTEMA: não se edita nem se exclui pela tela. Hoje nenhum nasce assim —
   * o campo existe porque a distinção precisa estar no dado desde o começo, e não ser retrofitada no
   * dia em que o primeiro perfil protegido aparecer.
   */
  system: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

export type RoleInput = Pick<Role, 'name' | 'permissions'> & { description?: string | null };
