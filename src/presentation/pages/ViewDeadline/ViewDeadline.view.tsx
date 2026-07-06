import React from 'react';
import { RiTimeLine, RiSaveLine } from 'react-icons/ri';
import { S } from './ViewDeadline.styles';
import { useViewDeadlineViewModel } from './ViewDeadline.viewmodel';
import { Label, Textarea } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { DateInput } from '../../components/ui/DateInput';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';

export const ViewDeadlineView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewDeadlineViewModel(tabKey);

  const caseOptions: SearchSelectOption[] = vm.caseOptions.map((o) => ({ value: o.value, label: o.label }));
  const memberOptions: SearchSelectOption[] = vm.memberOptions.map((o) => ({ value: o.value, label: o.label }));
  const priorityOptions: SearchSelectOption[] = vm.priorityOptions.map((o) => ({ value: o.value, label: o.label, color: o.color }));

  const priorityColor = vm.getPriorityColor(vm.formData.priority);

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
              <S.SubTitle>{vm.caseDisplay}</S.SubTitle>
            )}
          </S.HeaderInfo>
        </S.HeaderLeft>

        <S.HeaderActions>
          <S.StatusChip $color={vm.getDeadlineStatusColor(vm.derivedStatus)}>
            {vm.derivedStatus}
          </S.StatusChip>
          <S.SaveBtn
            onClick={() => void vm.handleSave()}
            disabled={vm.isSaving}
            title={vm.isSaving ? 'Salvando...' : vm.isNew ? 'Cadastrar Prazo' : 'Salvar Alterações'}
          >
            <RiSaveLine size={14} />
          </S.SaveBtn>
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
              onDelete={vm.isAdmin ? vm.handleDeleteType : undefined}
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
            <DateInput
              value={vm.formData.dueDate}
              onChange={(val) => vm.setFormData({ dueDate: val })}
            />
          </S.FormGroup>

          <S.FormGroup>
            <Label>Data de Conclusão</Label>
            <DateInput
              value={vm.formData.completedAt}
              onChange={(val) => vm.setFormData({ completedAt: val })}
            />
          </S.FormGroup>

          <S.SectionTitle>Responsável e Detalhes</S.SectionTitle>

          <S.FormGroup $fullWidth>
            <Label>Advogado Responsável</Label>
            <SearchSelect
              options={memberOptions}
              value={vm.formData.responsibleLawyerId}
              onChange={(val) => vm.setFormData({ responsibleLawyerId: val })}
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

          {vm.customFields.length > 0 && (
            <>
              <S.SectionTitle>Campos adicionais</S.SectionTitle>
              <S.FormGroup $fullWidth>
                <CustomFieldsSection
                  screenKey="deadlines"
                  fields={vm.customFields}
                  values={vm.customValues}
                  onChange={vm.setCustomValue}
                />
              </S.FormGroup>
            </>
          )}
        </S.FormGrid>
      </S.Content>
    </S.Page>
  );
};
