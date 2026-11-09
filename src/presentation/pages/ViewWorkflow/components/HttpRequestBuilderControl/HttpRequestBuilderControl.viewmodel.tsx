import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT, useLabel } from '../../../../shared/i18n/useT';
import { useTenant } from '../../../../../stores/useTenant';
import { useDI } from '../../../../../infrastructure/di/useDI';
import { makeGetHttpConnectionsUseCase } from '../../../../../domain/usecases/httpconnections/GetHttpConnectionsUseCase';
import { makeTestHttpRequestUseCase } from '../../../../../domain/usecases/httpconnections/TestHttpRequestUseCase';
import type { HttpConnection } from '../../../../../domain/schema/httpConnection';
import { useResolvedSetting } from '../../../../shared/settings/useSettingValue';
import type { InputMapping } from '../../../../../domain/entities/Workflow';
import type { MapFieldMapping } from '../../../../../domain/schema/mapSpec';
import type { PathRoot } from '../../../../../domain/schema/pathResolver';
import type { WorkflowEventFieldOption } from '../../../../../domain/services/workflowEventCatalog';
import type { StepOutputField, WorkflowVariable } from '../../../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';
import {
  asStringList,
  HTTP_ALLOWED_HOSTS_PROPERTY,
  HTTP_BODY_KINDS,
  HTTP_METHODS,
  HTTP_REQUEST_MODES,
  HTTP_RESPONSE_TYPES,
  HTTP_RETRIES_DEFAULT,
  HTTP_RETRIES_MAX,
  HTTP_TIMEOUT_DEFAULT_SECONDS,
  HTTP_TIMEOUT_MAX_SECONDS,
  HTTP_TIMEOUT_MIN_SECONDS,
  httpDynamicValues,
  httpRequestSpecWarnings,
  httpSampleFromBody,
  isAsyncHttpSpec,
  isHttpHostAllowed,
  parseHttpUrl,
  validateHttpRequestSpec,
  withLiteralValues,
  type HttpBodyKind,
  type HttpRequestMode,
  type HttpTestResult,
  type HttpRequestBody,
  type HttpRequestSpec,
  type HttpResponseType,
} from '../../../../../domain/schema/httpRequestSpec';

export interface HttpRequestBuilderControlProps {
  value: HttpRequestSpec | undefined;
  onChange: (spec: HttpRequestSpec) => void;
  eventFields: WorkflowEventFieldOption[];
  pathRoot?: PathRoot | null;
  inputRoot?: PathRoot | null;
  stepOutputFields: StepOutputField[];
  workflowVariables: WorkflowVariable[];
  priorStepOptions: SearchSelectOption[];
  getStepOutputs: (stepId: string) => { value: string; label: string }[];
}

/** As listas de pares nome/valor da especificação. `bodyFields` é a do corpo JSON ou de formulário. */
export type HttpFieldList = 'pathParams' | 'query' | 'headers' | 'bodyFields';

const EMPTY_LITERAL: InputMapping = { kind: 'Literal', value: '' };

const EMPTY_SPEC: HttpRequestSpec = {
  method: 'GET',
  url: EMPTY_LITERAL,
  timeoutSeconds: HTTP_TIMEOUT_DEFAULT_SECONDS,
  failOnHttpError: true,
  responseType: 'auto',
};

const fieldsOf = (spec: HttpRequestSpec, list: HttpFieldList): MapFieldMapping[] => {
  if (list !== 'bodyFields') return spec[list] ?? [];
  const body = spec.body;
  return body && (body.kind === 'json' || body.kind === 'form') ? body.fields : [];
};

const withFields = (spec: HttpRequestSpec, list: HttpFieldList, fields: MapFieldMapping[]): HttpRequestSpec => {
  if (list !== 'bodyFields') return { ...spec, [list]: fields };
  const body = spec.body;
  return body && (body.kind === 'json' || body.kind === 'form') ? { ...spec, body: { ...body, fields } } : spec;
};

/** Trocar o tipo do corpo aproveita o que dá: os campos passam entre JSON e formulário. */
const bodyFor = (kind: HttpBodyKind, previous: HttpRequestBody | undefined): HttpRequestBody => {
  const fields = previous && (previous.kind === 'json' || previous.kind === 'form') ? previous.fields : [];
  switch (kind) {
    case 'json': return { kind: 'json', fields };
    case 'form': return { kind: 'form', fields };
    case 'json-from': return { kind: 'json-from', value: EMPTY_LITERAL };
    case 'text': return { kind: 'text', contentType: 'text/plain', value: EMPTY_LITERAL };
    default: return { kind: 'none' };
  }
};

/** O host de uma URL fixa — com os marcadores trocados, para que `{id}` não a torne inválida. */
const literalHost = (url: InputMapping): string | null => {
  if (url.kind !== 'Literal' || typeof url.value !== 'string' || !url.value.trim()) return null;
  const parsed = parseHttpUrl(url.value.replace(/\{[A-Za-z_][A-Za-z0-9_]*\}/g, 'x'));
  return 'url' in parsed ? parsed.url.hostname : null;
};

/** Um valor dinâmico da especificação, com o exemplo que a pessoa digitou para o teste. */
export interface HttpTestField {
  field: string;
  label: string;
  value: string;
}

/** O resultado do teste, já pronto para mostrar. */
export interface HttpTestOutcome {
  ok: boolean;
  /** "200 em 132 ms", ou a recusa/falha traduzida. */
  summary: string;
  /** O corpo da resposta como texto — o que "Usar como exemplo" grava. */
  body: string;
}

export interface HttpRequestBuilderControlViewModel {
  spec: HttpRequestSpec;
  isAsync: boolean;
  modeOptions: SearchSelectOption[];
  modeHint: string;
  setMode: (mode: string) => void;
  retriesText: string;
  retriesHint: string;
  setRetriesText: (text: string) => void;
  testFields: HttpTestField[];
  setTestValue: (field: string, value: string) => void;
  testing: boolean;
  testOutcome: HttpTestOutcome | null;
  runTest: () => Promise<void>;
  /** Só no síncrono — o exemplo alimenta as sugestões de `body.` dos passos seguintes. */
  canUseAsSample: boolean;
  applyTestAsSample: () => void;
  methodOptions: SearchSelectOption[];
  bodyKindOptions: SearchSelectOption[];
  responseTypeOptions: SearchSelectOption[];
  bodyKind: HttpBodyKind;
  bodyHasFields: boolean;
  bodyValue: InputMapping | undefined;
  bodyContentType: string;
  timeoutText: string;
  timeoutHint: string;
  /** O aviso sobre a lista de domínios do escritório, ou `null` quando a chamada está coberta. */
  hostWarning: string | null;
  connectionOptions: SearchSelectOption[];
  /** O aviso sobre a credencial escolhida (inexistente, ou que não vai para este domínio). */
  connectionWarning: string | null;
  setConnection: (key: string) => void;
  /** As recusas da especificação e os avisos (segredo com valor fixo), já traduzidos. */
  issues: string[];
  warnings: string[];
  fields: (list: HttpFieldList) => MapFieldMapping[];
  setMethod: (method: string) => void;
  setUrl: (url: InputMapping) => void;
  addField: (list: HttpFieldList) => void;
  updateField: (list: HttpFieldList, index: number, field: MapFieldMapping) => void;
  removeField: (list: HttpFieldList, index: number) => void;
  setBodyKind: (kind: string) => void;
  setBodyValue: (value: InputMapping) => void;
  setBodyContentType: (contentType: string) => void;
  setTimeoutText: (text: string) => void;
  setFailOnHttpError: (fail: boolean) => void;
  setResponseType: (type: string) => void;
  setResponseSample: (sample: string) => void;
}

export const useHttpRequestBuilderControlViewModel = (
  value: HttpRequestBuilderControlProps['value'],
  onChange: HttpRequestBuilderControlProps['onChange'],
): HttpRequestBuilderControlViewModel => {
  const t = useT('core.automation');
  const label = useLabel();
  const spec = useMemo(() => value ?? EMPTY_SPEC, [value]);
  const allowedHosts = asStringList(useResolvedSetting(HTTP_ALLOWED_HOSTS_PROPERTY).value);
  const { currentTenant } = useTenant();
  const { httpConnectionRepository, httpRequestTester } = useDI();
  const getConnections = useMemo(() => makeGetHttpConnectionsUseCase(httpConnectionRepository), [httpConnectionRepository]);
  const [connections, setConnections] = useState<HttpConnection[] | null>(null);
  const testRequest = useMemo(() => makeTestHttpRequestUseCase(httpRequestTester), [httpRequestTester]);
  const [testValues, setTestValues] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<HttpTestResult | null>(null);
  const [testFailed, setTestFailed] = useState(false);

  // Só a DESCRIÇÃO das credenciais — chave, nome, domínios. O segredo não é legível pelo navegador.
  useEffect(() => {
    if (!currentTenant) return;
    let alive = true;
    getConnections.execute(currentTenant.id)
      .then((list) => { if (alive) setConnections(list); })
      .catch(() => { if (alive) setConnections([]); });
    return () => { alive = false; };
  }, [currentTenant, getConnections]);

  const methodOptions = useMemo<SearchSelectOption[]>(
    () => HTTP_METHODS.map((method) => ({ value: method, label: method })),
    [],
  );
  const bodyKindOptions = useMemo<SearchSelectOption[]>(
    () => HTTP_BODY_KINDS.map((kind) => ({ value: kind, label: t(`http.body.kind.${kind}`) })),
    [t],
  );
  const responseTypeOptions = useMemo<SearchSelectOption[]>(
    () => HTTP_RESPONSE_TYPES.map((type) => ({ value: type, label: t(`http.response-type.${type}`) })),
    [t],
  );

  const emit = useCallback((next: HttpRequestSpec) => onChange(next), [onChange]);

  const setMethod = useCallback((method: string) => {
    const next = { ...spec, method: method as HttpRequestSpec['method'] };
    // GET não leva corpo: trocar para GET descarta o corpo, em vez de deixar uma recusa pendurada.
    emit(method === 'GET' ? { ...next, body: undefined } : next);
  }, [emit, spec]);

  const setUrl = useCallback((url: InputMapping) => emit({ ...spec, url }), [emit, spec]);

  const fields = useCallback((list: HttpFieldList) => fieldsOf(spec, list), [spec]);

  const addField = useCallback((list: HttpFieldList) => {
    emit(withFields(spec, list, [...fieldsOf(spec, list), { name: '', value: EMPTY_LITERAL }]));
  }, [emit, spec]);

  const updateField = useCallback((list: HttpFieldList, index: number, field: MapFieldMapping) => {
    emit(withFields(spec, list, fieldsOf(spec, list).map((item, i) => (i === index ? field : item))));
  }, [emit, spec]);

  const removeField = useCallback((list: HttpFieldList, index: number) => {
    emit(withFields(spec, list, fieldsOf(spec, list).filter((_, i) => i !== index)));
  }, [emit, spec]);

  const setBodyKind = useCallback((kind: string) => {
    const body = bodyFor(kind as HttpBodyKind, spec.body);
    emit({ ...spec, body: body.kind === 'none' ? undefined : body });
  }, [emit, spec]);

  const setBodyValue = useCallback((next: InputMapping) => {
    const body = spec.body;
    if (body?.kind === 'json-from' || body?.kind === 'text') emit({ ...spec, body: { ...body, value: next } });
  }, [emit, spec]);

  const setBodyContentType = useCallback((contentType: string) => {
    if (spec.body?.kind === 'text') emit({ ...spec, body: { ...spec.body, contentType } });
  }, [emit, spec]);

  const setTimeoutText = useCallback((text: string) => {
    const trimmed = text.trim();
    emit({ ...spec, timeoutSeconds: trimmed === '' ? undefined : Number(trimmed) });
  }, [emit, spec]);

  const setFailOnHttpError = useCallback((fail: boolean) => emit({ ...spec, failOnHttpError: fail }), [emit, spec]);

  const setResponseType = useCallback(
    (type: string) => emit({ ...spec, responseType: (type || 'auto') as HttpResponseType }),
    [emit, spec],
  );

  const setConnection = useCallback(
    (key: string) => emit({ ...spec, connection: key === '' ? undefined : key }),
    [emit, spec],
  );

  const connectionOptions = useMemo<SearchSelectOption[]>(() => {
    const options: SearchSelectOption[] = [
      { value: '', label: t('http.connection.none') },
      ...(connections ?? []).map((one) => ({ value: one.key, label: t('http.connection.option', { name: one.name, key: one.key }) })),
    ];
    const current = spec.connection;
    return current && connections && !connections.some((one) => one.key === current)
      ? [...options, { value: current, label: t('http.connection.missing', { key: current }) }]
      : options;
  }, [connections, spec.connection, t]);

  const setResponseSample = useCallback(
    (sample: string) => emit({ ...spec, responseSample: sample === '' ? undefined : sample }),
    [emit, spec],
  );

  const isAsync = isAsyncHttpSpec(spec);
  const modeOptions = useMemo<SearchSelectOption[]>(
    () => HTTP_REQUEST_MODES.map((mode) => ({ value: mode, label: t(`http.mode.${mode}`) })),
    [t],
  );

  const setMode = useCallback((mode: string) => {
    const next = (mode || 'sync') as HttpRequestMode;
    // `sync` não é gravado: ausente é síncrono, e a especificação de antes do modo continua idêntica.
    emit(next === 'async'
      ? { ...spec, mode: 'async' }
      : { ...spec, mode: undefined, retries: undefined });
  }, [emit, spec]);

  const setRetriesText = useCallback((text: string) => {
    const trimmed = text.trim();
    emit({ ...spec, retries: trimmed === '' ? undefined : Number(trimmed) });
  }, [emit, spec]);

  const dynamicValues = useMemo(() => httpDynamicValues(spec), [spec]);
  const testFields = useMemo<HttpTestField[]>(
    () => dynamicValues.map(({ field, name }) => ({
      field,
      label: name ? t('http.test.value-named', { name }) : t(field === 'url' ? 'http.url' : 'http.body'),
      value: testValues[field] ?? '',
    })),
    [dynamicValues, testValues, t],
  );

  const setTestValue = useCallback((field: string, value: string) => {
    setTestValues((current) => ({ ...current, [field]: value }));
  }, []);

  const runTest = useCallback(async () => {
    if (!currentTenant) return;
    // O corpo inteiro vindo de um valor (`json-from`) é um OBJETO: o exemplo digitado é lido como JSON
    // quando dá. Os demais seguem como texto — é o que um parâmetro ou cabeçalho é na rede.
    const values: Record<string, unknown> = {};
    for (const [field, text] of Object.entries(testValues)) {
      if (field === 'body.value' && spec.body?.kind === 'json-from') {
        try {
          values[field] = JSON.parse(text) as unknown;
          continue;
        } catch {
          // Não é JSON: vai como texto, e a API diz o que achou dele.
        }
      }
      values[field] = text;
    }
    setTesting(true);
    setTestFailed(false);
    setTestResult(null);
    try {
      setTestResult(await testRequest.execute(currentTenant.id, withLiteralValues(spec, values)));
    } catch {
      setTestFailed(true);
    } finally {
      setTesting(false);
    }
  }, [currentTenant, spec, testRequest, testValues]);

  const testOutcome = useMemo<HttpTestOutcome | null>(() => {
    if (testFailed) return { ok: false, summary: t('http.test.failed'), body: '' };
    if (!testResult) return null;
    const head = testResult.status > 0
      ? t('http.test.status', { status: String(testResult.status), ms: String(testResult.durationMs) })
      : '';
    const problem = testResult.error ? label(testResult.error, testResult.errorParams) : '';
    return {
      ok: testResult.ok,
      summary: [head, problem].filter(Boolean).join(' — '),
      body: testResult.body === null || testResult.body === undefined ? '' : httpSampleFromBody(testResult.body),
    };
  }, [testFailed, testResult, t, label]);

  const applyTestAsSample = useCallback(() => {
    if (testOutcome?.body) emit({ ...spec, responseSample: testOutcome.body });
  }, [emit, spec, testOutcome]);

  const issues = useMemo(
    () => validateHttpRequestSpec(spec).map((issue) => label(issue.error, issue.errorParams)),
    [spec, label],
  );
  const warnings = useMemo(
    () => httpRequestSpecWarnings(spec).map((issue) => label(issue.error, issue.errorParams)),
    [spec, label],
  );

  const host = literalHost(spec.url);
  const hostWarning = allowedHosts.length === 0
    ? t('http.no-hosts')
    : host && !isHttpHostAllowed(host, allowedHosts)
      ? t('http.host-outside', { host })
      : null;

  const chosen = spec.connection && connections ? connections.find((one) => one.key === spec.connection) : undefined;
  const connectionWarning = !spec.connection || connections === null
    ? null
    : !chosen
      ? t('http.connection.missing-warning', { key: spec.connection })
      : host && !isHttpHostAllowed(host, chosen.hosts)
        ? t('http.connection.host-outside', { key: chosen.key, host })
        : null;

  const body = spec.body;
  return {
    spec,
    isAsync,
    modeOptions,
    modeHint: t(isAsync ? 'http.mode.async.hint' : 'http.mode.sync.hint'),
    setMode,
    retriesText: spec.retries === undefined ? '' : String(spec.retries),
    retriesHint: t('http.retries.hint', { max: String(HTTP_RETRIES_MAX), default: String(HTTP_RETRIES_DEFAULT) }),
    setRetriesText,
    testFields,
    setTestValue,
    testing,
    testOutcome,
    runTest,
    canUseAsSample: !isAsync && !!testOutcome?.ok && testOutcome.body !== '',
    applyTestAsSample,
    methodOptions,
    bodyKindOptions,
    responseTypeOptions,
    bodyKind: body?.kind ?? 'none',
    bodyHasFields: body?.kind === 'json' || body?.kind === 'form',
    bodyValue: body?.kind === 'json-from' || body?.kind === 'text' ? body.value : undefined,
    bodyContentType: body?.kind === 'text' ? body.contentType : '',
    timeoutText: spec.timeoutSeconds === undefined ? '' : String(spec.timeoutSeconds),
    timeoutHint: t('http.timeout.hint', { min: String(HTTP_TIMEOUT_MIN_SECONDS), max: String(HTTP_TIMEOUT_MAX_SECONDS) }),
    hostWarning,
    connectionOptions,
    connectionWarning,
    setConnection,
    issues,
    warnings,
    fields,
    setMethod,
    setUrl,
    addField,
    updateField,
    removeField,
    setBodyKind,
    setBodyValue,
    setBodyContentType,
    setTimeoutText,
    setFailOnHttpError,
    setResponseType,
    setResponseSample,
  };
};
