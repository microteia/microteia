import React from 'react';
import { RiTimeLine } from 'react-icons/ri';
import { S } from './ViewDeadline.styles';
import { useViewDeadlineViewModel } from './ViewDeadline.viewmodel';
import { Button } from '../../components/ui/Button';
import { Input, Label, Textarea } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';

export const ViewDeadlineView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewDeadlineViewModel(tabKey);

  const caseOptions: SearchSelectOption[] = vm.caseOptions.map((o) => ({ value: o.value, label: o.label }));
  const memberOptions: SearchSelectOption[] = vm.memberOptions.map((o) => ({ value: o.value, label: o.label }));
  const priorityOptions: SearchSelectOption[] = vm.priorityOptions.map((o) => ({ value: o.value, label: o.label, color: o.color }));

  const priorityColor = vm.getPriorityColor(vm.formData.priority);

  const statusColors: Record<string, string> = {
    'Pendente': '#6b7280',
    'Concluído': '#22c55e',
    'Vencido': '#ef4444',
    'Cancelado': '#9ca3af',
  };

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.Avatar $color={priorityColor}>
            <RiTimeLine size={22} />
          </S.Avatar>
          <S.HeaderInfo>
            <S.Title>{vm.isNew ? 'Novo Prazo' : (vm.formData.type || 'Prazo')}</S.Title>
            {!vm.isNew && vm.deadline && (
              <S.SubTitle>
                {vm.deadline.caseNumber}
                {vm.deadline.caseNumber && vm.deadline.caseTitle ? ' — ' : ''}
                {vm.deadline.caseTitle}
              </S.SubTitle>
            )}
          </S.HeaderInfo>
        </S.HeaderLeft>

        <S.HeaderActions>
          <S.StatusChip $color={statusColors[vm.derivedStatus] ?? '#6b7280'}>
            {vm.derivedStatus}
          </S.StatusChip>
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        <S.FormGrid>
          <S.SectionTitle>Identificação</S.SectionTitle>

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
            <Label>Prioridade</Label>
            <SearchSelect
              options={priorityOptions}
              value={vm.formData.priority}
              onChange={(val) => vm.setFormData({ priority: val as typeof vm.formData.priority })}
              placeholder="Selecione a prioridade..."
            />
          </S.FormGroup>

          <S.FormGroup $fullWidth>
            <Label>Processo *</Label>
            <SearchSelect
              options={caseOptions}
              value={vm.formData.caseId}
              onChange={(val) => vm.setFormData({ caseId: val })}
              placeholder="Selecione o processo..."
            />
          </S.FormGroup>

          <S.SectionTitle>Datas</S.SectionTitle>

          <S.FormGroup>
            <Label>Data de Vencimento *</Label>
            <Input
              type="date"
              value={vm.formData.dueDate}
              onChange={(e) => vm.setFormData({ dueDate: e.target.value })}
            />
          </S.FormGroup>

          <S.FormGroup>
            <Label>Data de Conclusão</Label>
            <Input
              type="date"
              value={vm.formData.completedAt}
              onChange={(e) => vm.setFormData({ completedAt: e.target.value })}
            />
          </S.FormGroup>

          <S.SectionTitle>Responsável e Detalhes</S.SectionTitle>

          <S.FormGroup $fullWidth>
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

          <S.FormGroup $fullWidth>
            <Label>Descrição</Label>
            <Textarea
              value={vm.formData.description}
              onChange={(e) => vm.setFormData({ description: e.target.value })}
              placeholder="Detalhes sobre o prazo, documentos necessários, etc."
            />
          </S.FormGroup>

          <S.FormActions>
            <Button onClick={() => void vm.handleSave()} disabled={vm.isSaving}>
              {vm.isSaving ? 'Salvando...' : vm.isNew ? 'Cadastrar Prazo' : 'Salvar Alterações'}
            </Button>
          </S.FormActions>
        </S.FormGrid>
      </S.Content>
    </S.Page>
  );
};
