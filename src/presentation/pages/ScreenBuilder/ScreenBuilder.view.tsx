import React from 'react';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiEyeOffLine,
  RiPencilLine,
} from 'react-icons/ri';
import { S } from './ScreenBuilder.styles';
import { useScreenBuilderViewModel } from './ScreenBuilder.viewmodel';
import type { ScreenBuilderViewModel } from './ScreenBuilder.viewmodel';
import { Button } from '../../components/ui/Button';
import { Input, InputGroup, Label } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ColorSwatchPicker } from '../../components/ui/ColorSwatchPicker';
import { ColorDot } from '../../components/ui/Badge';
import { getScreenIcon } from '../../shared/screenIcons';
import type { FieldDefinition } from '../../../domain/entities';

const FieldRows: React.FC<{ vm: ScreenBuilderViewModel; screenKey: string; fields: FieldDefinition[] }> = ({ vm, screenKey, fields }) => (
  <S.FieldList>
    {fields.length === 0 && <S.EmptyHint>Nenhum campo adicional definido.</S.EmptyHint>}
    {fields.map((field, index) => (
      <S.FieldRow key={field.key}>
        <S.FieldInfo>
          <S.FieldName>
            {field.label}
            {field.required ? ' *' : ''}
            {vm.isTitleField(screenKey, field.key) ? ' (título)' : ''}
          </S.FieldName>
          <S.FieldMeta>
            {vm.fieldTypeLabel(field.type)}
            {field.section ? ` · ${field.section}` : ''}
          </S.FieldMeta>
        </S.FieldInfo>
        <S.CardActions>
          <S.IconButton
            title="Mover para cima"
            disabled={index === 0}
            onClick={() => void vm.moveField(screenKey, field.key, -1)}
          >
            <RiArrowUpSLine size={18} />
          </S.IconButton>
          <S.IconButton
            title="Mover para baixo"
            disabled={index === fields.length - 1}
            onClick={() => void vm.moveField(screenKey, field.key, 1)}
          >
            <RiArrowDownSLine size={18} />
          </S.IconButton>
          <S.IconButton title="Editar campo" onClick={() => vm.openEditField(screenKey, field.key)}>
            <RiPencilLine size={16} />
          </S.IconButton>
          <S.DangerIconButton
            title="Excluir campo"
            disabled={vm.isTitleField(screenKey, field.key)}
            onClick={() => vm.requestDeleteField(screenKey, field.key)}
          >
            <RiDeleteBinLine size={16} />
          </S.DangerIconButton>
        </S.CardActions>
      </S.FieldRow>
    ))}
  </S.FieldList>
);

export const ScreenBuilderView: React.FC = () => {
  const vm = useScreenBuilderViewModel();

  if (!vm.isAdmin) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>Personalização</S.Title>
        </S.Header>
        <S.BannerWrapper>
          <InfoBanner
            variant="info"
            message="Somente administradores do escritório podem configurar telas e campos personalizados."
          />
        </S.BannerWrapper>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.Title>Personalização</S.Title>
        <Button onClick={vm.openCreateScreen}>
          <RiAddLine size={18} />
          Nova Tela
        </Button>
      </S.Header>

      <S.Content>
        <S.Section>
          <S.SectionTitle>Telas personalizadas</S.SectionTitle>
          <S.SectionHint>
            Crie telas próprias do escritório, com campos, listagem, filtros e busca no atalho ⌘K.
          </S.SectionHint>
          {vm.dynamicDefinitions.length === 0 && (
            <S.EmptyHint>Nenhuma tela personalizada criada ainda.</S.EmptyHint>
          )}
          {vm.dynamicDefinitions.map((def, index) => (
            <S.ScreenCard key={def.id} $disabled={!def.enabled}>
              <S.ScreenCardHeader>
                <S.ScreenIcon>{getScreenIcon(def.icon)}</S.ScreenIcon>
                <S.ScreenInfo>
                  <S.ScreenName>
                    {def.titlePlural}
                    {!def.enabled && <S.DisabledBadge>Desativada</S.DisabledBadge>}
                  </S.ScreenName>
                  <S.ScreenMeta>
                    {(vm.fieldsByScreen[def.id] ?? []).length} campo(s)
                    {def.hasNotes ? ' · Anotações' : ''}
                    {def.hasDocuments ? ' · Documentos' : ''}
                  </S.ScreenMeta>
                </S.ScreenInfo>
                <S.CardActions>
                  <S.IconButton
                    title="Mover para cima"
                    disabled={index === 0}
                    onClick={() => void vm.moveScreen(def.id, -1)}
                  >
                    <RiArrowUpSLine size={18} />
                  </S.IconButton>
                  <S.IconButton
                    title="Mover para baixo"
                    disabled={index === vm.dynamicDefinitions.length - 1}
                    onClick={() => void vm.moveScreen(def.id, 1)}
                  >
                    <RiArrowDownSLine size={18} />
                  </S.IconButton>
                  <S.IconButton
                    title={def.enabled ? 'Desativar tela' : 'Ativar tela'}
                    onClick={() => void vm.toggleScreenEnabled(def.id)}
                  >
                    {def.enabled ? <RiEyeLine size={16} /> : <RiEyeOffLine size={16} />}
                  </S.IconButton>
                  <S.IconButton title="Editar tela" onClick={() => vm.openEditScreen(def.id)}>
                    <RiPencilLine size={16} />
                  </S.IconButton>
                  <S.DangerIconButton title="Excluir tela" onClick={() => vm.requestDeleteScreen(def.id)}>
                    <RiDeleteBinLine size={16} />
                  </S.DangerIconButton>
                </S.CardActions>
              </S.ScreenCardHeader>
              <FieldRows vm={vm} screenKey={def.id} fields={vm.fieldsByScreen[def.id] ?? []} />
              <S.CardFooter>
                <Button variant="secondary" size="sm" onClick={() => vm.openCreateField(def.id)}>
                  <RiAddLine size={16} />
                  Adicionar campo
                </Button>
              </S.CardFooter>
            </S.ScreenCard>
          ))}
        </S.Section>

        <S.Section>
          <S.SectionTitle>Campos adicionais das telas padrão</S.SectionTitle>
          <S.SectionHint>
            Adicione campos personalizados às telas já existentes do sistema. Eles aparecem na seção
            "Campos adicionais" do formulário de cada tela.
          </S.SectionHint>
          {vm.builtinRows.map((row) => (
            <S.ScreenCard key={row.key}>
              <S.ScreenCardHeader>
                <S.ScreenIcon>{getScreenIcon('apps')}</S.ScreenIcon>
                <S.ScreenInfo>
                  <S.ScreenName>{row.label}</S.ScreenName>
                  <S.ScreenMeta>{row.fields.length} campo(s) adicional(is)</S.ScreenMeta>
                </S.ScreenInfo>
              </S.ScreenCardHeader>
              <FieldRows vm={vm} screenKey={row.key} fields={row.fields} />
              <S.CardFooter>
                <Button variant="secondary" size="sm" onClick={() => vm.openCreateField(row.key)}>
                  <RiAddLine size={16} />
                  Adicionar campo
                </Button>
              </S.CardFooter>
            </S.ScreenCard>
          ))}
        </S.Section>
      </S.Content>

      {vm.screenModalOpen && (
        <Modal title={vm.screenModalIsEdit ? 'Editar Tela' : 'Nova Tela'} onClose={vm.closeScreenModal}>
          <S.ModalForm>
            <InputGroup>
              <Label>Título (singular) *</Label>
              <Input
                value={vm.screenForm.titleSingular}
                onChange={(e) => vm.updateScreenForm({ titleSingular: e.target.value })}
                placeholder="Ex: Consulta"
              />
            </InputGroup>
            <InputGroup>
              <Label>Título (plural) *</Label>
              <Input
                value={vm.screenForm.titlePlural}
                onChange={(e) => vm.updateScreenForm({ titlePlural: e.target.value })}
                placeholder="Ex: Consultas"
              />
            </InputGroup>
            <InputGroup>
              <Label>Ícone</Label>
              <S.IconGrid>
                {vm.iconKeys.map((key) => (
                  <S.IconOption
                    key={key}
                    type="button"
                    $active={vm.screenForm.icon === key}
                    onClick={() => vm.updateScreenForm({ icon: key })}
                  >
                    {getScreenIcon(key, 18)}
                  </S.IconOption>
                ))}
              </S.IconGrid>
            </InputGroup>
            {vm.screenModalIsEdit && vm.titleFieldOptions.length > 0 && (
              <InputGroup>
                <Label>Campo usado como título do registro</Label>
                <SearchSelect
                  options={vm.titleFieldOptions}
                  value={vm.screenForm.titleFieldKey}
                  onChange={(value) => vm.updateScreenForm({ titleFieldKey: value })}
                  placeholder="Escolha o campo título"
                />
              </InputGroup>
            )}
            <S.CheckboxRow>
              <input
                type="checkbox"
                checked={vm.screenForm.hasNotes}
                onChange={(e) => vm.updateScreenForm({ hasNotes: e.target.checked })}
              />
              Habilitar aba de Anotações
            </S.CheckboxRow>
            <S.CheckboxRow>
              <input
                type="checkbox"
                checked={vm.screenForm.hasDocuments}
                onChange={(e) => vm.updateScreenForm({ hasDocuments: e.target.checked })}
              />
              Habilitar aba de Documentos
            </S.CheckboxRow>
            {vm.screenModalIsEdit && (
              <S.CheckboxRow>
                <input
                  type="checkbox"
                  checked={vm.screenForm.enabled}
                  onChange={(e) => vm.updateScreenForm({ enabled: e.target.checked })}
                />
                Tela ativa (visível no menu lateral)
              </S.CheckboxRow>
            )}
            <S.ModalActions>
              <Button variant="secondary" onClick={vm.closeScreenModal}>Cancelar</Button>
              <Button onClick={() => void vm.handleSaveScreen()} disabled={vm.savingScreen} $isLoading={vm.savingScreen}>
                Salvar
              </Button>
            </S.ModalActions>
          </S.ModalForm>
        </Modal>
      )}

      {vm.fieldModalOpen && (
        <Modal title={vm.fieldModalIsEdit ? 'Editar Campo' : 'Novo Campo'} onClose={vm.closeFieldModal}>
          <S.ModalForm>
            <InputGroup>
              <Label>Nome do campo *</Label>
              <Input
                value={vm.fieldForm.label}
                onChange={(e) => vm.updateFieldForm({ label: e.target.value })}
                placeholder="Ex: Data de aniversário"
              />
            </InputGroup>
            {!vm.fieldModalIsEdit && (
              <InputGroup>
                <Label>Tipo do campo *</Label>
                <SearchSelect
                  options={vm.typeOptions}
                  value={vm.fieldForm.type}
                  onChange={(value) => vm.updateFieldForm({ type: value as typeof vm.fieldForm.type })}
                  placeholder="Escolha o tipo"
                />
              </InputGroup>
            )}
            {vm.fieldForm.type === 'masked' && (
              <InputGroup>
                <Label>Máscara *</Label>
                <SearchSelect
                  options={vm.maskOptions}
                  value={vm.fieldForm.mask}
                  onChange={(value) => vm.updateFieldForm({ mask: value as typeof vm.fieldForm.mask })}
                  placeholder="Escolha a máscara"
                />
              </InputGroup>
            )}
            {vm.fieldForm.type === 'reference' && (
              <InputGroup>
                <Label>Tela vinculada *</Label>
                <SearchSelect
                  options={vm.refEntityOptions}
                  value={vm.fieldForm.refEntity}
                  onChange={(value) => vm.updateFieldForm({ refEntity: value })}
                  placeholder="Escolha a tela"
                />
              </InputGroup>
            )}
            {vm.fieldForm.type === 'select' && (
              <>
                <S.CheckboxRow>
                  <input
                    type="checkbox"
                    checked={vm.fieldForm.optionsColored}
                    onChange={(e) => vm.updateFieldForm({ optionsColored: e.target.checked })}
                  />
                  Opções com cor
                </S.CheckboxRow>
                <InputGroup>
                  <Label>Opções</Label>
                  {vm.fieldForm.optionsColored && (
                    <ColorSwatchPicker
                      colors={vm.tagColors}
                      value={vm.fieldForm.optionColorInput}
                      onChange={(color) => vm.updateFieldForm({ optionColorInput: color })}
                    />
                  )}
                  <S.OptionInputRow>
                    <Input
                      value={vm.fieldForm.optionInput}
                      onChange={(e) => vm.updateFieldForm({ optionInput: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          vm.addStaticOption();
                        }
                      }}
                      placeholder="Digite uma opção e pressione Enter"
                    />
                    <Button variant="secondary" onClick={vm.addStaticOption}>Adicionar</Button>
                  </S.OptionInputRow>
                  {vm.fieldForm.staticOptions.length > 0 && (
                    <S.OptionChips>
                      {vm.fieldForm.staticOptions.map((option) => (
                        <S.Chip key={option.label}>
                          {option.color && <ColorDot color={option.color} />}
                          {option.label}
                          <S.ChipRemove type="button" onClick={() => vm.removeStaticOption(option.label)}>×</S.ChipRemove>
                        </S.Chip>
                      ))}
                    </S.OptionChips>
                  )}
                </InputGroup>
                <S.CheckboxRow>
                  <input
                    type="checkbox"
                    checked={vm.fieldForm.optionsAllowUserAdd}
                    onChange={(e) => vm.updateFieldForm({ optionsAllowUserAdd: e.target.checked })}
                  />
                  Permitir que usuários adicionem novas opções
                </S.CheckboxRow>
              </>
            )}
            {(vm.fieldForm.type === 'select' || vm.fieldForm.type === 'reference') && !vm.fieldModalIsEdit && (
              <S.CheckboxRow>
                <input
                  type="checkbox"
                  checked={vm.fieldForm.multi}
                  onChange={(e) => vm.updateFieldForm({ multi: e.target.checked })}
                />
                Permitir múltiplas seleções
              </S.CheckboxRow>
            )}
            <InputGroup>
              <Label>Seção do formulário</Label>
              <Input
                value={vm.fieldForm.section}
                onChange={(e) => vm.updateFieldForm({ section: e.target.value })}
                placeholder="Opcional — agrupa campos sob um título"
              />
            </InputGroup>
            <InputGroup>
              <Label>Texto de exemplo</Label>
              <Input
                value={vm.fieldForm.placeholder}
                onChange={(e) => vm.updateFieldForm({ placeholder: e.target.value })}
                placeholder="Opcional — exibido dentro do campo vazio"
              />
            </InputGroup>
            <S.CheckboxRow>
              <input
                type="checkbox"
                checked={vm.fieldModalIsTitleField ? true : vm.fieldForm.required}
                disabled={vm.fieldModalIsTitleField}
                onChange={(e) => vm.updateFieldForm({ required: e.target.checked })}
              />
              Preenchimento obrigatório
            </S.CheckboxRow>
            <S.CheckboxRow>
              <input
                type="checkbox"
                checked={vm.fieldForm.showInList}
                onChange={(e) => vm.updateFieldForm({ showInList: e.target.checked })}
              />
              Exibir na listagem
            </S.CheckboxRow>
            <S.CheckboxRow>
              <input
                type="checkbox"
                checked={vm.fieldForm.filterable}
                onChange={(e) => vm.updateFieldForm({ filterable: e.target.checked })}
              />
              Disponível como filtro na listagem
            </S.CheckboxRow>
            <S.ModalActions>
              <Button variant="secondary" onClick={vm.closeFieldModal}>Cancelar</Button>
              <Button onClick={() => void vm.handleSaveField()} disabled={vm.savingField} $isLoading={vm.savingField}>
                Salvar
              </Button>
            </S.ModalActions>
          </S.ModalForm>
        </Modal>
      )}

      <ConfirmModal
        isOpen={vm.deleteScreenTarget !== null}
        title="Excluir tela"
        message={`Tem certeza que deseja excluir a tela "${vm.deleteScreenTarget?.titlePlural ?? ''}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        loading={vm.deletingScreen}
        onConfirm={() => void vm.confirmDeleteScreen()}
        onCancel={vm.cancelDeleteScreen}
      />

      <ConfirmModal
        isOpen={vm.deleteFieldTarget !== null}
        title="Excluir campo"
        message={`Tem certeza que deseja excluir o campo "${vm.deleteFieldTarget?.field.label ?? ''}"? Os valores já preenchidos deixarão de ser exibidos.`}
        variant="danger"
        confirmLabel="Excluir"
        loading={vm.deletingField}
        onConfirm={() => void vm.confirmDeleteField()}
        onCancel={vm.cancelDeleteField}
      />
    </S.Page>
  );
};
