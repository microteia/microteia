// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/recordKeys.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldRulePresetCatalog } from './fieldRulePresets';
import type { LocalizedMessage } from './i18n/localizedMessage';
import { applyFormatOps, CORE_FIELD_RULE_PRESET_CATALOG, isEmptyRuleValue } from './fieldRulePresets';

/**
 * O que a chave FAZ com a identidade do registro — e a diferença entre as duas não é de grau.
 *
 * - `unique` é uma RESTRIÇÃO: o registro continua morando no `docId` sorteado e a chave só proíbe o
 *   segundo com o mesmo valor.
 * - `primary` é, além disso, um ENDEREÇO: a chave passa a valer onde antes só o `docId` servia —
 *   `upsert` idempotente por chave natural, semente, importação. No máximo uma por coleção, e ela
 *   implica `unique` mais `sparse: false`.
 *
 * O que NENHUMA das duas faz é virar o `docId`. Foi a primeira ideia e está errada aqui por três
 * razões do próprio repositório: o `docId` é pré-alocado antes de o registro existir, para receber
 * os arquivos (`newId` + `create(..., recordId)`); chave natural muda — o CPF foi digitado errado —
 * e mover um documento obrigaria a reescrever toda referência que aponta para ele, porque
 * `refEntity` guarda `docId`; e o valor viraria parte do CAMINHO, que vaza em log, URL e regra.
 * Chave natural é índice; `docId` continua sendo o endereço.
 */
export const RECORD_KEY_KINDS = ['primary', 'unique'] as const;
export type RecordKeyKind = (typeof RECORD_KEY_KINDS)[number];

/**
 * Onde a chave é única. `tenant` (o padrão) é o escritório inteiro; `parent` é DENTRO do
 * registro-pai — o item nº 1 de cada pedido, que é o caso composto mais comum e que um escopo só de
 * escritório tornaria impossível de declarar sem repetir o id do pai em toda chave.
 */
export const RECORD_KEY_SCOPES = ['tenant', 'parent'] as const;
export type RecordKeyScope = (typeof RECORD_KEY_SCOPES)[number];

/**
 * Se a chave já VALE sobre tudo o que está gravado. Não é declaração: é o estado da ADOÇÃO, que o
 * kernel mantém no job da coleção (`record_key_adoptions`) e nunca na tela.
 *
 * `pending` é a chave declarada cujos registros antigos ainda não foram todos reservados — porque a
 * varredura está em curso, ou porque encontrou duplicatas que alguém precisa resolver. Mesmo pendente,
 * a chave já recusa o valor NOVO repetido: o que ela ainda não garante é o registro antigo. Ver
 * `domain/schema/recordKeyAdoption.ts`.
 */
export const RECORD_KEY_STATUSES = ['pending', 'active'] as const;
export type RecordKeyStatus = (typeof RECORD_KEY_STATUSES)[number];

/**
 * Como o valor é comparado ANTES de virar chave. Deliberadamente pequeno: cada opção aqui é uma
 * forma de dois valores diferentes contarem como o mesmo, e cada uma precisa ser reproduzível
 * identicamente no front, no backend e numa varredura de adoção — o que uma expressão livre não
 * garante.
 *
 * `formatPreset` reusa o catálogo que já existe (`rules.format`), e é por isso que CPF e CNPJ não
 * precisam ser nomeados aqui: quem os traz é a extensão `brasil`.
 */
export interface RecordKeyNormalization {
  /** Padrão `true`. Espaço no fim é a duplicata mais comum que existe. */
  trim?: boolean;
  /** E-mail sim; código sensível a caixa, não. Padrão `false`. */
  caseInsensitive?: boolean;
  /** Chave de um preset de formatação — `digits` iguala `123.456` e `123456`. */
  formatPreset?: string;
}

export interface RecordKeySpec {
  /**
   * Estável e imutável: é o que nomeia a reserva gravada e o que um `upsert` cita. Renomear uma
   * chave é aposentá-la e declarar outra — as reservas já gravadas carregam o nome antigo.
   */
  name: string;
  kind: RecordKeyKind;
  /** Chaves de campo, na ORDEM — que é parte do valor reservado. */
  fields: string[];
  scope?: RecordKeyScope;
  normalize?: RecordKeyNormalization;
  /**
   * Registro sem o valor completo NÃO reserva nada. Padrão `true`, e o padrão importa: sem ele, os
   * quarenta cadastros ainda sem CPF colidiriam entre si no vazio.
   */
  sparse?: boolean;
  /** REFERÊNCIA de mensagem (`@namespace/chave`) mostrada no conflito. Ausente = a do núcleo. */
  message?: string;
  /**
   * @deprecated Ignorado. Se a chave já vale sobre os registros antigos é estado da adoção, mantido
   * pelo kernel (`record_key_adoptions`), e não algo que a declaração possa afirmar. Continua no tipo
   * para que um pacote que o declarava siga válido.
   */
  status?: RecordKeyStatus;
  /** Presente quando quem declarou a chave foi uma extensão — dirige upgrade e desinstalação. */
  ownerPluginId?: string | null;
}

/**
 * A chave como a GRAVAÇÃO a aplica: a declaração mais o campo que guarda o pai, resolvido a partir da
 * tela (`resolveRecordKeys`). Não é declaração — por isso não mora em `RecordKeySpec` e não vaza para o
 * catálogo instalado, que exporta o que foi declarado.
 *
 * `planRecordKeys` exige este tipo, e não o declarado, por causa do defeito que ele fecha: o escopo
 * `parent` era aceito na autoria, validado e documentado, e a gravação o ignorava — o id da reserva saía
 * só de coleção, nome e valores, e a chave valia no escritório inteiro (o "Despacho" de 07/11 às 14:00
 * num processo recusava o mesmo despacho em outro). Com o campo obrigatório no tipo, um caminho de
 * gravação que esqueça de resolver o pai não compila.
 */
export interface ScopedRecordKeySpec extends RecordKeySpec {
  /** O campo do vínculo com o pai no escopo `parent`; `null` no escopo do escritório. */
  parentFieldKey: string | null;
}

export const scopeRecordKeys = (
  keys: readonly RecordKeySpec[],
  parentFieldKey: string | null,
): ScopedRecordKeySpec[] =>
  keys.map((key) => ({ ...key, parentFieldKey: key.scope === 'parent' ? parentFieldKey : null }));

/**
 * A coleção das reservas, sob o tenant. É a generalização de `/nicknames`: o valor vira o ID de um
 * documento, e a unicidade passa a ser a do próprio Firestore.
 */
export const RECORD_KEYS_COLLECTION = 'recordKeys';

/**
 * O campo em que o registro guarda as reservas que o sustentam (nome da chave → id da reserva).
 *
 * Existe por dois motivos, e o segundo é o que o torna obrigatório: a regra do Firestore consegue
 * conferir, via `getAfter`, que a reserva citada existe e aponta para este registro; e a liberação
 * no update e no delete sabe O QUE soltar sem recomputar — inclusive quando a declaração da chave
 * mudou depois de o registro ter sido gravado. Recomputar deixaria órfã toda reserva feita sob uma
 * normalização anterior.
 */
export const RECORD_KEY_REFS_FIELD = 'keyRefs';

/**
 * O separador do id da reserva. Não pode ser `/` (o Firestore recusa em id de documento) e não pode
 * aparecer num valor sem aviso — por isso `escapeKeySegment` o substitui, e a substituição é
 * INJETIVA: `a|b` e `a` + `b` não podem produzir o mesmo id.
 */
const KEY_SEGMENT_SEPARATOR = '|';

/**
 * O teto de um id de documento no Firestore é 1500 bytes; o corte é bem antes dele porque o id
 * ainda carrega coleção e nome da chave, e porque um id gigante é caro em todo lugar onde ele
 * viaja. Passando disso, o valor vira resumo — e continua legível no corpo do documento, que é
 * onde alguém precisa lê-lo.
 */
export const RECORD_KEY_ID_MAX_LENGTH = 900;

/**
 * A marca do segmento do pai. Um valor escapado nunca começa por `~r` — todo `~` dele vira `~t` —, e é
 * isso que impede a chave `parent` de um campo de produzir o mesmo id que a de escritório de dois campos
 * com o mesmo nome: a chave que troca de escopo convive, até a adoção terminar, com as reservas antigas.
 */
const PARENT_SEGMENT_MARK = '~r';

const escapeKeySegment = (value: string): string =>
  value.replace(/~/g, '~t').replace(/\//g, '~s').replace(/\|/g, '~p');

/**
 * Resumo determinístico e sem dependência: o id precisa ser o MESMO no navegador, na function e
 * numa varredura de adoção, e as três não compartilham runtime de criptografia.
 *
 * Não é resistente a colisão de propósito — nem precisa ser. Um resumo aqui só encurta um id longo
 * demais, e a igualdade de valor continua gravada por extenso em `values`, que é o que a leitura
 * confere. Duas chaves distintas que caíssem no mesmo resumo produziriam uma recusa injusta, nunca
 * uma duplicata aceita, e é essa direção de erro que se quer.
 */
const digest = (value: string): string => {
  let high = 0x811c9dc5;
  let low = 0x01000193;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    high = Math.imul(high ^ code, 0x01000193) >>> 0;
    low = Math.imul(low + code + index, 0x85ebca6b) >>> 0;
  }
  return `${high.toString(36)}${low.toString(36)}`;
};

/** O valor de UM campo, pronto para virar segmento do id. */
export const normalizeRecordKeyValue = (
  value: unknown,
  normalization: RecordKeyNormalization | undefined,
  catalog: FieldRulePresetCatalog = CORE_FIELD_RULE_PRESET_CATALOG,
): string => {
  if (isEmptyRuleValue(value)) return '';
  const text = Array.isArray(value) ? value.map((one) => String(one)).join(',') : String(value);
  let next = normalization?.trim === false ? text : text.trim();
  if (normalization?.formatPreset) {
    next = applyFormatOps(next, catalog.get(normalization.formatPreset)?.format);
  }
  if (normalization?.caseInsensitive) next = next.toLowerCase();
  return next;
};

/**
 * O id da reserva. Ponto único: front, backend e adoção não podem discordar sobre ele.
 *
 * `parent` é o id do registro-pai no escopo `parent`, e vazio no do escritório. Ele mora no ID e não no
 * corpo da reserva: o corpo é conferido pela regra (`hasOnly`), e o id é o que já carrega a unicidade.
 */
export const buildRecordKeyId = (
  collection: string,
  keyName: string,
  values: string[],
  parent = '',
): string => {
  const segments = values.map(escapeKeySegment);
  if (parent) segments.unshift(`${PARENT_SEGMENT_MARK}${escapeKeySegment(parent)}`);
  const joined = segments.join(KEY_SEGMENT_SEPARATOR);
  const prefix = `${escapeKeySegment(collection)}${KEY_SEGMENT_SEPARATOR}${escapeKeySegment(keyName)}`;
  const full = `${prefix}${KEY_SEGMENT_SEPARATOR}${joined}`;
  if (full.length <= RECORD_KEY_ID_MAX_LENGTH) return full;
  return `${prefix}${KEY_SEGMENT_SEPARATOR}~h${digest(joined)}`;
};

/** Uma reserva a fazer: o que se grava em `recordKeys/{id}`, mais o que o registro passa a citar. */
export interface RecordKeyEntry {
  name: string;
  keyId: string;
  values: string[];
  kind: RecordKeyKind;
  /** Os campos que compõem a chave — é o que o conflito precisa apontar no formulário. */
  fields: string[];
  /** REFERÊNCIA de mensagem do conflito desta chave. */
  message?: string;
}

/** Uma chave obrigatória cujo valor não veio — recusa de gravação, não reserva a menos. */
export interface RecordKeyGap {
  name: string;
  /** Os campos que ficaram vazios. */
  fields: string[];
}

export interface RecordKeyPlan {
  entries: RecordKeyEntry[];
  gaps: RecordKeyGap[];
  /**
   * As chaves que esta gravação não mexe: o registro já existia e o valor delas não mudou. A reserva
   * que ele cita (se cita) fica como está, e a que ele não cita é da varredura de adoção — nunca da
   * gravação seguinte.
   */
  held: string[];
}

/**
 * Uma chave `primary` é `unique` com duas decisões já tomadas: ela nunca é esparsa (um endereço
 * opcional não endereça nada) e há no máximo uma. Ler isso de um lugar só evita que cada caminho de
 * gravação reinvente a mesma dedução.
 */
export const recordKeyIsSparse = (key: RecordKeySpec): boolean =>
  key.kind === 'primary' ? false : key.sparse !== false;

const recordKeyValues = (
  key: RecordKeySpec,
  data: Record<string, unknown>,
  catalog: FieldRulePresetCatalog,
): string[] => key.fields.map((field) => normalizeRecordKeyValue(data[field], key.normalize, catalog));

const sameValues = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/**
 * O id do pai que a chave `parent` carrega; `null` no escopo do escritório e vazio quando o registro não
 * tem pai. Passa sem a normalização da chave: ela é do VALOR — um `caseInsensitive` ou um `digits`
 * aplicado a um id de documento juntaria pais diferentes.
 */
const recordKeyParent = (key: ScopedRecordKeySpec, data: Record<string, unknown>): string | null => {
  if (key.scope !== 'parent') return null;
  const raw = key.parentFieldKey ? data[key.parentFieldKey] : undefined;
  return typeof raw === 'string' ? raw.trim() : '';
};

/**
 * O que uma gravação precisa reservar, dado o registro COMPLETO (payload já mesclado com o que já
 * estava gravado — uma chave composta cujo update toca um campo só continua sendo a mesma chave).
 *
 * `previous` é o registro como estava antes, num update. A chave cujo valor não mudou fica em `held`:
 * a gravação não a reserva nem cobra a lacuna dela. É o que permite declarar uma chave numa coleção
 * que já tem duplicatas sem travar a edição de um campo qualquer de um registro antigo — o valor NOVO
 * é recusado desde o primeiro instante, e o antigo é adotado pela varredura, que é quem sabe mostrar
 * o conflito a quem pode resolvê-lo.
 *
 * Não consulta nada: é pura, e é isso que permite ao front, ao backend e à varredura de adoção
 * chegarem à mesma lista sem combinarem entre si.
 */
export const planRecordKeys = (
  keys: readonly ScopedRecordKeySpec[] | undefined,
  data: Record<string, unknown>,
  collection: string,
  catalog: FieldRulePresetCatalog = CORE_FIELD_RULE_PRESET_CATALOG,
  previous?: Record<string, unknown> | null,
): RecordKeyPlan => {
  const entries: RecordKeyEntry[] = [];
  const gaps: RecordKeyGap[] = [];
  const held: string[] = [];
  for (const key of keys ?? []) {
    if (key.fields.length === 0) continue;
    const values = recordKeyValues(key, data, catalog);
    const parent = recordKeyParent(key, data);
    if (
      previous
      && sameValues(values, recordKeyValues(key, previous, catalog))
      && parent === recordKeyParent(key, previous)
    ) {
      held.push(key.name);
      continue;
    }
    // Sem pai, a chave `parent` está tão incompleta quanto sem um dos campos: o pai é parte do valor.
    const missing = key.fields.filter((_, index) => values[index] === '');
    const orphan = parent === '';
    if (missing.length > 0 || orphan) {
      if (recordKeyIsSparse(key)) continue;
      gaps.push({ name: key.name, fields: orphan && key.parentFieldKey ? [key.parentFieldKey, ...missing] : missing });
      continue;
    }
    entries.push({
      name: key.name,
      keyId: buildRecordKeyId(collection, key.name, values, parent ?? ''),
      values,
      kind: key.kind,
      fields: [...key.fields],
      ...(key.message ? { message: key.message } : {}),
    });
  }
  return { entries, gaps, held };
};

/**
 * As reservas do registro como ele está gravado. Lê `keyRefs` e não recomputa: uma reserva feita sob
 * a declaração anterior só é encontrada por aquilo que o próprio registro cita.
 */
export const storedRecordKeyRefs = (data: Record<string, unknown> | null | undefined): Record<string, string> => {
  const raw = data?.[RECORD_KEY_REFS_FIELD];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const refs: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.length > 0) refs[name] = value;
  }
  return refs;
};

/** O mapa que o registro passa a carregar. */
export const recordKeyRefs = (entries: readonly RecordKeyEntry[]): Record<string, string> =>
  Object.fromEntries(entries.map((entry) => [entry.name, entry.keyId]));

/**
 * O que soltar e o que criar num update: a diferença entre o que o registro cita hoje e o que o
 * novo estado exige. Uma chave cujo valor não mudou não é solta e recriada — a reserva permanece, e
 * é o que impede um update qualquer de abrir uma janela em que o valor está livre.
 */
export interface RecordKeyDiff {
  create: RecordKeyEntry[];
  release: string[];
  refs: Record<string, string>;
}

export const diffRecordKeys = (
  plan: RecordKeyPlan,
  stored: Record<string, string>,
): RecordKeyDiff => {
  const refs = recordKeyRefs(plan.entries);
  for (const name of plan.held) {
    if (stored[name]) refs[name] = stored[name];
  }
  const create = plan.entries.filter((entry) => stored[entry.name] !== entry.keyId);
  const kept = new Set(Object.values(refs));
  const release = Object.values(stored).filter((keyId) => !kept.has(keyId));
  return { create, release, refs };
};

// ─── Validação de autoria ─────────────────────────────────────────────────────

/**
 * O que reprova uma chave ANTES de ela existir. Vale para as três origens pela mesma razão de
 * `validatePluginPackage` ser porta única: o Form Design, o pacote de extensão e o registro do
 * kernel declaram a mesma coisa, e uma checagem que só um deles faz é uma checagem que os outros
 * dois descobrem em produção.
 */
export interface RecordKeyContext {
  /** As chaves de campo que a coleção tem. */
  fieldKeys: ReadonlySet<string>;
  /**
   * Os campos cujo valor NÃO fica gravado no documento — hoje, os `logic.derive`. Uma chave sobre um
   * deles reservaria um valor que o registro não carrega, e a reserva ficaria órfã na leitura
   * seguinte.
   */
  unstoredFieldKeys?: ReadonlySet<string>;
  /** A tela tem vínculo com um pai? É o que o escopo `parent` exige. */
  hasParent?: boolean;
  /** As formatações que existem nesta instalação — o catálogo, com o que as extensões trouxeram. */
  presetKeys?: ReadonlySet<string>;
}

export interface RecordKeyIssue extends LocalizedMessage {
  /** O nome da chave problemática; vazio quando o problema é da lista inteira. */
  keyName: string;
}

const KEY_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_:.-]*$/;

export const recordKeyIssues = (
  keys: readonly RecordKeySpec[] | undefined,
  ctx: RecordKeyContext,
): RecordKeyIssue[] => {
  const issues: RecordKeyIssue[] = [];
  const seenNames = new Set<string>();
  const seenSignatures = new Set<string>();
  let primaries = 0;

  for (const key of keys ?? []) {
    const name = (key.name ?? '').trim();
    if (!name || !KEY_NAME_PATTERN.test(name)) {
      issues.push({ keyName: name, message: '@core.records/key.error.name-required' });
      continue;
    }
    if (seenNames.has(name)) {
      issues.push({
        keyName: name,
        message: '@core.records/key.error.duplicate-name',
        messageParams: { name },
      });
      continue;
    }
    seenNames.add(name);

    if (!Array.isArray(key.fields) || key.fields.length === 0) {
      issues.push({ keyName: name, message: '@core.records/key.error.fields-required' });
      continue;
    }
    for (const field of key.fields) {
      if (!ctx.fieldKeys.has(field)) {
        issues.push({
          keyName: name,
          message: '@core.records/key.error.unknown-field',
          messageParams: { field },
        });
      } else if (ctx.unstoredFieldKeys?.has(field)) {
        issues.push({
          keyName: name,
          message: '@core.records/key.error.unstored-field',
          messageParams: { field },
        });
      }
    }

    // A assinatura inclui o ESCOPO: a mesma combinação de campos única no escritório e única dentro
    // do pai são duas restrições diferentes, e declarar as duas é redundante, não conflitante.
    const signature = `${key.scope ?? 'tenant'}::${[...key.fields].join(' ')}`;
    if (seenSignatures.has(signature)) {
      issues.push({ keyName: name, message: '@core.records/key.error.duplicate-fields' });
    }
    seenSignatures.add(signature);

    if (key.kind === 'primary') {
      primaries += 1;
      if (primaries > 1) {
        issues.push({ keyName: name, message: '@core.records/key.error.single-primary' });
      }
    }

    if (key.scope === 'parent' && ctx.hasParent === false) {
      issues.push({ keyName: name, message: '@core.records/key.error.scope-needs-parent' });
    }

    const preset = key.normalize?.formatPreset;
    if (preset && ctx.presetKeys && !ctx.presetKeys.has(preset)) {
      issues.push({
        keyName: name,
        message: '@core.records/key.error.unknown-preset',
        messageParams: { preset },
      });
    }
  }

  return issues;
};
