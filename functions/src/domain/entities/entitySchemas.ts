// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/entities/entitySchemas.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/entities/entitySchemas.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { AuditAction } from './AuditLog';
import { ENTITY_REGISTRY_LIST } from '../schema/entityRegistry';
import type {
  CustomFieldMask,
  CustomFieldOption,
  CustomFieldType,
  FieldAggregation,
  FieldFileConfig,
  FieldLogic,
  FieldOrigin,
  FieldRules,
} from '../schema/fieldRules';
import type { RecordKeySpec } from '../schema/recordKeys';
import type { AutoValueSpec } from '../schema/recordSequence';
import type { PortalDeclaration } from '../schema/portal';
import type { EditWindowSpec } from '../schema/editWindow';
import type { MemberVisibilitySpec } from '../schema/memberVisibility';

// ─── Tipos de Campos Customizados ─────────────────────────────────────────────

export type { CustomFieldType, CustomFieldMask, CustomFieldOption, FieldOrigin } from '../schema/fieldRules';
export type {
  RecordKeyKind,
  RecordKeyNormalization,
  RecordKeyScope,
  RecordKeySpec,
  RecordKeyStatus,
} from '../schema/recordKeys';

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
   *
   * Com `sequence`, deixa de ser sorteio: é o NÚMERO que o registro recebe ao ser criado, de um
   * contador transacional, nunca repetido e nunca editável (`2026/000123`). Ver
   * `domain/schema/recordSequence.ts`.
   */
  autoValue?: AutoValueSpec | null;
  rules?: FieldRules | null;
  logic?: FieldLogic | null;
  aggregation?: FieldAggregation | null;
  /**
   * O que um campo `file` aceita — extensões e tamanho máximo. Só o campo `file` a usa.
   *
   * O valor GRAVADO é a URL de download, uma string: o campo continua escalar, e a restrição é o que
   * o formulário cobra antes de escrever. O teto é cobrado no cliente porque a regra do Storage não
   * lê o schema da tela — a mesma postura de `rules.validate`.
   */
  file?: FieldFileConfig | null;
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
  /**
   * AÇÚCAR de autoria: o campo é uma chave `unique` de um campo só, no escopo do escritório.
   *
   * Não é uma segunda verdade — quem declara é sempre `ScreenDefinition.keys`, e o Form Design, o
   * compilador de extensão e `resolveScreenKeys` desaçucaram isto para uma entrada de lá. Existe
   * porque a chave de um campo só é o caso dominante, e obrigar a escrever a lista inteira para
   * dizer "este e-mail não se repete" faria a declaração mais rara do que o problema.
   */
  unique?: boolean | null;
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
  /**
   * As CHAVES da coleção — o que não pode se repetir nela, e por qual combinação de campos.
   *
   * Fica na tela, e não no campo, por três razões que só aparecem juntas: chave composta é a regra e
   * não a exceção (`(pedidoId, numero)`); o escopo — no escritório ou dentro do pai — é propriedade
   * da chave, não de nenhum dos campos; e uma lista num lugar só é o que a regra do Firestore, o
   * Form Design e a varredura de adoção conseguem ler sem que cada um remonte a verdade a partir de
   * campos espalhados. `FieldDefinition.unique` é açúcar que desaçucara para cá.
   */
  keys?: RecordKeySpec[] | null;
  titleFieldKey: string;
  /**
   * Campo exibido como SUBTÍTULO no detalhe (abaixo do título, ao lado do ícone) e na linha sob o
   * título do cartão — tipicamente um identificador curto que complementa o nome (o número do
   * processo, o número do contrato). Ausente = sem subtítulo.
   *
   * O rótulo da ABA é sempre o campo-TÍTULO: é por ele que o usuário reconhece o registro aberto, e
   * é o mesmo nome que a listagem, a busca e uma menção mostram.
   */
  subtitleFieldKey?: string | null;
  /**
   * Campo de arquivo cuja IMAGEM substitui o ícone da tela nos dois lugares onde ele representa UM
   * registro: o avatar do cartão da listagem e o do cabeçalho do detalhe. Ausente (o normal) = o
   * ícone da tela, como sempre.
   *
   * Uma declaração, dois lugares — o mesmo racional de `subtitleFieldKey`. Menu lateral, abas e
   * busca continuam com o ícone da TELA: ali o que se identifica é a tela, não o registro, e a foto
   * de um cliente no menu não diria nada.
   *
   * Vale só para campo `file`: o valor gravado é a URL de download, e um campo de outro tipo
   * alimentaria um `<img>` com texto qualquer. Declaração que deixou de casar cai no ícone.
   */
  imageFieldKey?: string | null;
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
   * Quais ações desta coleção geram registro de auditoria. Ausente = todas. Serve à coleção cujo
   * registro NASCE de máquina: uma ingestão que grava por conta própria produziria um log por
   * documento recebido. Ver `SchemaScreen.auditActions`.
   */
  auditActions?: AuditAction[] | null;
  /**
   * Campos que QUALQUER membro do escritório grava, mesmo sem a permissão de escrita da coleção. É o
   * "por usuário" de um mural: marcar como lida, curtir, guardar para depois — gravações no
   * documento que OUTRA pessoa criou, e que não são edição do conteúdo dela.
   *
   * O limite é a própria lista: a alteração é recusada se tocar em qualquer campo fora dela. Era o
   * que as regras nomeadas de `news` diziam à mão (`affectedKeys().hasOnly(['likedBy','likeCount'])`),
   * e sem a declaração o papel `user` — somente leitura — não conseguia sequer marcar uma notícia
   * como lida, o que deixava o selo do menu preso para sempre.
   */
  memberWritableFields?: string[] | null;
  /**
   * QUEM CRIOU pode excluir o que criou, mesmo sem ser admin do escritório. Ausente (o normal),
   * exclusão é só de admin — a regra que vale para um cadastro, onde apagar é ato de gestão.
   *
   * Existe para a entidade em que autoria É o dono: um comentário, um recado. Obrigar o autor a
   * chamar um admin para apagar o próprio comentário não protege nada, e era a última coisa que
   * prendia esse tipo de tela ao kernel — a regra nomeada que dizia `resource.data.userId ==
   * request.auth.uid`. Declarada aqui, a mesma frase vale para qualquer tela, venha de onde vier.
   *
   * O autor é o `createdBy` do registro, carimbado na criação. Vale nas duas pontas: o
   * `firestore.rules` a lê do documento da tela, e a UI mostra a ação de excluir por ela.
   */
  authorCanDelete?: boolean | null;
  /**
   * Por quanto tempo, a partir de `createdAt`, um registro pode ser alterado — e, com `delete: true`,
   * excluído. Ausente (o normal) = sem prazo. É para o registro que vale como prova do que foi dito ou
   * feito: depois de lido, mudar o texto muda a prova.
   *
   * Vale nas três pontas: o formulário trava, os caminhos de gravação recusam, e o `firestore.rules`
   * recusa quem grava direto no banco. Ninguém passa por cima em tempo de execução — nem o dono —; o
   * que muda a janela é mudar a declaração, e isso exige `screens.edit-window` (no Form Design) ou
   * `extensions.manage`, e fica na auditoria.
   *
   * Guardado COMO ESTÁ gravado (o Form Design reenviaria uma forma normalizada como alteração); quem a
   * interpreta passa por `readEditWindow`. Ver `domain/schema/editWindow.ts`.
   */
  editWindow?: EditWindowSpec | null;
  /**
   * Quem, entre os membros que leem a coleção, lê CADA registro. Ausente (o normal) = todos os que
   * têm `<coleção>.read`. Presente, o membro lê só o registro que o nomeia num dos `userFields`
   * (referência a membro, simples ou `multi`), salvo quem tem a supervisão — `bypassPermission`, ou a
   * derivada `<coleção>.read-all`.
   *
   * Vale no `firestore.rules` e no `storage.rules` (a garantia), na assinatura da coleção no front (o
   * filtro que a regra exige) e nas portas do servidor que entregam registro a uma pessoa. Mudá-la
   * exige `screens.member-visibility` ou `extensions.manage`.
   *
   * Guardado COMO ESTÁ gravado, pelo motivo de `editWindow`; quem a interpreta passa por
   * `readMemberVisibility`. Ver `domain/schema/memberVisibility.ts`.
   */
  memberVisibility?: MemberVisibilitySpec | null;
  /**
   * O que esta tela expõe no PORTAL — a quem é de fora do escritório, só o que é dele. Ausente (o
   * normal) = nada desta tela sai do escritório. Ver `domain/schema/portal.ts`.
   */
  portal?: PortalDeclaration | null;
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
   * Mantém a tela FORA do menu lateral mesmo sendo de topo (sem `parentEntity`). É o que permite uma
   * entidade existir sem menu quando quem dá acesso a ela é OUTRA tela — tipicamente uma view de
   * código de extensão que a apresenta com layout próprio. Diferente de `parentEntity`, não a torna
   * filha de ninguém: continua uma entidade de topo, só sem entrada de menu automática.
   *
   * Age SÓ no menu. O comando "Abrir <tela>" do ⌘K continua — sem menu, ele é o caminho que sobra —,
   * e os registros continuam na busca até a tela declarar `hideRecordsFromCommandPalette`.
   */
  hideFromSidebar?: boolean | null;
  /**
   * Os registros desta tela não entram no grupo "Registros" do ⌘K. A tela segue alcançável por tudo
   * o mais: o comando "Abrir <tela>", o menu, link direto, abas e seletores de referência.
   *
   * É a declaração de quem traz uma coleção que a MÁQUINA enche — ingestão de intimações, de
   * e-mails, de eventos. Os registros dela ocupavam os poucos resultados da busca e empurravam para
   * fora o que a pessoa procurava, e a única saída era declarar a tela filha `owned` de alguém, o que
   * mentia sobre o modelo e criava uma aba em cada registro-pai.
   *
   * O "Abrir <tela>" fica de propósito: numa tela que também declara `hideFromSidebar` ele é a única
   * entrada que resta, e tirá-lo esconderia a tela inteira.
   */
  hideRecordsFromCommandPalette?: boolean | null;
  /**
   * A tela filha NÃO vira aba do registro-pai. Par de `hideFromSidebar`, e pelo mesmo motivo: quem
   * apresenta os filhos é OUTRA tela — tipicamente a view de código que já os desenha com layout
   * próprio, onde a conversa de uma notícia se lê embaixo dela, e não numa aba do formulário.
   *
   * Não desfaz o vínculo: a tela continua filha para tudo o mais (fora do menu e do ⌘K, ação
   * destrutiva lida como "tirar daqui", registro novo já nascendo ligado ao pai). Sem ela, a única
   * forma de esconder a aba era abrir mão de `parentEntity`, e aí os registros filhos voltavam a
   * aparecer na busca e ganhavam uma listagem própria — que é justamente o que não se quer.
   */
  hideFromParentTabs?: boolean | null;
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
