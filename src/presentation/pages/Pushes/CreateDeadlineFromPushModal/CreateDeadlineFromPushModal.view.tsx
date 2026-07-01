import React from 'react';
import { RiTimeLine, RiAlertLine, RiCheckLine, RiCloseLine } from 'react-icons/ri';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input, Label } from '../../../components/ui/Input';
import { SearchSelect } from '../../../components/ui/SearchSelect';
import { DynamicSelect } from '../../../components/ui/DynamicSelect';
import { S } from './CreateDeadlineFromPushModal.styles';
import { useCreateDeadlineFromPushViewModel } from './CreateDeadlineFromPushModal.viewmodel';
import type { Push } from '../../../../domain/entities';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';

export interface CreateDeadlineFromPushModalProps {
  push: Push;
  onClose: () => void;
}

export const CreateDeadlineFromPushModal: React.FC<CreateDeadlineFromPushModalProps> = ({ push, onClose }) => {
  const vm = useCreateDeadlineFromPushViewModel(push, onClose);

  const priorityOptions: SearchSelectOption[] = vm.priorityOptions.map((o) => ({ value: o.value, label: o.label, color: o.color }));
  const memberOptions: SearchSelectOption[] = vm.memberOptions.map((o) => ({ value: o.value, label: o.label }));

  return (
    <Modal title="Criar Prazo Processual" onClose={vm.handleCancel}>
      <S.FormGrid>
        <S.ProcessHeader>
          <RiTimeLine size={24} />
          <S.ProcessLabel>
            <S.ProcessNumber>
              {vm.processNumber || 'Número do processo não identificado'}
            </S.ProcessNumber>
            <S.ProcessStatus $exists={vm.caseExists}>
              {!vm.caseExists ? 'Processo inexistente' : ''}
            </S.ProcessStatus>
          </S.ProcessLabel>
          {vm.caseExists ? (
            <RiCheckLine size={24} color={vm.successColor} />
          ) : (
            <RiCloseLine size={24} color={vm.dangerColor} />
          )}
        </S.ProcessHeader>

        {!vm.canCreate && (
          <S.WarningBanner>
            <RiAlertLine size={20} />
            <div>
              Este processo não existe no sistema. Para criar um prazo, é necessário primeiro cadastrar o processo no sistema.
            </div>
          </S.WarningBanner>
        )}

        <S.FormGroup>
          <Label>Tipo *</Label>
          <DynamicSelect
            staticOptions={vm.typeOptions}
            dynamicOptions={vm.typeDynamicOptions}
            value={vm.formData.type}
            onChange={(val) => vm.setFormData({ type: val })}
            placeholder="Selecione o tipo..."
            onAdd={vm.handleAddType}
            onDelete={vm.handleDeleteType}
            deleteConfirmTitle="Excluir tipo de prazo"
          />
        </S.FormGroup>

        <S.FormGroup>
          <Label>Prioridade *</Label>
          <SearchSelect
            options={priorityOptions}
            value={vm.formData.priority}
            onChange={(val) => vm.setFormData({ priority: val as typeof vm.formData.priority })}
            placeholder="Selecione a prioridade..."
          />
        </S.FormGroup>

        <S.FormGroup>
          <Label>Data de Vencimento *</Label>
          <Input
            type="date"
            value={vm.formData.dueDate}
            onChange={(e) => vm.setFormData({ dueDate: e.target.value })}
          />
        </S.FormGroup>

        <S.FormGroup>
          <Label>Advogado Responsável</Label>
          <SearchSelect
            options={memberOptions}
            value={vm.formData.responsibleLawyerId}
            onChange={(val) => {
              const member = vm.memberOptions.find((m) => m.value === val);
              vm.setFormData({ responsibleLawyerId: val, responsibleLawyerName: member?.label ?? '' });
            }}
            placeholder="Selecione o responsável..."
          />
        </S.FormGroup>

        <S.Actions>
          <Button variant="ghost" onClick={vm.handleCancel} disabled={vm.isSaving}>
            Cancelar
          </Button>
          <Button onClick={() => void vm.handleCreate()} disabled={vm.isSaving || !vm.canCreate}>
            {vm.isSaving ? 'Criando...' : 'Criar'}
          </Button>
        </S.Actions>
      </S.FormGrid>
    </Modal>
  );
};
