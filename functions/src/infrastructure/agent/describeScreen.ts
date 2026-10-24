import { resolveEditWindow } from '../../domain/schema/editWindow';
import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import { resolveLabel } from '../../domain/schema/i18n/messageRef';
import type { NativeFieldSpec } from '../../domain/schema/entityRegistry';
import type { SchemaContext } from '../../domain/schema/screenEntity';
import { resolveEntity } from '../../domain/schema/screenEntity';
import type { CrudAction } from '../../domain/schema/access/permission';
import { CRUD_ACTIONS, collectionPermissionId } from '../../domain/schema/access/permission';
import { grants } from '../../domain/schema/access/memberPermissions';
import { agentParameterPlaceholder } from '../../domain/schema/agent/agentOps';
import type { AgentSession } from './authenticateAgent';

/**
 * Um campo, como um agente precisa vê-lo para conseguir gravá-lo.
 *
 * O que está aqui é o que decide um valor aceito ou recusado. O que não está é o que só existe num
 * formulário aberto — `hiddenWhen`, `disabledWhen`, `onChange` —, e omiti-lo é mais honesto do que
 * mandá-lo: um agente que recebesse `hiddenWhen` tentaria satisfazê-lo, e não há tela para satisfazer.
 */
interface AgentField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  /** Só quando há vários valores. */
  multi?: boolean;
  /** A lista FECHADA, com as opções por extenso. */
  options?: { key: string; label: string }[];
  /**
   * A coleção de onde as opções vêm, quando a lista é aberta. O agente a lê com `search_records`,
   * porque uma lista do escritório pode ter centenas de itens e não cabe numa descrição de tela.
   */
  optionsFrom?: string;
  /** A coleção apontada por um campo de referência. O valor gravado é o `id` de um registro dela. */
  references?: string;
  /** A máscara aplicada ao valor antes de ele ser conferido, quando a tela declara uma. */
  format?: string;
  /** O padrão (expressão regular) que o valor precisa satisfazer. */
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  /** Um valor na forma aceita — o de partida, quando há, ou um da forma do tipo. */
  example?: unknown;
  /** Gravar não é possível: o valor é calculado ou derivado. */
  readOnly?: true;
  /** O valor de partida de um registro novo. */
  default?: unknown;
}

export interface AgentScreenDescription {
  collection: string;
  labelSingular: string;
  labelPlural: string;
  /** O campo que serve de título de um registro — é por ele que uma pessoa reconhece a linha. */
  titleField: string | null;
  fields: AgentField[];
  /** O que não pode se repetir. Gravar um valor repetido é recusado, não sobrescrito. */
  uniqueKeys: { name: string; fields: string[]; primary: boolean }[];
  /**
   * Por quantos minutos depois de criado um registro aceita `update_record` — e, com `delete`,
   * `delete_record`. Ausente = sem prazo. Fora dele a gravação é recusada; o agente que precisa
   * corrigir um registro congelado cria outro que o corrige, como se faz com um lançamento.
   */
  editWindow?: { minutes: number; delete: boolean };
  allowedOperations: string[];
}

/**
 * As ferramentas que cada ação de CRUD destrava, ditas pelo nome com que o agente as chama.
 *
 * O mapa é indexado por `CrudAction`, então acrescentar uma ação ao catálogo de permissões obriga a
 * dizer aqui o que ela destrava — em vez de a tela nova simplesmente aparecer sem operação nenhuma.
 */
const OPERATION_BY_ACTION: Readonly<Record<CrudAction, string>> = {
  read: 'search_records, get_record, describe_screen',
  create: 'create_record',
  update: 'update_record',
  delete: 'delete_record',
};

const DOCUMENT_OPERATION_BY_ACTION = { read: 'list_documents', update: 'attach_document' } as const;

/**
 * O que uma lista de opções é para as REGRAS — e por isso o que ela é aqui.
 *
 * `firestore.rules` libera a leitura de uma lista de opções ou de um conjunto de etiquetas a qualquer
 * membro (`isDeclaredVocabulary`), sem cobrar `<coleção>.read`: são vocabulário, não dado. O caminho
 * do agente diz o mesmo, e não porque seria conveniente — dizer o contrário faria a mesma pergunta
 * ter duas respostas, e obrigaria quem emite um acesso a listar cada uma das dezenas de listas do
 * escritório para que um único campo de seleção pudesse ser preenchido.
 *
 * A ESCRITA numa lista continua cobrada, exatamente como na regra.
 */
export const isVocabulary = (ctx: SchemaContext, collection: string): boolean =>
  ctx.lookups.has(collection) || ctx.tagLists.has(collection);

/** As operações que este acesso alcança nesta coleção. */
export const allowedOperations = (
  ctx: SchemaContext,
  session: AgentSession,
  collection: string,
): string[] => {
  const permitido = (action: CrudAction): boolean =>
    grants(session.permissions, collectionPermissionId(collection, action))
    || (action === 'read' && isVocabulary(ctx, collection));

  const operations = CRUD_ACTIONS.filter(permitido).map((action) => OPERATION_BY_ACTION[action]);
  if (ctx.screens.get(collection)?.hasDocuments !== true) return operations;
  // A aba Documentos segue a permissão da COLEÇÃO, como na regra do Firestore: ler o registro é ler
  // os anexos dele, e anexar é alterá-lo.
  return [
    ...operations,
    ...(permitido('read') ? [DOCUMENT_OPERATION_BY_ACTION.read] : []),
    ...(permitido('update') ? [DOCUMENT_OPERATION_BY_ACTION.update] : []),
  ];
};

const isWritable = (field: NativeFieldSpec): boolean =>
  !field.logic?.compute && !field.logic?.derive && field.aggregation === undefined;

const flatten = (fields: readonly NativeFieldSpec[], prefix = ''): NativeFieldSpec[] =>
  fields.flatMap((field) => {
    const key = prefix === '' ? field.key : `${prefix}.${field.key}`;
    const own = { ...field, key };
    return field.objectFields ? [own, ...flatten(field.objectFields, key)] : [own];
  });

/**
 * Um valor na forma que o campo aceita. Um rótulo diz o que o campo É; o exemplo diz como ele se
 * ESCREVE — "2026-01-31" e não "31/01/2026", a chave da opção e não o rótulo dela.
 */
const exampleOf = (field: NativeFieldSpec): unknown => {
  if (field.defaultValue !== undefined && field.defaultValue !== null && field.defaultValue !== '') {
    return field.defaultValue;
  }
  const one = ((): unknown => {
    if (field.options && field.options.length > 0) return field.options[0].key;
    if (field.lookupCollection) return agentParameterPlaceholder('lookup', field.lookupCollection);
    if (field.refEntity) return agentParameterPlaceholder('EntityReference', field.refEntity);
    switch (field.type) {
      case 'date': return '2026-01-31';
      case 'number': return 1;
      case 'boolean': return true;
      case 'object': return undefined;
      default: return agentParameterPlaceholder('String');
    }
  })();
  if (one === undefined) return undefined;
  return field.multi === true || field.list === true || field.type === 'stringArray' ? [one] : one;
};

const describeField = (catalog: MessageCatalog, field: NativeFieldSpec): AgentField => ({
  key: field.key,
  label: resolveLabel(catalog, field.label),
  type: field.type,
  required: field.required === true,
  ...(field.multi === true || field.list === true ? { multi: true } : {}),
  // O `label` de uma opção pode ser uma referência de uma extensão; a `key` é o que se GRAVA, e é o
  // que o registro guarda. Mandar só o rótulo faria o agente gravar texto onde se espera chave.
  ...(field.options && field.options.length > 0
    ? { options: field.options.map((one) => ({ key: one.key, label: resolveLabel(catalog, one.label) })) }
    : {}),
  ...(field.lookupCollection ? { optionsFrom: field.lookupCollection } : {}),
  ...(field.refEntity ? { references: field.refEntity } : {}),
  ...(field.rules?.format?.preset ? { format: field.rules.format.preset } : {}),
  ...(field.rules?.validate?.pattern ? { pattern: field.rules.validate.pattern } : {}),
  ...(field.rules?.validate?.minLength === undefined ? {} : { minLength: field.rules.validate.minLength }),
  ...(field.rules?.validate?.maxLength === undefined ? {} : { maxLength: field.rules.validate.maxLength }),
  ...(isWritable(field) ? {} : { readOnly: true as const }),
  ...(field.defaultValue === undefined ? {} : { default: field.defaultValue }),
  ...(isWritable(field) && exampleOf(field) !== undefined ? { example: exampleOf(field) } : {}),
});

/**
 * A tela como um esquema. É esta resposta que dispensa uma ferramenta por entidade instalada.
 *
 * `null` quando a coleção não existe NESTE escritório — e quem chama a trata como recusa, sem
 * distinguir de uma coleção que existe e o acesso não alcança. As duas respondem igual: dizer qual é
 * qual contaria a um acesso restrito quais telas o escritório tem.
 */
export const describeScreen = (
  ctx: SchemaContext,
  catalog: MessageCatalog,
  session: AgentSession,
  collection: string,
): AgentScreenDescription | null => {
  const entity = resolveEntity(ctx, collection);
  if (!entity) return null;

  const screen = ctx.screens.get(collection);
  const editWindow = resolveEditWindow(ctx, collection);
  return {
    collection,
    labelSingular: resolveLabel(catalog, entity.labelSingular),
    labelPlural: resolveLabel(catalog, entity.labelPlural),
    titleField: screen?.titleFieldKey || entity.displayNameFields[0] || null,
    fields: flatten(entity.fields).map((field) => describeField(catalog, field)),
    uniqueKeys: (entity.keys ?? []).map((key) => ({
      name: key.name,
      fields: [...key.fields],
      primary: key.kind === 'primary',
    })),
    ...(editWindow ? { editWindow: { minutes: editWindow.spec.minutes, delete: editWindow.spec.delete === true } } : {}),
    allowedOperations: allowedOperations(ctx, session, collection),
  };
};

export interface AgentScreenSummary {
  collection: string;
  label: string;
  allowedOperations: string[];
}

/**
 * As telas que este acesso alcança — o recurso `microteia://office/screens`.
 *
 * O que o acesso NÃO alcança fica de fora inteiro, e não listado como negado: a lista de telas de um
 * escritório é informação, e um acesso estreito não tem por que recebê-la.
 */
export const officeScreens = (
  ctx: SchemaContext,
  catalog: MessageCatalog,
  session: AgentSession,
): AgentScreenSummary[] =>
  [...ctx.screens.keys()]
    .map((collection) => ({
      collection,
      label: resolveLabel(catalog, resolveEntity(ctx, collection)?.labelPlural ?? collection),
      allowedOperations: allowedOperations(ctx, session, collection),
    }))
    .filter((screen) => screen.allowedOperations.length > 0)
    .sort((left, right) => left.collection.localeCompare(right.collection));
