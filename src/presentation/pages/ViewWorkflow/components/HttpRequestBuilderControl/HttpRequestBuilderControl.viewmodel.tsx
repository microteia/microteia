import { useCallback, useEffect, useMemo, useState } from 'react';
import { useT, useLabel } from '../../../../shared/i18n/useT';
import { useTenant } from '../../../../../stores/useTenant';
import { useDI } from '../../../../../infrastructure/di/useDI';
import { makeGetHttpConnectionsUseCase } from '../../../../../domain/usecases/httpconnections/GetHttpConnectionsUseCase';
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
  HTTP_RESPONSE_TYPES,
  HTTP_TIMEOUT_DEFAULT_SECONDS,
  HTTP_TIMEOUT_MAX_SECONDS,
  HTTP_TIMEOUT_MIN_SECONDS,
  httpRequestSpecWarnings,
  isHttpHostAllowed,
  parseHttpUrl,
  validateHttpRequestSpec,
  type HttpBodyKind,
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

export interface HttpRequestBuilderControlViewModel {
  spec: HttpRequestSpec;
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
  const { httpConnectionRepository } = useDI();
  const getConnections = useMemo(() => makeGetHttpConnectionsUseCase(httpConnectionRepository), [httpConnectionRepository]);
  const [connections, setConnections] = useState<HttpConnection[] | null>(null);

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
