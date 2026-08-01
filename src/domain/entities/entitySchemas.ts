// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/entities/entitySchemas.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { ENTITY_REGISTRY_LIST } from '../schema/entityRegistry';
import type {
  CustomFieldMask,
  CustomFieldOption,
  CustomFieldType,
  FieldAggregation,
  FieldLogic,
  FieldOrigin,
  FieldRules,
} from '../schema/fieldRules';

// ─── Tipos de Campos Customizados ─────────────────────────────────────────────

export type { CustomFieldType, CustomFieldMask, CustomFieldOption, FieldOrigin } from '../schema/fieldRules';

export type CustomFieldValue = string | string[] | number | boolean | null;

// ─── Definição de Campo ───────────────────────────────────────────────────────

export interface FieldDefinition {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  order: number;
  section?: string | null;
  options?: CustomFieldOption[];
  optionsAllowUserAdd?: boolean;
  optionsColored?: boolean;
  multi?: boolean;
  mask?: CustomFieldMask | null;
  refEntity?: string | null;
  /**
   * Nome pelo qual o registro APONTADO é navegado nas expressões e automações
   * (`event.contract.client.name`), quando ele difere da chave do campo (`contractId`). Ausente, a
   * navegação é pela própria chave.
   *
   * Existe para que uma entidade declarada por extensão preserve os caminhos que as automações do
   * escritório já usam: era o `denormKey` que só as relações do kernel tinham.
   */
  refDenormKey?: string | null;
  lookupCollection?: string | null;
  placeholder?: string | null;
  showInList?: boolean;
  listLabel?: string | null;
  /**
   * Ícone da meta-linha do campo no card da listagem (nome do registro de ícones de tela). Quando
   * presente, o campo vira uma LINHA do card — com ícone, na ordem do campo —, e não um item do
   * bloco de campos adicionais. É a forma de autoria do `ui.list.icon` que as entidades do kernel
   * declaram em código: sem ele, uma tela de extensão não teria como reproduzir o card de uma tela
   * fixa que ela substitui.
   */
  listIcon?: string | null;
  /**
   * Posição da meta-linha no card, quando ela deve diferir da ordem do campo no formulário — o card
   * costuma querer outra sequência (no Processo, o responsável vem primeiro e é o 15º campo do
   * formulário). Ausente, vale `order`.
   */
  listOrder?: number | null;
  filterable?: boolean;
  /**
   * Valor com que o campo NASCE num registro novo — o que o formulário mostra antes de o usuário
   * tocar nele. Só semeia: o valor é livremente editável, ao contrário de `logic.compute`, que
   * deriva sempre, e de `logic.onChange`, que reage a outro campo.
   *
   * Existe porque um cadastro tem quase sempre um caso dominante ("Pessoa Física", "Ativo") que a
   * entidade fixa embutia em código no formulário. Sem ele, uma tela declarada não teria como
   * reproduzir esse padrão — o usuário escolheria o mesmo valor a cada registro.
   */
  defaultValue?: CustomFieldValue;
  /**
   * Código GERADO com que o campo nasce num registro novo, quando ele está vazio. O padrão descreve
   * a forma, caractere a caractere: `A` é letra, `0` é dígito, `*` é letra ou dígito, e qualquer
   * outro caractere entra literal (`AA-0000`). O valor sorteado não se repete entre os registros já
   * carregados da coleção, e continua editável — é uma sugestão, não um carimbo.
   *
   * Diferente de `defaultValue`, que semeia um valor FIXO: aqui o valor é diferente a cada registro.
   * Existe porque um cadastro costuma ter um identificador curto que ninguém quer digitar (o número
   * do contrato, um protocolo, um código de peça) e a entidade fixa o sorteava em código — sem isto,
   * uma tela declarada não teria como reproduzi-lo.
   */
  autoValue?: { pattern: string } | null;
  rules?: FieldRules | null;
  logic?: FieldLogic | null;
  aggregation?: FieldAggregation | null;
  /**
   * Onde o campo foi declarado. `builtin` e `plugin` não podem ser EXCLUÍDOS pelo usuário; todas as
   * demais propriedades são livremente editáveis em qualquer origem.
   *
   * Um campo `builtin` só aparece em `fields[]` depois de editado pelo usuário: até lá ele vive
   * apenas em `entityRegistry.ts`, e o Form Design materializa a declaração INTEIRA no documento no
   * primeiro ajuste. A partir daí o documento é a verdade — como já acontece com `plugin` e
   * `design`. Ver `resolveScreenFields` em `schema/screenEntity.ts`.
   */
  origin: FieldOrigin;
  /** Esconde o campo do formulário sem excluí-lo — a alternativa para os campos não-excluíveis. */
  hiddenInForm?: boolean | null;
  /**
   * Presente quando o campo foi trazido por uma extensão (`origin: 'plugin'`): identifica QUAL
   * extensão, o que dirige o upgrade (substitui os do plugin, preserva os do usuário) e o refcount
   * de desinstalação.
   */
  ownerPluginId?: string | null;
}

// ─── Definição de Tela ────────────────────────────────────────────────────────

/**
 * Ação do cartão de um registro, pelo SLOT que ela ocupa. Aberta para `string` pelo mesmo motivo de
 * `EntityKey`: o conjunto passou a ser DADO — as ações são contribuições do ponto
 * `ui.record.action` —, e não uma união fechada no tipo. Uma extensão que registre a sua aparece na
 * configuração da tela sozinha; fechado aqui, o nome dela nunca poderia ser habilitado.
 *
 * As quatro de sempre (`copyLink`, `clone`, `manageTags`, `delete`) continuam sendo os slots que o
 * `core.records` contribui.
 */
export type ScreenListAction = string;

/**
 * Uma tela É uma entidade, e o seu `id` É o nome da coleção no Firestore:
 * `tenants/{tenantId}/{id}/{recordId}`, com os campos na raiz do documento. Vale igualmente para as
 * fixas (`persons`), as de extensão (`produtos`) e as do Form Design (`medico`) — a única
 * diferença entre elas é o `origin`.
 */
export interface ScreenDefinition {
  id: string;
  tenantId: string;
  /**
   * Onde a tela foi declarada. `builtin` e `plugin` não podem ser excluídas; o resto da configuração
   * (rótulos, ícone, ordem, abas, ações, campos adicionais) é livremente editável nas três.
   */
  origin: FieldOrigin;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  fields: FieldDefinition[];
  titleFieldKey: string;
  /**
   * Campo exibido como SUBTÍTULO no detalhe (abaixo do título, ao lado do ícone) e como rótulo da
   * ABA — tipicamente um identificador curto e único, que cabe melhor numa aba do que o título
   * (o número do processo, o número do contrato). Ausente = sem subtítulo, e a aba leva o título.
   */
  subtitleFieldKey?: string | null;
  hasNotes: boolean;
  hasDocuments: boolean;
  hasTags: boolean;
  /**
   * Coleção onde as etiquetas desta tela ficam. Duas telas que apontem para a mesma coleção
   * compartilham as etiquetas — é o mesmo mecanismo de `lookupCollection` num campo.
   */
  tagCollection?: string | null;
  /**
   * Coleção onde os REGISTROS desta tela vivem, quando não é a própria chave. Ausente (o normal) =
   * a tela é dona da coleção de mesmo nome.
   *
   * Presente, a coleção deixa de ser a IDENTIDADE da tela e vira uma propriedade dela: a chave passa
   * a endereçar só a UI (abas, deep link, filtros salvos) e a tela opera documentos que já existem —
   * tipicamente os de uma entidade do kernel (`cases`). O que ela DECLARA (campos, listas de opções,
   * relações, etiquetas, linhas do card, filtros) vale para a coleção, somando-se por chave de campo
   * ao que a tela de mesmo nome e o `entityRegistry` declaram (`createSchemaContext`).
   *
   * É a peça que permite uma extensão descrever inteiramente uma entidade nativa e substituí-la sem
   * mover um registro: enquanto as duas convivem, as declarações se sobrepõem; quando a entidade sai
   * do kernel, resta a da extensão. Ver "A coleção é propriedade da tela" no ARCHITECTURE.md.
   */
  dataCollection?: string | null;
  /**
   * Prefixo da aba que abre UM registro desta tela: a chave é `prefixo + id`. Ausente, vale a aba
   * genérica (`view-dyn:<chave>:`).
   *
   * Existe porque uma extensão pode trazer o próprio editor (`processo-edit:`), e quem abre um
   * registro de fora — a Auditoria, uma menção, o card de outra tela — não tem como adivinhar isso.
   * Sem a declaração, cada chamador reinventava o endereço: o mesmo processo abria numa tela pela
   * menção e noutra pela auditoria.
   */
  recordTabPrefix?: string | null;
  /**
   * Prefixo dos eventos de automação desta coleção (`case` → `case.saved`). Ausente = o nome da
   * coleção. Existe para que uma entidade possa mudar de dono — sair do kernel e passar a ser
   * declarada por uma extensão — sem renomear os eventos que as automações do escritório escutam.
   */
  eventPrefix?: string | null;
  /**
   * Papéis do tenant que podem CRIAR e EDITAR registros desta coleção. Ausente = a permissão padrão
   * (qualquer membro com escrita). É o que permite uma tela declarar uma restrição mais estrita —
   * "só advogado ou admin mexe em processo" — sem que a regra precise citar a coleção pelo nome no
   * `firestore.rules`, que a lê do documento da tela. Exclusão segue sendo só admin.
   */
  writeRoles?: string[] | null;
  listActions: ScreenListAction[];
  /** Ids de `ActionDefinition` exibidos no cabeçalho da tela de detalhe. */
  viewActionIds: string[];
  /** Ids de `ActionDefinition` exibidos no card da listagem. */
  cardActionIds: string[];
  /**
   * Quando presente, a tela é FILHA de outra: sai do menu lateral e da busca ⌘K, e seus registros
   * aparecem como uma aba do registro-pai. Aceita a chave de uma tela fixa ('contracts', 'persons'…)
   * ou o id de uma tela dinâmica.
   */
  parentEntity?: string | null;
  /** Campo `reference` desta tela que guarda o id do registro-pai. */
  parentFieldKey?: string | null;
  /**
   * O que `parentEntity` significa. Duas coisas vinham juntas e agora se separam:
   *
   * - `owned` (padrão, o comportamento de sempre): o registro PERTENCE ao pai. A tela sai do menu e
   *   da busca ⌘K, o campo de vínculo não aparece no formulário (já vem preenchido) e salvar volta
   *   para o pai.
   * - `related`: o pai apenas MOSTRA os registros que apontam para ele. A tela continua de topo, com
   *   menu e busca próprios, e o campo de vínculo segue no formulário — é por ele que se liga e
   *   desliga um registro do outro.
   *
   * `related` existe porque duas entidades de topo podem se relacionar sem que uma seja parte da
   * outra: o Contrato lista os Processos ligados a ele, e Processos continua uma tela do escritório.
   * Sem a distinção, declarar a aba rebaixaria a tela a filha.
   */
  parentRelation?: 'owned' | 'related' | null;
  /**
   * Presente quando a tela foi trazida por uma extensão. `managed: true` a torna gerenciada: sua
   * estrutura é somente-leitura no Form Design (só a extensão altera/remove), embora o usuário
   * possa adicionar campos próprios por cima. A desinstalação da extensão remove as telas com este
   * `ownerPluginId`.
   */
  ownerPluginId?: string | null;
  /** Conjunto de extensões que compartilham esta tela (refcount); removida só quando vazio. */
  ownerPluginIds?: string[] | null;
  /** Id UNIVERSAL de origem da tela — GUID quando criada após a introdução do campo; senão a própria
   * chave (slug). É a base da chave instalada universal, o que deduplica telas entre extensões. */
  sourceId?: string | null;
  /** Revisão de ORIGEM (epoch ms do `updatedAt` no autor), carimbada no empacotamento. A atualização
   * só reescreve a estrutura quando a revisão que chega é estritamente maior que a materializada. */
  sourceRev?: number | null;
  managed?: boolean | null;
  /**
   * Mantém a tela FORA do menu lateral e da busca ⌘K mesmo sendo de topo (sem `parentEntity`). É o
   * que permite uma entidade existir sem menu quando quem dá acesso a ela é OUTRA tela — tipicamente
   * uma view de código de extensão que a apresenta com layout próprio. Diferente de `parentEntity`,
   * não a torna filha de ninguém: continua uma entidade de topo, só sem entrada de menu automática.
   */
  hideFromSidebar?: boolean | null;
  sidebarOrder: number;
  enabled: boolean;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy?: string;
  updatedByName?: string;
  updatedByPhotoURL?: string;
  deletedBy?: string;
  deletedByName?: string;
  deletedByPhotoURL?: string;
}

// ─── Schema de Foreign Keys (derivado do ENTITY_REGISTRY) ─────────────────────

export interface FkFieldSpec {
  targetCollection: string;
  multi?: boolean;
  denormalizedFields?: string[];
}

const buildFkSchema = (): Record<string, Record<string, FkFieldSpec>> => {
  const schema: Record<string, Record<string, FkFieldSpec>> = {};
  for (const entity of ENTITY_REGISTRY_LIST) {
    if (entity.fks.length === 0) continue;
    const entitySchema: Record<string, FkFieldSpec> = {};
    for (const fk of entity.fks) {
      const spec: FkFieldSpec = { targetCollection: fk.targetCollection };
      if (fk.multi) spec.multi = true;
      if (fk.denormalizedFields) spec.denormalizedFields = fk.denormalizedFields;
      entitySchema[fk.key] = spec;
    }
    schema[entity.collection] = entitySchema;
  }
  return schema;
};

export const ENTITY_FK_SCHEMA: Record<string, Record<string, FkFieldSpec>> = buildFkSchema();

// ─── Coleções e Entidades (derivadas do ENTITY_REGISTRY) ──────────────────────

/** Entidades fixas que podem receber uma `ScreenDefinition` — as que aparecem no Form Design. */
export const CUSTOM_FIELD_ENABLED_ENTITIES = new Set(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.supportsCustomFields).map((entity) => entity.collection),
);

export const BUILTIN_REF_ENTITIES = new Set(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.referenceable).map((entity) => entity.collection),
);
