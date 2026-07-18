import React from 'react';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiDeleteBinLine,
  RiDraggable,
  RiEyeLine,
  RiEyeOffLine,
  RiPencilLine,
} from 'react-icons/ri';
import { S } from './ScreenBuilder.styles';
import { useScreenBuilderViewModel, LIST_ACTION_OPTIONS } from './ScreenBuilder.viewmodel';
import type { ScreenBuilderViewModel, SelectedScreenState } from './ScreenBuilder.viewmodel';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Input, InputGroup, Label } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ExpressionEditor } from '../../components/ui/ExpressionEditor';
import { ColorSwatchPicker } from '../../components/ui/ColorSwatchPicker';
import { ColorDot } from '../../components/ui/Badge';
import { getScreenIcon } from '../../shared/screenIcons';
import type { FieldDefinition } from '../../../domain/entities';

const FieldRows: React.FC<{ vm: ScreenBuilderViewModel; screenKey: string; fields: FieldDefinition[] }> = ({ vm, screenKey, fields }) => (
  <S.FieldList>
    {fields.length === 0 && <S.EmptyHint>Nenhum campo adicional definido.</S.EmptyHint>}
    {fields.map((field, index) => (
      <S.FieldRow
        key={field.key}
        draggable
        $dragging={vm.draggedFieldKey === field.key}
        $dragOver={vm.dragOverFieldKey === field.key && vm.draggedFieldKey !== field.key}
        onDragStart={() => vm.handleFieldDragStart(field.key)}
        onDragOver={(e) => {
          e.preventDefault();
          vm.handleFieldDragOver(field.key);
        }}
        onDrop={(e) => {
          e.preventDefault();
          void vm.handleFieldDrop(screenKey, field.key);
        }}
        onDragEnd={vm.handleFieldDragEnd}
      >
        <S.DragHandle title="Arrastar para reordenar">
          <RiDraggable size={16} />
        </S.DragHandle>
        <S.FieldInfo>
          <S.FieldName>
            {field.label}
            {field.required ? ' *' : ''}
            {vm.isTitleField(screenKey, field.key) ? ' (título)' : ''}
          </S.FieldName>
          <S.FieldMeta>
            {vm.fieldTypeLabel(field.type)}
            {field.section ? ` · ${field.section}` : ''}
            {` · fieldName: ${field.key}`}
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

const ScreenDetailPane: React.FC<{ vm: ScreenBuilderViewModel; screen: SelectedScreenState }> = ({ vm, screen }) => (
  <S.DetailCard $disabled={!screen.enabled}>
    <S.ScreenCardHeader>
      <S.ScreenIcon>{getScreenIcon(screen.icon)}</S.ScreenIcon>
      <S.ScreenInfo>
        <S.ScreenName>
          {screen.title}
          {!screen.enabled && <S.DisabledBadge>Desativada</S.DisabledBadge>}
        </S.ScreenName>
        <S.ScreenMeta>{screen.meta}</S.ScreenMeta>
      </S.ScreenInfo>
      {screen.kind === 'dynamic' && (
        <S.CardActions>
          <S.IconButton
            title="Mover para cima"
            disabled={!screen.canMoveUp}
            onClick={() => void vm.moveScreen(screen.key, -1)}
          >
            <RiArrowUpSLine size={18} />
          </S.IconButton>
          <S.IconButton
            title="Mover para baixo"
            disabled={!screen.canMoveDown}
            onClick={() => void vm.moveScreen(screen.key, 1)}
          >
            <RiArrowDownSLine size={18} />
          </S.IconButton>
          <S.IconButton
            title={screen.enabled ? 'Desativar tela' : 'Ativar tela'}
            onClick={() => void vm.toggleScreenEnabled(screen.key)}
          >
            {screen.enabled ? <RiEyeLine size={16} /> : <RiEyeOffLine size={16} />}
          </S.IconButton>
          <S.IconButton title="Editar tela" onClick={() => vm.openEditScreen(screen.key)}>
            <RiPencilLine size={16} />
          </S.IconButton>
          <S.DangerIconButton title="Excluir tela" onClick={() => vm.requestDeleteScreen(screen.key)}>
            <RiDeleteBinLine size={16} />
          </S.DangerIconButton>
        </S.CardActions>
      )}
    </S.ScreenCardHeader>
    <FieldRows vm={vm} screenKey={screen.key} fields={screen.fields} />
    <S.CardFooter>
      <Button variant="secondary" size="sm" onClick={() => vm.openCreateField(screen.key)}>
        <RiAddLine size={16} />
        Adicionar campo
      </Button>
    </S.CardFooter>
  </S.DetailCard>
);

export const ScreenBuilderView: React.FC = () => {
  const vm = useScreenBuilderViewModel();

  if (!vm.isAdmin) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>Form Design</S.Title>
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
        <S.Title>Form Design</S.Title>
        <Button onClick={vm.openCreateScreen} title="Nova Tela">
          <RiAddLine size={18} />
        </Button>
      </S.Header>

      <S.Content>
        <S.Sidebar>
          <S.SidebarSection>
            <S.SectionTitle>Telas customizadas</S.SectionTitle>
            <S.SectionHint>
              Crie telas próprias do escritório, com campos, listagem, filtros e busca no atalho ⌘K.
            </S.SectionHint>
            {vm.dynamicListEntries.length === 0 && (
              <S.EmptyHint>Nenhuma tela customizada criada ainda.</S.EmptyHint>
            )}
            <S.ScreenList>
              {vm.dynamicListEntries.map((entry) => (
                <S.ScreenListItem
                  key={entry.key}
                  type="button"
                  $active={vm.selectedKey === entry.key}
                  onClick={() => vm.selectScreen(entry.key)}
                >
                  <S.ScreenListIcon>{getScreenIcon(entry.icon)}</S.ScreenListIcon>
                  <S.ScreenListInfo>
                    <S.ScreenListName>
                      {entry.title}
                      {entry.disabled && <S.DisabledBadge>Desativada</S.DisabledBadge>}
                    </S.ScreenListName>
                    <S.ScreenListMeta>{entry.meta}</S.ScreenListMeta>
                  </S.ScreenListInfo>
                </S.ScreenListItem>
              ))}
            </S.ScreenList>
          </S.SidebarSection>

          <S.SidebarSection>
            <S.SectionTitle>Campos adicionais das telas padrão</S.SectionTitle>
            <S.SectionHint>
              Adicione campos personalizados às telas já existentes do sistema. Eles aparecem na seção
              "Campos adicionais" do formulário de cada tela.
            </S.SectionHint>
            <S.ScreenList>
              {vm.builtinListEntries.map((entry) => (
                <S.ScreenListItem
                  key={entry.key}
                  type="button"
                  $active={vm.selectedKey === entry.key}
                  onClick={() => vm.selectScreen(entry.key)}
                >
                  <S.ScreenListIcon>{getScreenIcon(entry.icon)}</S.ScreenListIcon>
                  <S.ScreenListInfo>
                    <S.ScreenListName>{entry.title}</S.ScreenListName>
                    <S.ScreenListMeta>{entry.meta}</S.ScreenListMeta>
                  </S.ScreenListInfo>
                </S.ScreenListItem>
              ))}
            </S.ScreenList>
          </S.SidebarSection>
        </S.Sidebar>

        <S.Detail>
          {vm.selectedScreen ? (
            <ScreenDetailPane vm={vm} screen={vm.selectedScreen} />
          ) : (
            <S.EmptyHint>Selecione uma tela ao lado para ver seus campos.</S.EmptyHint>
          )}
        </S.Detail>
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
              <SearchSelect
                options={vm.iconOptions}
                value={vm.screenForm.icon}
                onChange={(value) => vm.updateScreenForm({ icon: value })}
                placeholder="Escolha um ícone"
              />
            </InputGroup>
            {vm.screenModalIsEdit && vm.titleFieldOptions.length > 0 && (
              <InputGroup>
                <Label>Campo Título</Label>
                <SearchSelect
                  options={vm.titleFieldOptions}
                  value={vm.screenForm.titleFieldKey}
                  onChange={(value) => vm.updateScreenForm({ titleFieldKey: value })}
                  placeholder="Escolha o campo título"
                />
              </InputGroup>
            )}
            <S.CheckboxRow>
              <Checkbox
                label="Habilitar aba de Anotações"
                checked={vm.screenForm.hasNotes}
                onChange={(next) => vm.updateScreenForm({ hasNotes: next })}
              />
            </S.CheckboxRow>
            <S.CheckboxRow>
              <Checkbox
                label="Habilitar aba de Documentos"
                checked={vm.screenForm.hasDocuments}
                onChange={(next) => vm.updateScreenForm({ hasDocuments: next })}
              />
            </S.CheckboxRow>
            <S.CheckboxRow>
              <Checkbox
                label="Habilitar Etiquetas"
                checked={vm.screenForm.hasTags}
                onChange={(next) => vm.updateScreenForm({ hasTags: next })}
              />
            </S.CheckboxRow>
            {vm.screenModalIsEdit && (
              <>
                <S.RulesDivider>Registros filhos</S.RulesDivider>
                <S.FullRow>
                  <InfoBanner
                    variant="info"
                    message="Ao definir uma tela pai, esta tela sai do menu lateral e da busca: seus registros passam a ser exibidos como uma aba dentro do registro pai. É preciso ter um campo do tipo 'Vínculo com registro' apontando para a tela pai."
                  />
                </S.FullRow>
                <InputGroup>
                  <Label>Tela pai</Label>
                  <SearchSelect
                    options={vm.parentEntityOptions}
                    value={vm.screenForm.parentEntity}
                    onChange={(value) => vm.updateScreenForm({ parentEntity: value, parentFieldKey: '' })}
                    placeholder="Nenhuma — tela independente"
                  />
                </InputGroup>
                {vm.screenForm.parentEntity && (
                  <InputGroup>
                    <Label>Campo de vínculo *</Label>
                    <SearchSelect
                      options={vm.parentFieldOptions}
                      value={vm.screenForm.parentFieldKey}
                      onChange={(value) => vm.updateScreenForm({ parentFieldKey: value })}
                      placeholder={vm.parentFieldOptions.length > 0
                        ? 'Escolha o campo'
                        : 'Crie antes um campo de vínculo para a tela pai'}
                    />
                  </InputGroup>
                )}
              </>
            )}

            <S.RulesDivider>Ações no card da listagem</S.RulesDivider>
            {LIST_ACTION_OPTIONS.map((option) => (
              <S.CheckboxRow key={option.key}>
                <Checkbox
                  label={option.label}
                  checked={vm.screenForm.listActions.includes(option.key)}
                  onChange={() => vm.toggleListAction(option.key)}
                  disabled={option.key === 'manageTags' && !vm.screenForm.hasTags}
                />
              </S.CheckboxRow>
            ))}
            {vm.screenModalIsEdit && (
              <S.CheckboxRow>
                <Checkbox
                  label="Tela ativa (visível no menu lateral)"
                  checked={vm.screenForm.enabled}
                  onChange={(next) => vm.updateScreenForm({ enabled: next })}
                />
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
        <Modal title={vm.fieldModalIsEdit ? 'Editar Campo' : 'Novo Campo'} onClose={vm.closeFieldModal} size="large">
          <S.ModalForm>
            <InputGroup>
              <Label>Nome do campo *</Label>
              <Input
                value={vm.fieldForm.label}
                onChange={(e) => vm.updateFieldForm({ label: e.target.value })}
                placeholder="Ex: Data de aniversário"
              />
            </InputGroup>
            <InputGroup>
              <Label>Nome na base de dados (fieldName) *</Label>
              <Input
                value={vm.fieldForm.fieldKey}
                onChange={(e) => vm.updateFieldForm({ fieldKey: e.target.value })}
                placeholder="Ex: data_nascimento"
                disabled={vm.fieldModalIsEdit}
                title={vm.fieldModalIsEdit ? 'O nome do campo na base não pode ser alterado após criação' : 'Use apenas letras minúsculas, números, underscore (_) ou $. Deve começar com letra, underscore ou $. Este é o nome usado em workflows e integrações.'}
              />
              {!vm.fieldModalIsEdit && (
                <S.FieldHint>
                  Use apenas letras minúsculas, números, underscore (_) ou $. Deve começar com letra, underscore ou $. Este é o nome usado em workflows e integrações.
                </S.FieldHint>
              )}
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
            {vm.fieldSupportsRules && (
              <>
                <S.RulesDivider>Formatação e validação</S.RulesDivider>
                <InputGroup>
                  <Label>Formatação pronta</Label>
                  <SearchSelect
                    options={vm.formatPresetOptions}
                    value={vm.fieldForm.ruleFormatPreset}
                    onChange={(value) => vm.updateFieldForm({ ruleFormatPreset: value as typeof vm.fieldForm.ruleFormatPreset })}
                    placeholder="Nenhuma"
                  />
                </InputGroup>
                <InputGroup>
                  <Label>Formatação por expressão regular</Label>
                  <Input
                    value={vm.fieldForm.ruleFormatPattern}
                    onChange={(e) => vm.updateFieldForm({ ruleFormatPattern: e.target.value })}
                    placeholder="Procurar, ex: ^(\d{3})(\d{3})(\d{3})(\d{2})$"
                  />
                </InputGroup>
                <InputGroup>
                  <Label>Substituir por</Label>
                  <Input
                    value={vm.fieldForm.ruleFormatReplacement}
                    onChange={(e) => vm.updateFieldForm({ ruleFormatReplacement: e.target.value })}
                    placeholder="Ex: $1.$2.$3-$4"
                  />
                </InputGroup>
                <InputGroup>
                  <Label>Validação pronta</Label>
                  <SearchSelect
                    options={vm.validateCheckOptions}
                    value={vm.fieldForm.ruleValidateCheck}
                    onChange={(value) => vm.updateFieldForm({ ruleValidateCheck: value as typeof vm.fieldForm.ruleValidateCheck })}
                    placeholder="Nenhuma"
                  />
                </InputGroup>
                <InputGroup>
                  <Label>Validação por expressão regular</Label>
                  <Input
                    value={vm.fieldForm.ruleValidatePattern}
                    onChange={(e) => vm.updateFieldForm({ ruleValidatePattern: e.target.value })}
                    placeholder="Ex: ^[A-Z]{2}\d{6}$"
                  />
                </InputGroup>
                <InputGroup>
                  <Label>Mensagem de erro</Label>
                  <Input
                    value={vm.fieldForm.ruleValidateMessage}
                    onChange={(e) => vm.updateFieldForm({ ruleValidateMessage: e.target.value })}
                    placeholder="Exibida quando o valor não passa na validação"
                  />
                </InputGroup>
              </>
            )}
            <S.RulesDivider>Comportamento por expressão</S.RulesDivider>
            <S.FullRow>
              <InfoBanner
                message="Nas expressões, referencie os campos da tela pela chave (ex.: status, valor) — comece a digitar para ver as sugestões. Use value para o valor do próprio campo."
                variant="info"
              />
              <InputGroup>
                <Label>Validação (retorna a mensagem de erro, ou vazio/null se válido)</Label>
                <ExpressionEditor
                  value={vm.fieldForm.logicValidate}
                  onChange={(value) => vm.updateFieldForm({ logicValidate: value })}
                  workflowVariables={vm.fieldExpressionVariables}
                  placeholder="Ex: if(isEmpty(value) and status == 'ativo', 'Obrigatório para ativos', null)"
                />
              </InputGroup>
              <InputGroup>
                <Label>Desabilitar quando (expressão verdadeiro/falso)</Label>
                <ExpressionEditor
                  value={vm.fieldForm.logicDisabledWhen}
                  onChange={(value) => vm.updateFieldForm({ logicDisabledWhen: value })}
                  workflowVariables={vm.fieldExpressionVariables}
                  placeholder="Ex: status == 'encerrado'"
                />
              </InputGroup>
              <InputGroup>
                <Label>Ocultar quando — some quando a expressão for verdadeira</Label>
                <ExpressionEditor
                  value={vm.fieldForm.logicHiddenWhen}
                  onChange={(value) => vm.updateFieldForm({ logicHiddenWhen: value })}
                  workflowVariables={vm.fieldExpressionVariables}
                  placeholder="Ex: eletrico == false (some quando NÃO for elétrico)"
                />
              </InputGroup>
            </S.FullRow>
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
                  <Checkbox
                    label="Opções com cor"
                    checked={vm.fieldForm.optionsColored}
                    onChange={(next) => vm.updateFieldForm({ optionsColored: next })}
                  />
                </S.CheckboxRow>
                <InputGroup $fullWidth>
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
                  <Checkbox
                    label="Permitir que usuários adicionem novas opções"
                    checked={vm.fieldForm.optionsAllowUserAdd}
                    onChange={(next) => vm.updateFieldForm({ optionsAllowUserAdd: next })}
                  />
                </S.CheckboxRow>
              </>
            )}
            {(vm.fieldForm.type === 'select' || vm.fieldForm.type === 'reference') && !vm.fieldModalIsEdit && (
              <S.CheckboxRow>
                <Checkbox
                  label="Permitir múltiplas seleções"
                  checked={vm.fieldForm.multi}
                  onChange={(next) => vm.updateFieldForm({ multi: next })}
                />
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
              <Checkbox
                label="Preenchimento obrigatório"
                checked={vm.fieldModalIsTitleField ? true : vm.fieldForm.required}
                disabled={vm.fieldModalIsTitleField}
                onChange={(next) => vm.updateFieldForm({ required: next })}
              />
            </S.CheckboxRow>
            <S.CheckboxRow>
              <Checkbox
                label="Exibir na listagem"
                checked={vm.fieldForm.showInList}
                onChange={(next) => vm.updateFieldForm({ showInList: next })}
              />
            </S.CheckboxRow>
            {vm.fieldForm.showInList && (
              <InputGroup>
                <Label>Título no card da listagem</Label>
                <Input
                  value={vm.fieldForm.listLabel}
                  onChange={(e) => vm.updateFieldForm({ listLabel: e.target.value })}
                  placeholder="Opcional — se vazio, o valor aparece sem título no card"
                />
              </InputGroup>
            )}
            <S.CheckboxRow>
              <Checkbox
                label="Disponível como filtro na listagem"
                checked={vm.fieldForm.filterable}
                onChange={(next) => vm.updateFieldForm({ filterable: next })}
              />
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
