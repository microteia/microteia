import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import { useDeadlineStore } from '../../../stores/useDeadlineStore';
import { useDeadlineLookup } from '../../../stores/useDeadlineLookup';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import type { Deadline, DeadlinePriority, DeadlineStatus } from '../../../domain/entities';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';

export interface DeadlineFormData {
  type: string;
  caseId: string;
  dueDate: string;
  completedAt: string;
  priority: DeadlinePriority;
  responsibleLawyerId: string;
  responsibleLawyerName: string;
  description: string;
}

const buildForm = (d: Deadline | null, userId: string, displayName: string): DeadlineFormData => ({
  type: d?.type ?? 'Outro',
  caseId: d?.caseId ?? '',
  dueDate: d?.dueDate ? d.dueDate.toISOString().slice(0, 10) : '',
  completedAt: d?.completedAt ? d.completedAt.toISOString().slice(0, 10) : '',
  priority: d?.priority ?? 'Média',
  responsibleLawyerId: d?.responsibleLawyerId ?? userId,
  responsibleLawyerName: d?.responsibleLawyerName ?? displayName,
  description: d?.description ?? '',
});

export interface ViewDeadlineViewModel {
  isNew: boolean;
  deadline: Deadline | null;
  formData: DeadlineFormData;
  setFormData: (data: Partial<DeadlineFormData>) => void;
  isSaving: boolean;
  handleSave: () => Promise<void>;

  typeOptions: DynamicSelectOption[];
  typeDynamicOptions: DynamicSelectOption[];
  handleAddType: (name: string) => Promise<void>;
  handleDeleteType: (key: string) => Promise<void>;

  priorityOptions: { value: string; label: string; color: string }[];
  caseOptions: { value: string; label: string }[];
  memberOptions: { value: string; label: string }[];

  derivedStatus: DeadlineStatus;
  getPriorityColor: (priority: string) => string;
  getDeadlineStatusColor: (status: DeadlineStatus) => string;
}

export const useViewDeadlineViewModel = (tabKey: string): ViewDeadlineViewModel => {
  const isNew = tabKey === 'new-deadline';
  const deadlineId = isNew ? '' : tabKey.replace('view-deadline:', '');

  const { deadlines, createDeadline, updateDeadline } = useDeadlineStore();
  const { typeConfigs, addType, removeType } = useDeadlineLookup();
  const { cases } = useCaseStore();
  const { user } = useAuth();
  const { members } = useTenant();
  const { setTabTitle, closeTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const theme = useTheme();

  const deadline = useMemo(
    () => (isNew ? null : (deadlines.find((d) => d.id === deadlineId) ?? null)),
    [isNew, deadlines, deadlineId],
  );

  const [formData, setFormDataState] = useState<DeadlineFormData>(() =>
    buildForm(deadline, user?.id ?? '', user?.displayName ?? ''),
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-initialise form when deadline or user loads from store
    setFormDataState(buildForm(deadline, user?.id ?? '', user?.displayName ?? ''));
  }, [deadline, user]);

  useEffect(() => {
    if (!isNew && deadline) {
      setTabTitle(tabKey, deadline.type || 'Prazo');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when deadline type changes
  }, [deadline?.type]);

  const getPriorityColor = useCallback((priority: string): string => {
    const map: Record<DeadlinePriority, string> = {
      'Baixa':   theme.colors.success,
      'Média':   theme.colors.warning,
      'Alta':    theme.colors.secondary,
      'Crítica': theme.colors.danger,
    };
    return map[priority as DeadlinePriority] ?? theme.colors.textSecondary;
  }, [theme]);

  const getDeadlineStatusColor = useCallback((status: DeadlineStatus): string => {
    const map: Record<DeadlineStatus, string> = {
      'Pendente':  theme.colors.deadlineStatusPending,
      'Concluído': theme.colors.deadlineStatusCompleted,
      'Vencido':   theme.colors.deadlineStatusOverdue,
      'Cancelado': theme.colors.deadlineStatusCanceled,
    };
    return map[status] ?? theme.colors.deadlineStatusPending;
  }, [theme]);

  const typeOptions = useMemo<DynamicSelectOption[]>(() =>
    typeConfigs.filter((t) => t.isStatic).map((t) => ({ value: t.key, label: t.label })),
    [typeConfigs],
  );

  const typeDynamicOptions = useMemo<DynamicSelectOption[]>(() =>
    typeConfigs.filter((t) => !t.isStatic).map((t) => ({ value: t.key, label: t.label, isDynamic: true })),
    [typeConfigs],
  );

  const priorityOptions = useMemo(() =>
    (['Baixa', 'Média', 'Alta', 'Crítica'] as DeadlinePriority[]).map((p) => ({
      value: p, label: p, color: getPriorityColor(p),
    })),
    [getPriorityColor],
  );

  const caseOptions = useMemo(() =>
    cases.map((c) => ({ value: c.id, label: c.caseNumber ? `${c.caseNumber} — ${c.title}` : c.title })),
    [cases],
  );

  const memberOptions = useMemo(() =>
    members.map((m) => ({ value: m.userId, label: m.displayName })),
    [members],
  );

  const derivedStatus = useMemo<DeadlineStatus>(() => {
    if (formData.completedAt) return 'Concluído';
    if (formData.dueDate && new Date(`${formData.dueDate}T23:59:00`) < new Date()) return 'Vencido';
    return 'Pendente';
  }, [formData.completedAt, formData.dueDate]);

  const setFormData = useCallback((data: Partial<DeadlineFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const handleAddType = useCallback(async (name: string) => {
    await addType(name);
  }, [addType]);

  const handleDeleteType = useCallback(async (key: string) => {
    await removeType(key);
  }, [removeType]);

  const handleSave = useCallback(async () => {
    if (!formData.type.trim()) { notify('Selecione o tipo do prazo.', 'error'); return; }
    if (!formData.caseId) { notify('Selecione um processo.', 'error'); return; }
    if (!formData.dueDate) { notify('Informe a data de vencimento.', 'error'); return; }

    const selectedCase = cases.find((c) => c.id === formData.caseId);
    const selectedMember = members.find((m) => m.userId === formData.responsibleLawyerId);

    setIsSaving(true);
    try {
      const dueDate = new Date(`${formData.dueDate}T23:59:00`);
      const completedAt = formData.completedAt ? new Date(`${formData.completedAt}T12:00:00`) : null;
      const status: DeadlineStatus = completedAt ? 'Concluído' : (dueDate < new Date() ? 'Vencido' : 'Pendente');

      const payload = {
        type: formData.type,
        caseId: formData.caseId,
        caseNumber: selectedCase?.caseNumber ?? '',
        caseTitle: selectedCase?.title ?? '',
        personName: '',
        dueDate,
        priority: formData.priority,
        status,
        responsibleLawyerId: formData.responsibleLawyerId || null,
        responsibleLawyerName: (selectedMember?.displayName ?? formData.responsibleLawyerName) || null,
        description: formData.description || null,
        completedAt,
        completedBy: completedAt ? (user?.id ?? null) : null,
        notes: null,
      };

      if (isNew) {
        await createDeadline({ ...payload, createdBy: user?.id ?? '' });
        notify('Prazo cadastrado com sucesso!', 'success');
        closeTab(tabKey, activePanelId ?? '');
      } else {
        await updateDeadline(deadlineId, payload);
        notify('Prazo atualizado com sucesso!', 'success');
      }
    } catch {
      notify('Erro ao salvar prazo.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [formData, isNew, deadlineId, cases, members, createDeadline, updateDeadline, closeTab, notify, user, tabKey, activePanelId]);

  return {
    isNew,
    deadline,
    formData,
    setFormData,
    isSaving,
    handleSave,
    typeOptions,
    typeDynamicOptions,
    handleAddType,
    handleDeleteType,
    priorityOptions,
    caseOptions,
    memberOptions,
    derivedStatus,
    getPriorityColor,
    getDeadlineStatusColor,
  };
};
