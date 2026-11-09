import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useNotification } from '../../../../stores/useNotification';
import { makeGetHttpConnectionsUseCase } from '../../../../domain/usecases/httpconnections/GetHttpConnectionsUseCase';
import { makeSaveHttpConnectionUseCase } from '../../../../domain/usecases/httpconnections/SaveHttpConnectionUseCase';
import { makeDeleteHttpConnectionUseCase } from '../../../../domain/usecases/httpconnections/DeleteHttpConnectionUseCase';
import {
  HTTP_AUTH_SCHEMES,
  type HttpAuthScheme,
  type HttpConnection,
  type HttpConnectionData,
} from '../../../../domain/schema/httpConnection';
import { HTTP_HOST_PATTERN } from '../../../../domain/schema/httpRequestSpec';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';
import { useLabel, useT } from '../../../shared/i18n/useT';

export interface HttpConnectionForm {
  key: string;
  name: string;
  scheme: HttpAuthScheme;
  username: string;
  paramName: string;
  hosts: string[];
  secret: string;
}

export type HttpConnectionFormField = keyof HttpConnectionForm;

const EMPTY_FORM: HttpConnectionForm = {
  key: '',
  name: '',
  scheme: 'bearer',
  username: '',
  paramName: '',
  hosts: [],
  secret: '',
};

const HOST_RE = new RegExp(HTTP_HOST_PATTERN);

export interface IntegrationsTabViewModel {
  loading: boolean;
  connections: HttpConnection[];
  schemeOptions: SearchSelectOption[];
  /** O rótulo do esquema de cada credencial da lista, já traduzido. */
  schemeLabel: (scheme: HttpAuthScheme) => string;
  editing: HttpConnection | null;
  modalOpen: boolean;
  form: HttpConnectionForm;
  /** O erro de cada campo, já traduzido. */
  fieldErrors: Partial<Record<HttpConnectionFormField, string>>;
  saving: boolean;
  needsUsername: boolean;
  needsParamName: boolean;
  paramNameLabel: string;
  secretRequired: boolean;
  isHostValid: (host: string) => boolean;
  normalizeHost: (host: string) => string;
  pendingDelete: HttpConnection | null;
  openNew: () => void;
  openEdit: (connection: HttpConnection) => void;
  closeModal: () => void;
  setField: (field: Exclude<HttpConnectionFormField, 'hosts'>, value: string) => void;
  setHosts: (hosts: string[]) => void;
  save: () => Promise<void>;
  askDelete: (connection: HttpConnection) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
}

const formOf = (connection: HttpConnection): HttpConnectionForm => ({
  key: connection.key,
  name: connection.name,
  scheme: connection.scheme,
  username: connection.username ?? '',
  paramName: connection.paramName ?? '',
  hosts: connection.hosts,
  secret: '',
});

export const useIntegrationsTabViewModel = (): IntegrationsTabViewModel => {
  const t = useT('core.automation');
  const label = useLabel();
  const { currentTenant } = useTenant();
  const { httpConnectionRepository } = useDI();
  const { notify } = useNotification();

  const getAll = useMemo(() => makeGetHttpConnectionsUseCase(httpConnectionRepository), [httpConnectionRepository]);
  const saveOne = useMemo(() => makeSaveHttpConnectionUseCase(httpConnectionRepository), [httpConnectionRepository]);
  const deleteOne = useMemo(() => makeDeleteHttpConnectionUseCase(httpConnectionRepository), [httpConnectionRepository]);

  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<HttpConnection[]>([]);
  const [editing, setEditing] = useState<HttpConnection | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<HttpConnectionForm>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<HttpConnectionFormField, string>>>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<HttpConnection | null>(null);

  useEffect(() => {
    if (!currentTenant) return;
    let alive = true;
    getAll.execute(currentTenant.id)
      .then((list) => { if (alive) setConnections(list); })
      .catch(() => notify(t('http-connection.load-failed'), 'error'))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [currentTenant, getAll, notify, t]);

  const schemeOptions = useMemo<SearchSelectOption[]>(
    () => HTTP_AUTH_SCHEMES.map((scheme) => ({ value: scheme, label: t(`http-connection.scheme.${scheme}`) })),
    [t],
  );
  const schemeLabel = useCallback((scheme: HttpAuthScheme) => t(`http-connection.scheme.${scheme}`), [t]);

  const openNew = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((connection: HttpConnection) => {
    setEditing(connection);
    setForm(formOf(connection));
    setFieldErrors({});
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const setField = useCallback((field: Exclude<HttpConnectionFormField, 'hosts'>, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const setHosts = useCallback((hosts: string[]) => {
    setForm((current) => ({ ...current, hosts }));
    setFieldErrors((current) => ({ ...current, hosts: undefined }));
  }, []);

  const save = useCallback(async () => {
    if (!currentTenant) return;
    setSaving(true);
    const data: HttpConnectionData = {
      key: form.key,
      name: form.name,
      scheme: form.scheme,
      username: form.username,
      paramName: form.paramName,
      hosts: form.hosts,
    };
    try {
      const result = await saveOne.execute({
        tenantId: currentTenant.id,
        ...(editing ? { id: editing.id } : {}),
        data,
        secret: form.secret,
        existing: connections,
      });
      if (!result.ok) {
        setFieldErrors(Object.fromEntries(result.issues.map((issue) => [issue.field, label(issue.error, issue.errorParams)])));
        return;
      }
      setConnections((current) => [...current.filter((one) => one.id !== result.connection.id), result.connection]
        .sort((a, b) => a.key.localeCompare(b.key)));
      setModalOpen(false);
      notify(t('http-connection.saved'), 'success');
    } catch {
      notify(t('http-connection.save-failed'), 'error');
    } finally {
      setSaving(false);
    }
  }, [currentTenant, form, saveOne, editing, connections, label, notify, t]);

  const askDelete = useCallback((connection: HttpConnection) => setPendingDelete(connection), []);
  const cancelDelete = useCallback(() => setPendingDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!currentTenant || !pendingDelete) return;
    try {
      await deleteOne.execute(currentTenant.id, pendingDelete.id);
      setConnections((current) => current.filter((one) => one.id !== pendingDelete.id));
    } catch {
      notify(t('http-connection.delete-failed'), 'error');
    } finally {
      setPendingDelete(null);
    }
  }, [currentTenant, pendingDelete, deleteOne, notify, t]);

  const isHostValid = useCallback((host: string) => HOST_RE.test(host), []);
  const normalizeHost = useCallback((host: string) => host.trim().toLowerCase(), []);

  return {
    loading,
    connections,
    schemeOptions,
    schemeLabel,
    editing,
    modalOpen,
    form,
    fieldErrors,
    saving,
    needsUsername: form.scheme === 'basic',
    needsParamName: form.scheme === 'header' || form.scheme === 'query',
    paramNameLabel: t(form.scheme === 'query' ? 'http-connection.param.query' : 'http-connection.param.header'),
    secretRequired: !editing?.hasSecret,
    isHostValid,
    normalizeHost,
    pendingDelete,
    openNew,
    openEdit,
    closeModal,
    setField,
    setHosts,
    save,
    askDelete,
    cancelDelete,
    confirmDelete,
  };
};
