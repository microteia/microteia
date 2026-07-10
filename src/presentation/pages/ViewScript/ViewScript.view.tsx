import React from 'react';
import { RiCodeBoxLine, RiSave3Line, RiDeleteBinLine, RiAddLine, RiArrowRightSLine } from 'react-icons/ri';
import { S } from './ViewScript.styles';
import { useViewScriptViewModel } from './ViewScript.viewmodel';
import { Input, Label, Textarea } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { WorkflowParametersEditor } from '../ViewWorkflow/components/WorkflowParametersEditor';
import type { ScriptOutputParam } from '../../../domain/entities/Script';

export const ViewScriptView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewScriptViewModel(tabKey);

  return (
    <S.Page>
      <S.Header>
        <S.HeaderTitle>
          <RiCodeBoxLine size={20} />
          {vm.isNew ? 'Novo Script' : (vm.formData.name || 'Script')}
        </S.HeaderTitle>
        <S.HeaderActions>
          <S.SaveBtn
            onClick={() => void vm.handleSave()}
            disabled={!vm.canSave}
            title={vm.isSaving ? 'Salvando...' : 'Salvar'}
          >
            <RiSave3Line size={14} />
          </S.SaveBtn>
          {!vm.isNew && (
            <S.DeleteBtn onClick={vm.handleDelete} title="Excluir script">
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('general')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('general')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>Geral</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('general') && (
            <S.SectionBody>
              <S.Field>
                <Label>Nome</Label>
                <Input
                  value={vm.formData.name}
                  onChange={(e) => vm.setFormData({ name: e.target.value })}
                  placeholder="ex: Calcular prazo processual"
                />
              </S.Field>
              <S.Field>
                <Label>Descrição</Label>
                <Textarea
                  value={vm.formData.description}
                  onChange={(e) => vm.setFormData({ description: e.target.value })}
                  placeholder="O que este script faz..."
                  rows={2}
                />
              </S.Field>
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('inputs')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('inputs')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>Parâmetros de entrada</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('inputs') && (
            <S.SectionBody>
              <S.SectionHint>
                Ficam disponíveis no código pelo objeto <code>input</code> (ex: <code>input.orderId</code>).
              </S.SectionHint>
              <WorkflowParametersEditor
                parameters={vm.formData.inputParams}
                errors={vm.inputParamErrors}
                typeOptions={vm.typeOptions}
                entityOptions={vm.entityOptions}
                onAdd={vm.addInputParam}
                onUpdate={vm.updateInputParam}
                onRemove={vm.removeInputParam}
              />
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('code')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('code')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>Código</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('code') && (
            <S.SectionBody>
              <InfoBanner
                variant="info"
                message="O código roda em um ambiente isolado e seguro. Sem acesso à internet, ao banco de dados ou a bibliotecas externas. Use o objeto input e as funções fn.*. Retorne um objeto com os parâmetros de saída."
              />
              <S.CodeArea
                value={vm.formData.sourceTs}
                onChange={(e) => vm.setFormData({ sourceTs: e.target.value })}
                spellCheck={false}
              />
            </S.SectionBody>
          )}
        </S.Section>

        <S.Section>
          <S.SectionHeader type="button" onClick={() => vm.toggleSection('outputs')}>
            <S.SectionChevron $open={!vm.isSectionCollapsed('outputs')}><RiArrowRightSLine size={18} /></S.SectionChevron>
            <S.SectionTitle>Parâmetros de saída</S.SectionTitle>
          </S.SectionHeader>
          {!vm.isSectionCollapsed('outputs') && (
            <S.SectionBody>
              <S.SectionHint>
                Declaram o que o script retorna, para facilitar o uso nos Steps seguintes.
              </S.SectionHint>
              <S.OutputRows>
                {vm.formData.outputParams.length === 0 && (
                  <S.Empty>Nenhum parâmetro de saída declarado.</S.Empty>
                )}
                {vm.formData.outputParams.map((param, index) => (
                  <S.OutputRow key={index}>
                    <S.OutputGrid>
                      <S.Cell>
                        <Label>Descrição</Label>
                        <Input
                          value={param.label}
                          onChange={(e) => vm.updateOutputParam(index, { label: e.target.value })}
                          placeholder="ex: Prazo em dias"
                        />
                      </S.Cell>
                      <S.Cell>
                        <Label>Nome do parâmetro</Label>
                        <Input
                          value={param.key}
                          onChange={(e) => vm.updateOutputParam(index, { key: e.target.value })}
                          placeholder="ex: prazoDias"
                        />
                      </S.Cell>
                      <S.Cell>
                        <Label>Tipo</Label>
                        <SearchSelect
                          options={vm.typeOptions}
                          value={param.type}
                          onChange={(type) =>
                            vm.updateOutputParam(index, { type: type as ScriptOutputParam['type'], entityType: undefined })
                          }
                          placeholder="Tipo..."
                        />
                      </S.Cell>
                      <S.RemoveBtn type="button" onClick={() => vm.removeOutputParam(index)} title="Remover parâmetro">
                        <RiDeleteBinLine size={14} />
                      </S.RemoveBtn>
                    </S.OutputGrid>
                    {param.type === 'EntityReference' && (
                      <S.OutputSubLine>
                        <S.Cell>
                          <Label>Entidade referenciada</Label>
                          <SearchSelect
                            options={vm.entityOptions}
                            value={param.entityType ?? ''}
                            onChange={(entityType) => vm.updateOutputParam(index, { entityType })}
                            placeholder="Selecione a entidade..."
                          />
                        </S.Cell>
                      </S.OutputSubLine>
                    )}
                    {vm.outputParamErrors[index] && <S.Error>{vm.outputParamErrors[index]}</S.Error>}
                  </S.OutputRow>
                ))}
                <S.AddBtn type="button" onClick={vm.addOutputParam}>
                  <RiAddLine size={14} /> Adicionar parâmetro de saída
                </S.AddBtn>
              </S.OutputRows>
            </S.SectionBody>
          )}
        </S.Section>
      </S.Content>

      <ConfirmModal
        isOpen={!!vm.scriptToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title="Excluir Script"
        message={`Tem certeza que deseja excluir o script "${vm.scriptToDelete?.name}"? Steps que o utilizam deixarão de funcionar.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
