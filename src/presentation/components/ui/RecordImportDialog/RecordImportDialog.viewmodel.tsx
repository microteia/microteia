import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useTenant } from '../../../../stores/useTenant';
import { useSchemaContext } from '../../../shared/useSchemaContext';
import { useLabel, useT } from '../../../shared/i18n/useT';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import {
  buildImportRows,
  importableFields,
  importFileKindOf,
  importMappingIssue,
  importPrimaryKeyFields,
  parseImportFile,
  RECORD_IMPORT_MAX_FILE_BYTES,
  suggestImportMapping,
} from '../../../../domain/services/recordImportFile';
import type {
  ImportDateFormat,
  ImportDecimalSeparator,
  ImportTable,
} from '../../../../domain/services/recordImportFile';
import { RECORD_IMPORT_MAX_ROWS } from '../../../../domain/schema/recordImport';
import type {
  RecordImportLookup,
  RecordImportParent,
  RecordImportRowResult,
  RecordImportTotals,
} from '../../../../domain/schema/recordImport';
import { reportResultToCsv } from '../../../../domain/schema/report/reportCsv';
import { makeRunRecordImportUseCase } from '../../../../domain/usecases/records/RunRecordImportUseCase';
import type { SearchSelectOption } from '../SearchSelect';

export interface RecordImportDialogProps {
  /** A coleção da tela — a mesma que o formulário e a lista usam. */
  collection: string;
  /** O título da tela, já resolvido, para dizer ONDE os registros vão entrar. */
  screenTitle: string;
  /**
   * A importação aberta na aba de um registro: o campo de vínculo sai do mapeamento, e o servidor o grava
   * com o registro aberto em cada linha.
   */
  parent?: RecordImportParent;
  onClose: () => void;
}

export type RecordImportStep = 'file' | 'mapping' | 'running' | 'report';

export interface RecordImportColumn {
  index: number;
  header: string;
  sample: string;
  fieldKey: string;
}

export interface RecordImportReportRow {
  key: string;
  line: string;
  message: string;
}

export interface RecordImportDialogViewModel {
  title: string;
  step: RecordImportStep;
  inputId: string;
  handlePick: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  fileName: string;
  fileError: string | null;
  hint: string;
  columns: RecordImportColumn[];
  fieldOptions: SearchSelectOption[];
  setColumnField: (index: number, fieldKey: string) => void;
  keyNotice: { message: string; variant: 'info' | 'warning' };
  requiredNotice: string | null;
  parentNotice: string | null;
  showsTextOptions: boolean;
  decimalOptions: SearchSelectOption[];
  decimalSeparator: string;
  setDecimalSeparator: (value: string) => void;
  dateOptions: SearchSelectOption[];
  dateFormat: string;
  setDateFormat: (value: string) => void;
  mappingError: string | null;
  canRun: boolean;
  simulate: () => void;
  confirmOpen: boolean;
  confirmMessage: string;
  askImport: () => void;
  cancelConfirm: () => void;
  runImport: () => void;
  progressText: string;
  progressPercent: number;
  isCancelling: boolean;
  cancelRun: () => void;
  runError: string | null;
  summary: string;
  reportRows: RecordImportReportRow[];
  hiddenFailures: string | null;
  canDownloadFailures: boolean;
  downloadFailures: () => void;
  canImportAfterSimulation: boolean;
  backToMapping: () => void;
  backToFile: () => void;
  close: () => void;
}

interface RunReport {
  dryRun: boolean;
  cancelled: boolean;
  results: RecordImportRowResult[];
  totals: RecordImportTotals;
}

/** Quantas linhas recusadas a tela lista. O arquivo baixado tem todas. */
const REPORT_VISIBLE_ROWS = 200;

const IGNORE = '';

/** O valor da opção "campo de referência, procurado pela chave": nem chave de campo nem nome de chave têm quebra de linha. */
const LOOKUP_SEPARATOR = '\n';

const lookupOption = (fieldKey: string, key: string): string => `${fieldKey}${LOOKUP_SEPARATOR}${key}`;

const parseOption = (value: string): { fieldKey: string; key: string | null } => {
  const [fieldKey, key] = value.split(LOOKUP_SEPARATOR);
  return { fieldKey, key: key ?? null };
};

const sampleText = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

export const useRecordImportDialogViewModel = ({
  collection,
  screenTitle,
  parent,
  onClose,
}: RecordImportDialogProps): RecordImportDialogViewModel => {
  const t = useT('core.records');
  const label = useLabel();
  const { recordImportRepository } = useDI();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? '';
  const ctx = useSchemaContext();
  const inputId = useId();

  const lockedFieldKey = parent?.fieldKey;
  const fields = useMemo(() => importableFields(ctx, collection, { lockedFieldKey }), [ctx, collection, lockedFieldKey]);
  const primaryFields = useMemo(() => importPrimaryKeyFields(ctx, collection), [ctx, collection]);
  const fieldLabel = useCallback((key: string) => {
    const field = fields.find((candidate) => candidate.key === key);
    return field ? label(field.label) || field.key : key;
  }, [fields, label]);

  const [step, setStep] = useState<RecordImportStep>('file');
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [table, setTable] = useState<ImportTable | null>(null);
  const [mapping, setMapping] = useState<(string | null)[]>([]);
  const [lookupKeys, setLookupKeys] = useState<Record<string, string>>({});
  const [decimalSeparator, setDecimalSeparator] = useState<ImportDecimalSeparator>('.');
  const [dateFormat, setDateFormat] = useState<ImportDateFormat>('iso');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, dryRun: true });
  const [isCancelling, setIsCancelling] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const cancelRequested = useRef(false);
  const closeAfterRun = useRef(false);

  const describe = useCallback(
    (error: unknown, fallback: string) =>
      label(error instanceof Error && error.message.startsWith('@') ? error.message : fallback, errorParamsOf(error)),
    [label],
  );

  const handlePick = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setFileError(null);
    const kind = importFileKindOf(file.name);
    if (!kind) {
      setFileError(t('import.file.unsupported'));
      return;
    }
    if (file.size > RECORD_IMPORT_MAX_FILE_BYTES) {
      setFileError(t('import.file.too-large', { megabytes: String(RECORD_IMPORT_MAX_FILE_BYTES / (1024 * 1024)) }));
      return;
    }
    const parsed = parseImportFile(kind, await file.text());
    if (!parsed.ok) {
      setFileError(label(parsed.error, parsed.errorParams));
      return;
    }
    if (parsed.table.rows.length === 0) {
      setFileError(t('import.file.empty'));
      return;
    }
    if (parsed.table.rows.length > RECORD_IMPORT_MAX_ROWS) {
      setFileError(t('import.file.too-many-rows', { max: String(RECORD_IMPORT_MAX_ROWS) }));
      return;
    }
    setTable(parsed.table);
    setMapping(suggestImportMapping(parsed.table.headers, fields, (field) => label(field.label)));
    setLookupKeys({});
    setReport(null);
    setStep('mapping');
  }, [fields, label, t]);

  const columns = useMemo<RecordImportColumn[]>(() => (table?.headers ?? []).map((header, index) => ({
    index,
    header: header || t('import.mapping.column', { number: String(index + 1) }),
    sample: sampleText(table?.rows.find((row) => sampleText(row.cells[index]) !== '')?.cells[index]),
    fieldKey: mapping[index]
      ? (lookupKeys[mapping[index]] ? lookupOption(mapping[index], lookupKeys[mapping[index]]) : mapping[index])
      : IGNORE,
  })), [table, mapping, lookupKeys, t]);

  // Uma referência cujo alvo declara chave aparece também "procurada por" cada uma: a planilha de fora
  // traz o CPF, não o id. A opção pelo id continua — e continua sendo a primeira, como sempre foi.
  const fieldOptions = useMemo<SearchSelectOption[]>(() => [
    { value: IGNORE, label: t('import.mapping.ignore') },
    ...fields.flatMap((field) => {
      const meta = field.primary ? t('import.mapping.key') : field.required ? t('import.mapping.required') : undefined;
      return [
        {
          value: field.key,
          label: field.lookupKeys.length > 0 ? t('import.mapping.by-id', { field: fieldLabel(field.key) }) : fieldLabel(field.key),
          meta,
        },
        ...field.lookupKeys.map((lookup) => ({
          value: lookupOption(field.key, lookup.key),
          label: t('import.mapping.by-key', { field: fieldLabel(field.key), key: label(lookup.label) || lookup.key }),
          meta,
        })),
      ];
    }),
  ], [fields, fieldLabel, label, t]);

  const setColumnField = useCallback((index: number, value: string) => {
    const { fieldKey, key } = parseOption(value);
    setMapping((current) => current.map((mapped, column) => (column === index ? (fieldKey === IGNORE ? null : fieldKey) : mapped)));
    if (fieldKey === IGNORE) return;
    setLookupKeys((current) => {
      const rest = Object.fromEntries(Object.entries(current).filter(([mapped]) => mapped !== fieldKey));
      return key ? { ...rest, [fieldKey]: key } : rest;
    });
  }, []);

  const lookups = useMemo<RecordImportLookup[]>(
    () => Object.entries(lookupKeys)
      .filter(([fieldKey]) => mapping.includes(fieldKey))
      .map(([fieldKey, key]) => ({ fieldKey, key })),
    [lookupKeys, mapping],
  );

  const keyNotice = useMemo(() => {
    if (primaryFields.length === 0) return { message: t('import.key.none'), variant: 'warning' as const };
    // Na aba do pai, o vínculo é parte da chave mas não é coluna: o aviso cita só o que a pessoa liga.
    const mappable = primaryFields.filter((key) => key !== lockedFieldKey);
    const names = (mappable.length > 0 ? mappable : primaryFields).map(fieldLabel).join(', ');
    return mappable.every((key) => mapping.includes(key))
      ? { message: t('import.key.matched', { fields: names }), variant: 'info' as const }
      : { message: t('import.key.unmapped', { fields: names }), variant: 'warning' as const };
  }, [primaryFields, mapping, lockedFieldKey, fieldLabel, t]);

  const requiredNotice = useMemo(() => {
    const missing = fields.filter((field) => field.required && !mapping.includes(field.key)).map((field) => fieldLabel(field.key));
    return missing.length > 0 ? t('import.mapping.required-missing', { fields: missing.join(', ') }) : null;
  }, [fields, mapping, fieldLabel, t]);

  const mappingIssue = importMappingIssue(mapping);
  const built = useMemo(
    () => (table ? buildImportRows(table, mapping, fields, { decimalSeparator, dateFormat }) : { rows: [], rejected: [] }),
    [table, mapping, fields, decimalSeparator, dateFormat],
  );

  const run = useCallback(async (dryRun: boolean) => {
    if (!table || mappingIssue || !tenantId) return;
    cancelRequested.current = false;
    setIsCancelling(false);
    setConfirmOpen(false);
    setRunError(null);
    setProgress({ done: 0, total: table.rows.length, dryRun });
    setStep('running');
    try {
      const outcome = await makeRunRecordImportUseCase(recordImportRepository).execute({
        tenantId,
        table: collection,
        fileName,
        rows: built.rows,
        rejected: built.rejected,
        ...(parent ? { parent } : {}),
        lookups,
        dryRun,
        onProgress: (done, total) => setProgress({ done, total, dryRun }),
        isCancelled: () => cancelRequested.current,
      });
      setReport({ dryRun, ...outcome });
      setStep('report');
    } catch (error) {
      setRunError(describe(error, '@core.records/import.error.row-failed'));
      setStep('mapping');
    }
    if (closeAfterRun.current) onClose();
  }, [table, mappingIssue, tenantId, recordImportRepository, collection, fileName, built, parent, lookups, describe, onClose]);

  const cancelRun = useCallback(() => {
    cancelRequested.current = true;
    setIsCancelling(true);
  }, []);

  const close = useCallback(() => {
    if (step !== 'running') {
      onClose();
      return;
    }
    closeAfterRun.current = true;
    cancelRun();
  }, [step, onClose, cancelRun]);

  const failures = useMemo(() => (report?.results ?? []).filter((result) => result.status === 'failed'), [report]);
  const describeResult = useCallback(
    (result: RecordImportRowResult) => (result.error ? label(result.error, result.errorParams) : ''),
    [label],
  );

  const reportRows = useMemo<RecordImportReportRow[]>(() => failures.slice(0, REPORT_VISIBLE_ROWS).map((result) => ({
    key: String(result.line),
    line: String(result.line),
    message: describeResult(result),
  })), [failures, describeResult]);

  const downloadFailures = useCallback(() => {
    const csv = reportResultToCsv({
      header: [t('import.report.line'), t('import.report.message')],
      rows: failures.map((result) => [String(result.line), describeResult(result)]),
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = t('import.report.file-name', { file: fileName.replace(/\.[^.]+$/, '') });
    anchor.click();
    URL.revokeObjectURL(url);
  }, [failures, describeResult, fileName, t]);

  const summary = useMemo(() => {
    if (!report) return '';
    const params = {
      total: String(table?.rows.length ?? 0),
      created: String(report.totals.created),
      updated: String(report.totals.updated),
      failed: String(report.totals.failed),
    };
    if (report.dryRun) return t('import.report.simulated', params);
    return report.cancelled ? t('import.report.cancelled', params) : t('import.report.finished', params);
  }, [report, table, t]);

  return {
    title: t('import.title', { screen: screenTitle }),
    step,
    inputId,
    handlePick,
    fileName,
    fileError,
    hint: t('import.file.hint', { max: String(RECORD_IMPORT_MAX_ROWS) }),
    columns,
    fieldOptions,
    setColumnField,
    keyNotice,
    requiredNotice,
    parentNotice: parent ? t('import.parent.notice') : null,
    showsTextOptions: table?.kind === 'csv',
    decimalOptions: [
      { value: '.', label: t('import.option.decimal-point') },
      { value: ',', label: t('import.option.decimal-comma') },
    ],
    decimalSeparator,
    setDecimalSeparator: (value) => setDecimalSeparator(value === ',' ? ',' : '.'),
    dateOptions: [
      { value: 'iso', label: t('import.option.date-iso') },
      { value: 'dmy', label: t('import.option.date-dmy') },
      { value: 'mdy', label: t('import.option.date-mdy') },
    ],
    dateFormat,
    setDateFormat: (value) => setDateFormat(value === 'dmy' || value === 'mdy' ? value : 'iso'),
    mappingError: mappingIssue ? label(mappingIssue) : null,
    canRun: step === 'mapping' && !mappingIssue && built.rows.length > 0,
    simulate: () => void run(true),
    confirmOpen,
    confirmMessage: t('import.confirm.message', { count: String(built.rows.length), screen: screenTitle }),
    askImport: () => setConfirmOpen(true),
    cancelConfirm: () => setConfirmOpen(false),
    runImport: () => void run(false),
    progressText: t(progress.dryRun ? 'import.progress.simulating' : 'import.progress.importing', {
      done: String(progress.done),
      total: String(progress.total),
    }),
    progressPercent: progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0,
    isCancelling,
    cancelRun,
    runError,
    summary,
    reportRows,
    hiddenFailures: failures.length > REPORT_VISIBLE_ROWS
      ? t('import.report.more', { count: String(failures.length - REPORT_VISIBLE_ROWS) })
      : null,
    canDownloadFailures: failures.length > 0,
    downloadFailures,
    canImportAfterSimulation: report?.dryRun === true && built.rows.length > 0,
    backToMapping: () => setStep('mapping'),
    backToFile: () => {
      setTable(null);
      setReport(null);
      setStep('file');
    },
    close,
  };
};
