// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/document/documentTemplate.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/document/documentTemplate.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Contribution, QualifiedContribution } from '../plugin/contribution';
import type { ExtensionPointDefinition } from '../plugin/extensionPoint';
import type { TemplateIssue } from './templateGrammar';
import { GRAMMAR_ISSUES, parseTemplate } from './templateGrammar';
import { contentFingerprint } from '../contentFingerprint';
import type { DocumentDestination } from './documentDownloads';
import { DOWNLOAD_RETENTION_MAX_DAYS, isDocumentDestination, isRetentionDays } from './documentDownloads';

/**
 * O modelo de documento — procuração, contrato, recibo, notificação — como DADO.
 *
 * A mesma forma viaja nos dois lugares de onde um modelo vem: na contribuição `document.template` de
 * um pacote e no documento `tenants/{t}/documentTemplates/{id}` que o escritório grava. Não há
 * conversão entre um e outro, e é isso que faz "personalizar o modelo da extensão" ser copiar, e
 * "voltar ao modelo da extensão" ser apagar a cópia.
 */

export type DocumentTemplateFormat = 'markdown' | 'docx';

export type DocumentOutputFormat = 'pdf' | 'docx';

export const DOCUMENT_TEMPLATE_FORMATS: readonly DocumentTemplateFormat[] = ['markdown', 'docx'];

export const DOCUMENT_OUTPUT_FORMATS: readonly DocumentOutputFormat[] = ['pdf', 'docx'];

/**
 * O que cada formato de modelo sabe produzir.
 *
 * DOCX → PDF não está aqui, e é decisão: converter um Word exige um motor de escritório
 * (LibreOffice), que não cabe numa Cloud Function. Oferecer a combinação e falhar ao gerar seria
 * pior que não oferecê-la — a validação recusa na AUTORIA.
 */
export const DOCUMENT_OUTPUTS_BY_FORMAT: Record<DocumentTemplateFormat, readonly DocumentOutputFormat[]> = {
  markdown: ['pdf', 'docx'],
  docx: ['docx'],
};

/**
 * Uma lista de registros FILHOS para os laços — `{{#each parcelas}}`. O vocabulário é o do campo
 * agregado (`from`, `via`), porque é a mesma pergunta: os registros de outra tela cujo vínculo aponta
 * para este.
 */
export interface DocumentTemplateDataset {
  /** O nome pelo qual o modelo lê a lista. Identificador de expressão. */
  name: string;
  /** A tela (chave) dos filhos. */
  from: string;
  /** A tela dos filhos pelo `sourceId`, quando é de um pacote — vence `from`, como `screenSourceId`. */
  fromSourceId?: string;
  /** O campo de referência, no filho, que aponta para o registro do documento. */
  via: string;
  orderBy?: string;
  direction?: 'asc' | 'desc';
  limit?: number;
}

export interface DocumentTemplateSpec {
  /** O endereço do modelo. É por ele que o modelo do escritório substitui o do pacote. */
  key: string;
  title: string;
  description?: string;
  /** A tela cujos registros o modelo descreve (a chave dela). Os caminhos partem dela. */
  collection: string;
  /**
   * A tela de um PACOTE, pelo `sourceId` — vence `collection`. A chave de uma tela de pacote pode
   * ganhar sufixo na instalação (`contratos_2`); o `sourceId` não muda, e é por ele que a aba de
   * registro também endereça a tela. Um modelo cuja tela não está instalada não é oferecido.
   */
  screenSourceId?: string;
  format: DocumentTemplateFormat;
  /** O texto do modelo, quando `format` é `markdown`. */
  body?: string;
  /** O arquivo `.docx` em base64, quando `format` é `docx`. */
  content?: string;
  /** Ausente = tudo o que o formato sabe produzir. */
  outputs?: DocumentOutputFormat[];
  /** Nome do arquivo gerado, na mesma gramática (`Procuração - {{name}}`). Sem extensão. */
  fileName?: string;
  /** Chave de `documentTypes` com que o arquivo é anexado. */
  documentType?: string;
  datasets?: DocumentTemplateDataset[];
  /**
   * Para onde o arquivo vai quando quem gera não diz. Ausente = `record`, o comportamento de antes
   * do campo. É só o PADRÃO: o gesto, o passo e o agente podem pedir o outro destino.
   */
  destination?: DocumentDestination;
  /**
   * Quantos dias o arquivo fica em Downloads (`0` = não expira). Ausente = o que o escritório
   * configurou. Não vale para `record`: o anexo do registro é permanente.
   */
  retentionDays?: number;
}

/** O modelo como o ESCRITÓRIO o grava. `enabled: false` desliga a chave — inclusive a de um pacote. */
export interface DocumentTemplate extends DocumentTemplateSpec {
  id: string;
  enabled?: boolean;
  /**
   * A impressão digital (`documentTemplateFingerprint`) do modelo da EXTENSÃO de que esta cópia saiu.
   * Só existe na cópia personalizada; é ela que deixa a tela perceber que a extensão trocou o
   * original depois da personalização. Ausente numa cópia anterior a este campo: não se sabe.
   */
  basedOn?: string;
  updatedAt?: Date | null;
  updatedBy?: string | null;
}

export type DocumentTemplateOrigin = 'tenant' | 'plugin';

/**
 * O modelo que VALE para uma chave, com quem responde por ele. Aqui `collection` e `datasets[].from`
 * já são a coleção FÍSICA (ver `resolveDocumentTemplates`).
 */
export interface ResolvedDocumentTemplate extends DocumentTemplateSpec {
  origin: DocumentTemplateOrigin;
  /** O pacote que declara a chave — presente também quando o escritório a sobrepôs. */
  pluginId?: string;
  /** O id do documento do escritório, quando é dele. */
  id?: string;
  /** O escritório substitui um modelo de pacote de mesma chave. */
  overridesPlugin?: boolean;
}

export const DOCUMENT_TEMPLATES_COLLECTION = 'documentTemplates';

/** O kernel que entende `document.template`. Um pacote que o contribui declara `kernel: '^<esta>'`. */
export const DOCUMENT_TEMPLATE_SINCE_KERNEL = '2.36.0';

/**
 * O teto do arquivo `.docx`. O modelo é guardado num documento do Firestore (limite de 1 MiB) e
 * viaja num pacote (teto de 800 KB): 512 KB decodificados são ~683 KB de base64, e cabem nos dois.
 * Um modelo maior que isso quase sempre carrega imagens que deveriam estar comprimidas.
 */
export const DOCUMENT_TEMPLATE_MAX_BYTES = 512 * 1024;

export const DOCUMENT_TEMPLATE_KEY_PATTERN = /^[a-z][a-z0-9-]*$/;

export const DOCUMENT_TEMPLATE_KEY_MAX_LENGTH = 60;

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const base64DecodedSize = (content: string): number => {
  const padding = content.endsWith('==') ? 2 : content.endsWith('=') ? 1 : 0;
  return Math.floor((content.length * 3) / 4) - padding;
};

/** O que o modelo produz de fato: o declarado, filtrado pelo que o formato sabe produzir. */
export const templateOutputs = (spec: Pick<DocumentTemplateSpec, 'format' | 'outputs'>): DocumentOutputFormat[] => {
  const possible = DOCUMENT_OUTPUTS_BY_FORMAT[spec.format] ?? [];
  const declared = spec.outputs && spec.outputs.length > 0 ? spec.outputs : possible;
  return declared.filter((output) => possible.includes(output));
};

export interface DocumentTemplateIssue extends TemplateIssue {
  field: string;
}

const at = (field: string, issues: TemplateIssue[]): DocumentTemplateIssue[] =>
  issues.map((one) => ({ field, ...one }));

/**
 * Tudo o que se pode conferir sem o esquema do escritório e sem abrir o `.docx`. NUNCA lança.
 *
 * Os caminhos não são conferidos aqui: a tela pode não existir onde o pacote ainda não foi instalado,
 * e a mesma validação roda no empacotamento. Quem confere caminho é a geração, que tem o esquema.
 */
export const documentTemplateIssues = (spec: Partial<DocumentTemplateSpec>): DocumentTemplateIssue[] => {
  const issues: DocumentTemplateIssue[] = [];
  const push = (field: string, error: string, errorParams?: Record<string, string>): void => {
    issues.push(errorParams ? { field, error, errorParams } : { field, error });
  };

  const key = typeof spec.key === 'string' ? spec.key : '';
  if (!DOCUMENT_TEMPLATE_KEY_PATTERN.test(key) || key.length > DOCUMENT_TEMPLATE_KEY_MAX_LENGTH) {
    push('key', '@core.documents/template.key.invalid', { key });
  }
  if (typeof spec.title !== 'string' || !spec.title.trim()) push('title', '@core.documents/template.title.missing');
  const hasScreen = (typeof spec.collection === 'string' && spec.collection.trim() !== '')
    || (typeof spec.screenSourceId === 'string' && spec.screenSourceId.trim() !== '');
  if (!hasScreen) push('collection', '@core.documents/template.collection.missing');

  const format = spec.format;
  if (!format || !DOCUMENT_TEMPLATE_FORMATS.includes(format)) {
    push('format', '@core.documents/template.format.invalid', { format: String(format ?? '') });
    return issues;
  }

  if (format === 'markdown') {
    if (typeof spec.body !== 'string' || !spec.body.trim()) push('body', '@core.documents/template.body.missing');
    else issues.push(...at('body', parseTemplate(spec.body).issues));
  } else {
    const content = typeof spec.content === 'string' ? spec.content : '';
    if (!content) push('content', '@core.documents/template.content.missing');
    else if (!BASE64.test(content)) push('content', '@core.documents/template.content.invalid');
    else if (base64DecodedSize(content) > DOCUMENT_TEMPLATE_MAX_BYTES) {
      push('content', '@core.documents/template.content.too-large', {
        maxKb: String(DOCUMENT_TEMPLATE_MAX_BYTES / 1024),
      });
    }
  }

  const possible = DOCUMENT_OUTPUTS_BY_FORMAT[format];
  for (const output of spec.outputs ?? []) {
    if (!possible.includes(output)) {
      push('outputs', '@core.documents/template.output.unsupported', { format, output: String(output) });
    }
  }

  if (typeof spec.fileName === 'string' && spec.fileName.trim()) {
    issues.push(...at('fileName', parseTemplate(spec.fileName).issues));
  }

  if (spec.destination !== undefined && !isDocumentDestination(spec.destination)) {
    push('destination', '@core.documents/template.destination.invalid', { destination: String(spec.destination) });
  }
  if (spec.retentionDays !== undefined && !isRetentionDays(spec.retentionDays)) {
    push('retentionDays', '@core.documents/template.retention.invalid', {
      value: String(spec.retentionDays),
      max: String(DOWNLOAD_RETENTION_MAX_DAYS),
    });
  }

  const names = new Set<string>();
  (spec.datasets ?? []).forEach((dataset, index) => {
    const field = `datasets[${index}]`;
    if (!dataset || !IDENTIFIER.test(dataset.name ?? '')) {
      push(field, '@core.documents/template.dataset.name.invalid', { name: String(dataset?.name ?? '') });
    } else if (names.has(dataset.name)) {
      push(field, '@core.documents/template.dataset.name.duplicated', { name: dataset.name });
    } else {
      names.add(dataset.name);
    }
    if ((!dataset?.from?.trim() && !dataset?.fromSourceId?.trim()) || !dataset?.via?.trim()) {
      push(field, '@core.documents/template.dataset.source.missing');
    }
  });

  return issues;
};

export const DOCUMENT_TEMPLATE_POINT = 'document.template';

export const DOCUMENT_TEMPLATE_API_VERSION = '1.0.0';

/**
 * O ponto pelo qual um pacote traz modelos de documento.
 *
 * `allowedImplKinds: []`, como `i18n.messages`: o modelo é metadata pura, então qualquer pacote o
 * traz sem gesto de confiança — não há código a revisar. E não há materialização: o modelo do pacote
 * é DERIVADO do que está instalado, como a contribuição de UI. Desinstalar o leva embora, atualizar
 * o troca, e o escritório nunca fica com uma cópia velha que ele não pediu.
 */
export const DOCUMENT_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: DOCUMENT_TEMPLATE_POINT,
    apiVersion: DOCUMENT_TEMPLATE_API_VERSION,
    title: '@core.documents/point.template.title',
    description: '@core.documents/point.template.description',
    ownerPluginId: 'core.documents',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

export const documentTemplateContribution = (spec: DocumentTemplateSpec, priority?: number): Contribution => ({
  point: DOCUMENT_TEMPLATE_POINT,
  id: spec.key,
  apiVersion: DOCUMENT_TEMPLATE_API_VERSION,
  ...(priority === undefined ? {} : { priority }),
  metadata: spec as unknown as Record<string, unknown>,
});

/**
 * O problema é da GRAMÁTICA do texto, e não da forma do modelo. A gramática tolerante devolve a
 * melhor leitura possível e a geração diz onde está a lacuna; a forma errada não tem leitura nenhuma.
 */
export const isGrammarIssue = (issue: TemplateIssue): boolean => GRAMMAR_ISSUES.has(issue.error);

/**
 * Lê de volta o modelo de uma contribuição, descartando o que não tem FORMA de modelo. Nunca lança.
 * Um erro de gramática no texto não descarta: o modelo aparece, e a geração aponta a lacuna.
 */
export const documentTemplateOf = (contribution: Contribution): DocumentTemplateSpec | null => {
  if (contribution?.point !== DOCUMENT_TEMPLATE_POINT) return null;
  const spec = contribution.metadata as Partial<DocumentTemplateSpec> | undefined;
  if (!spec || typeof spec !== 'object') return null;
  return documentTemplateIssues(spec).some((one) => !isGrammarIssue(one)) ? null : (spec as DocumentTemplateSpec);
};

type TenantOnlyField = 'enabled' | 'basedOn' | 'updatedAt' | 'updatedBy';

/** O documento do escritório sem o que é só dele (o interruptor, a origem e o carimbo de quem gravou). */
const specOfTenantTemplate = (template: DocumentTemplate): Omit<DocumentTemplate, TenantOnlyField> => {
  const spec: Partial<DocumentTemplate> = { ...template };
  delete spec.enabled;
  delete spec.basedOn;
  delete spec.updatedAt;
  delete spec.updatedBy;
  return spec as Omit<DocumentTemplate, TenantOnlyField>;
};

/**
 * A impressão digital do modelo COMO A EXTENSÃO O DECLARA — antes de qualquer tradução de tela.
 * Subir a versão da extensão sem tocar o modelo não a move; trocar uma vírgula do texto, move.
 */
export const documentTemplateFingerprint = (spec: DocumentTemplateSpec): string =>
  contentFingerprint(spec);

/**
 * A cópia do escritório ficou para trás do original da extensão. Sem `basedOn` (cópia anterior ao
 * campo) a resposta é `false`: avisar sem saber seria alarme falso em toda cópia antiga.
 */
export const isTemplateCopyOutdated = (
  copy: Pick<DocumentTemplate, 'basedOn'>,
  packaged: DocumentTemplateSpec,
): boolean => typeof copy.basedOn === 'string' && copy.basedOn !== documentTemplateFingerprint(packaged);

/** A chave INSTALADA da tela de um `sourceId`, ou nada quando ela não está no escritório. */
export type ScreenKeyOfSource = (sourceId: string) => string | undefined;

/** Uma tela instalada como o modelo a enxerga: a chave, o `sourceId` e a coleção onde os registros moram. */
export interface TemplateScreen {
  key: string;
  sourceId?: string | null;
  collection?: string | null;
}

/**
 * As duas traduções que a resolução faz. A autoria fala de TELA (chave ou `sourceId`); a geração fala
 * de COLEÇÃO física — é por ela que o esquema é indexado, que o registro é lido e que a permissão
 * `<coleção>.update` é cobrada. A chave e a coleção só coincidem quando a tela não declara
 * `dataCollection`.
 */
export interface TemplateScreenIndex {
  keyOfSource: ScreenKeyOfSource;
  /** A coleção da tela de chave `screenKey`; sem tela com essa chave, o próprio valor, que já é coleção. */
  collectionOf: (screenKey: string) => string;
}

export const templateScreenIndex = (screens: readonly TemplateScreen[]): TemplateScreenIndex => {
  const keyBySource = new Map<string, string>();
  const collectionByKey = new Map<string, string>();
  for (const screen of screens) {
    if (screen.sourceId) keyBySource.set(screen.sourceId, screen.key);
    collectionByKey.set(screen.key, screen.collection || screen.key);
  }
  return {
    keyOfSource: (sourceId) => keyBySource.get(sourceId),
    collectionOf: (screenKey) => collectionByKey.get(screenKey) ?? screenKey,
  };
};

/**
 * A tela do modelo como CHAVE instalada. `screenSourceId` vence `collection`; sem tela instalada com
 * aquele `sourceId`, `null` — o modelo fala de registros que este escritório não tem.
 */
export const templateCollection = <T extends Pick<DocumentTemplateSpec, 'collection' | 'screenSourceId'>>(
  spec: T,
  screenKeyOf: ScreenKeyOfSource,
): string | null => {
  if (spec.screenSourceId) return screenKeyOf(spec.screenSourceId) ?? null;
  return spec.collection || null;
};

/** A coleção física da tela do modelo, ou `null` quando a tela não está no escritório. */
const installedCollection = (
  spec: Pick<DocumentTemplateSpec, 'collection' | 'screenSourceId'>,
  screens: TemplateScreenIndex,
): string | null => {
  const key = templateCollection(spec, screens.keyOfSource);
  return key === null ? null : screens.collectionOf(key);
};

/**
 * As listas com `from` na coleção FÍSICA dos filhos. `null` quando alguma aponta para uma tela que o
 * escritório não tem: o modelo repetiria uma lista que não existe, e a geração recusaria — melhor
 * não oferecê-lo.
 */
const installedDatasets = (
  datasets: readonly DocumentTemplateDataset[] | undefined,
  screens: TemplateScreenIndex,
): DocumentTemplateDataset[] | null => {
  const resolved: DocumentTemplateDataset[] = [];
  for (const dataset of datasets ?? []) {
    const from = dataset.fromSourceId ? screens.keyOfSource(dataset.fromSourceId) : dataset.from;
    if (!from) return null;
    resolved.push({ ...dataset, from: screens.collectionOf(from) });
  }
  return resolved;
};

/**
 * O conjunto que VALE: um modelo por chave, com `collection` e `datasets[].from` sempre a COLEÇÃO
 * física — a do registro sobre o qual o documento é gerado, e não a chave da tela que a descreve.
 *
 * Os do pacote entram na ordem do registro (prioridade, depois `pluginId`) e o primeiro de cada
 * chave vence — a mesma regra de toda contribuição disputada. Depois o escritório: o documento dele
 * substitui o do pacote na mesma chave, e `enabled: false` tira a chave de circulação, que é como o
 * escritório recusa um modelo de pacote sem desinstalar a extensão inteira.
 */
export const resolveDocumentTemplates = (
  packaged: readonly QualifiedContribution[],
  tenant: readonly DocumentTemplate[],
  screens: TemplateScreenIndex = templateScreenIndex([]),
): ResolvedDocumentTemplate[] => {
  const byKey = new Map<string, ResolvedDocumentTemplate>();

  for (const contribution of packaged) {
    const spec = documentTemplateOf(contribution);
    if (!spec || byKey.has(spec.key)) continue;
    // A tela que não está no escritório tira o modelo de circulação, sem tomar a chave de ninguém.
    const collection = installedCollection(spec, screens);
    const datasets = installedDatasets(spec.datasets, screens);
    if (collection === null || datasets === null) continue;
    byKey.set(spec.key, {
      ...spec,
      collection,
      ...(spec.datasets ? { datasets } : {}),
      origin: 'plugin',
      pluginId: contribution.pluginId,
    });
  }

  for (const template of tenant) {
    const packagedOne = byKey.get(template.key);
    if (template.enabled === false) {
      byKey.delete(template.key);
      continue;
    }
    const collection = installedCollection(template, screens);
    const datasets = installedDatasets(template.datasets, screens);
    if (collection === null || datasets === null) {
      byKey.delete(template.key);
      continue;
    }
    byKey.set(template.key, {
      ...specOfTenantTemplate(template),
      collection,
      ...(template.datasets ? { datasets } : {}),
      origin: 'tenant',
      ...(packagedOne ? { pluginId: packagedOne.pluginId, overridesPlugin: true } : {}),
    });
  }

  return [...byKey.values()].sort((left, right) => left.title.localeCompare(right.title));
};

/** Os modelos que servem aos registros de uma coleção física. */
export const templatesForCollection = (
  templates: readonly ResolvedDocumentTemplate[],
  collection: string,
): ResolvedDocumentTemplate[] => templates.filter((template) => template.collection === collection);
