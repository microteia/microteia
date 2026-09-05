import type { CustomFieldValue, FieldDefinition } from '../../../domain/entities/entitySchemas';
import type { SchemaContext } from '../../../domain/schema/pathResolver';

/** A tela que descreve uma coleção — a chave do mapa é a própria coleção. */
const fieldsOf = (ctx: SchemaContext, collection: string): FieldDefinition[] =>
  ctx.screens.get(collection)?.fields ?? [];

/**
 * O CAMPO que um caminho de relatório lê, mesmo quando ele atravessa uma referência.
 *
 * `situacao` é um campo da coleção-fonte; `cliente.cidade` é um campo da coleção APONTADA, e é ele
 * que sabe se `pending` se escreve "Pendente". O salto é feito pelo `refDenormKey` (o nome pelo qual
 * o registro apontado é navegado) ou pela própria chave do campo de referência.
 */
export const fieldAtPath = (
  ctx: SchemaContext,
  table: string,
  path: string,
): FieldDefinition | undefined => {
  const segments = path.split('.').filter(Boolean);
  let collection = table;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const hop = fieldsOf(ctx, collection).find((field) =>
      (field.refDenormKey ?? field.key) === segments[index] || field.key === segments[index]);
    if (!hop?.refEntity) return undefined;
    collection = hop.refEntity;
  }

  return fieldsOf(ctx, collection).find((field) => field.key === segments[segments.length - 1]);
};

/** Um texto longo é um controle de FORMULÁRIO; num filtro ele é uma linha como outra qualquer. */
const FILTER_PLAIN_TEXT_TYPES: FieldDefinition['type'][] = ['textarea', 'markdown'];

/**
 * O campo visto como o VALOR de um filtro — o mesmo tipo, sem o que só faz sentido num registro.
 *
 * Existe porque o controle é o mesmo (`FieldInput`, dirigido pelo schema), mas a pergunta é outra:
 * um filtro não semeia padrão nenhum, não gera código e não cadastra opção nova na lista do
 * escritório — quem está filtrando não está criando dado.
 *
 * O `multi` do campo é PRESERVADO. Ele já esteve fixo em `false`, sob o argumento de que um filtro
 * compara com um valor só; mas um campo de vários não tem um valor — ele tem uma lista, e o filtro
 * sobre ele é uma pergunta de pertinência. Com o controle preso a uma escolha, quem filtrava o polo
 * ativo de um processo só podia perguntar por uma pessoa, num campo que o escritório declarou como
 * de várias.
 */
export const filterFieldOf = (field: FieldDefinition): FieldDefinition => ({
  ...field,
  type: FILTER_PLAIN_TEXT_TYPES.includes(field.type) ? 'text' : field.type,
  required: false,
  optionsAllowUserAdd: false,
  defaultValue: undefined,
  autoValue: null,
  logic: null,
  aggregation: null,
});

/**
 * O valor do filtro como a TELA o carrega: texto.
 *
 * O formulário transporta tudo em texto — é o que permite guardar a resposta de um filtro antes de
 * saber se ela vai virar número, booleano ou o id de um registro. As três funções abaixo são as
 * únicas travessias entre esse texto, o CONTROLE e o `Literal` que o spec grava.
 */
export const filterTextOf = (value: CustomFieldValue): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.join(',');
  return String(value);
};

/** Os escolhidos de um campo de VÁRIOS, do texto que os transporta. Vazio é nenhum, não é um vazio. */
const filterListOf = (text: string): string[] =>
  text.split(',').map((one) => one.trim()).filter((one) => one !== '');

/** O texto como o CONTROLE o entende. `null` é ausência de resposta, e não a resposta "não". */
export const filterValueOf = (field: FieldDefinition | undefined, text: string): CustomFieldValue => {
  if (!field) return text;
  if (field.multi) return filterListOf(text);
  if (field.type === 'checkbox') {
    if (text === 'true') return true;
    return text === 'false' ? false : null;
  }
  if (field.type === 'currency') {
    const parsed = Number(text);
    return text.trim() === '' || Number.isNaN(parsed) ? null : parsed;
  }
  return text;
};

/**
 * O valor como o SPEC o grava — no tipo do campo, e não em texto.
 *
 * Não é preciosismo de forma: um `eq` raso vai ao Firestore com o valor tal como está aqui, e a
 * string `"true"` não encontra o booleano `true` gravado no documento. O filtro não falhava: ele
 * simplesmente não achava nada, sem uma palavra na tela. A data continua texto ISO de propósito —
 * é o formato que o produto inteiro fala, e um objeto ali não sobreviveria ao `.json` do relatório.
 */
export const filterLiteralOf = (field: FieldDefinition | undefined, text: string): unknown => {
  // Um campo de vários leva a LISTA dos escolhidos, e a comparação é de pertinência: o registro
  // atende se algum dos valores dele está entre os escolhidos. Mandar `"p1,p2"` como um texto só
  // procurava um registro cujo campo fosse literalmente essa string, e nunca achava nenhum.
  if (field?.multi) return filterListOf(text);
  if (field?.type === 'checkbox') return text === 'true';
  if (field?.type === 'number' || field?.type === 'currency') {
    const parsed = Number(text);
    // Texto que não é número passa INTACTO: recusá-lo aqui apagaria em silêncio o que a pessoa
    // escreveu, e quem diz o que é um filtro válido é o validador do spec, não esta conversão.
    return text.trim() !== '' && !Number.isNaN(parsed) ? parsed : text;
  }
  return text;
};
