import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useCaseStore } from '../../../../stores/useCaseStore';
import { useDeadlineStore } from '../../../../stores/useDeadlineStore';
import { useDeadlineLookup } from '../../../../stores/useDeadlineLookup';
import { useTenant } from '../../../../stores/useTenant';
import { useAuth } from '../../../../stores/useAuth';
import { usePush } from '../../../../stores/usePush';
import { usePushInteraction } from '../../../../stores/usePushInteraction';
import { useNotification } from '../../../../stores/useNotification';
import type { Push, DeadlinePriority, DeadlineStatus } from '../../../../domain/entities';
import type { DynamicSelectOption } from '../../../components/ui/DynamicSelect';

export interface CreateDeadlineFromPushFormData {
  type: string;
  priority: DeadlinePriority;
  dueDate: string;
  responsibleLawyerId: string;
  responsibleLawyerName: string;
}

export interface CreateDeadlineFromPushViewModel {
  push: Push;
  processNumber: string;
  caseExists: boolean;
  canCreate: boolean;
  formData: CreateDeadlineFromPushFormData;
  setFormData: (data: Partial<CreateDeadlineFromPushFormData>) => void;
  isSaving: boolean;
  handleCreate: () => Promise<void>;
  handleCancel: () => void;

  typeOptions: DynamicSelectOption[];
  typeDynamicOptions: DynamicSelectOption[];
  handleAddType: (name: string) => Promise<void>;
  handleDeleteType: (key: string) => Promise<void>;

  priorityOptions: { value: string; label: string; color: string }[];
  memberOptions: { value: string; label: string }[];
  getPriorityColor: (priority: string) => string;
  successColor: string;
  dangerColor: string;
}

export const useCreateDeadlineFromPushViewModel = (
  push: Push,
  onClose: () => void,
): CreateDeadlineFromPushViewModel => {
  const { cases } = useCaseStore();
  const { createDeadline } = useDeadlineStore();
  const { typeConfigs, addType, removeType } = useDeadlineLookup();
  const { members, currentTenant } = useTenant();
  const { user } = useAuth();
  const { updateStatus } = usePush();
  const { markAsRead } = usePushInteraction();
  const { notify } = useNotification();
  const theme = useTheme();

  const [formData, setFormDataState] = useState<CreateDeadlineFromPushFormData>(() => ({
    type: 'Prazo Processual',
    priority: 'Média',
    dueDate: '',
    responsibleLawyerId: user?.id ?? '',
    responsibleLawyerName: user?.displayName ?? '',
  }));
  const [isSaving, setIsSaving] = useState(false);

  const processNumber = push.processNumber ?? '';

  const caseExists = useMemo(() => {
    if (!processNumber) return false;
    return cases.some((c) => c.caseNumber === processNumber);
  }, [processNumber, cases]);

  const canCreate = !!processNumber && caseExists;

  const getPriorityColor = useCallback((priority: string): string => {
    const map: Record<DeadlinePriority, string> = {
      'Baixa':   theme.colors.success,
      'Média':   theme.colors.warning,
      'Alta':    theme.colors.secondary,
      'Crítica': theme.colors.danger,
    };
    return map[priority as DeadlinePriority] ?? theme.colors.textSecondary;
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

  const memberOptions = useMemo(() =>
    members.map((m) => ({ value: m.userId, label: m.displayName })),
    [members],
  );

  const setFormData = useCallback((data: Partial<CreateDeadlineFromPushFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const handleAddType = useCallback(async (name: string) => {
    await addType(name);
  }, [addType]);

  const handleDeleteType = useCallback(async (key: string) => {
    await removeType(key);
  }, [removeType]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleCreate = useCallback(async () => {
    if (!formData.type.trim()) {
      notify('Selecione o tipo do prazo.', 'error');
      return;
    }
    if (!formData.dueDate) {
      notify('Informe a data de vencimento.', 'error');
      return;
    }
    if (!canCreate) {
      notify('O processo não existe no tenant.', 'error');
      return;
    }
    if (!user?.id) {
      notify('Usuário não autenticado.', 'error');
      return;
    }

    const matchingCase = cases.find((c) => c.caseNumber === processNumber);
    if (!matchingCase) {
      notify('Processo não encontrado.', 'error');
      return;
    }

    const selectedMember = members.find((m) => m.userId === formData.responsibleLawyerId);

    setIsSaving(true);
    try {
      const dueDate = new Date(`${formData.dueDate}T23:59:00`);
      const status: DeadlineStatus = dueDate < new Date() ? 'Vencido' : 'Pendente';

      const payload = {
        type: formData.type,
        caseId: matchingCase.id,
        caseNumber: matchingCase.caseNumber,
        caseTitle: matchingCase.title,
        personName: '',
        dueDate,
        priority: formData.priority,
        status,
        responsibleLawyerId: formData.responsibleLawyerId || null,
        responsibleLawyerName: (selectedMember?.displayName ?? formData.responsibleLawyerName) || null,
        description: `Gerado a partir do push: ${push.subject}`,
        completedAt: null,
        completedBy: null,
        notes: null,
        pushIds: [push.id],
        createdBy: user.id,
      };

      await createDeadline(payload);

      // Atualizar status do push para 'reviewed' e marcar como lido
      try {
        if (currentTenant) {
          await updateStatus(push.id, 'reviewed');
        }
      } catch (pushError) {
        notify('Erro ao atualizar status do push.', 'error');
        console.error('Erro ao atualizar status do push:', pushError);
      }

      try {
        await markAsRead(push.id);
      } catch (readError) {
        notify('Erro ao marcar push como lido.', 'error');
        console.error('Erro ao marcar push como lido:', readError);
      }

      notify('Prazo criado com sucesso!', 'success');
      onClose();
    } catch (error) {
      console.error('Erro detalhado ao criar prazo:', error);
      notify(`Erro ao criar prazo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    formData,
    canCreate,
    processNumber,
    cases,
    members,
    push,
    user,
    currentTenant,
    createDeadline,
    updateStatus,
    markAsRead,
    notify,
    onClose,
  ]);

  return {
    push,
    processNumber,
    caseExists,
    canCreate,
    formData,
    setFormData,
    isSaving,
    handleCreate,
    handleCancel,
    typeOptions,
    typeDynamicOptions,
    handleAddType,
    handleDeleteType,
    priorityOptions,
    memberOptions,
    getPriorityColor,
    successColor: theme.colors.success,
    dangerColor: theme.colors.danger,
  };
};
