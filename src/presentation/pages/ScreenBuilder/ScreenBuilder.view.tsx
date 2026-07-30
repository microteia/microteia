import React from 'react';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiArrowUpSLine,
  RiDeleteBinLine,
  RiDraggable,
  RiEyeLine,
  RiEyeOffLine,
  RiPencilLine,
} from 'react-icons/ri';
import { S } from './ScreenBuilder.styles';
import { useScreenBuilderViewModel } from './ScreenBuilder.viewmodel';
import type { ScreenBuilderViewModel, SelectedScreenState } from './ScreenBuilder.viewmodel';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Input, InputGroup, Label } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { MultiSearchSelect } from '../../components/ui/MultiSearchSelect';
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
    {fields.length === 0 && <S.EmptyHint>Nenhum campo definido.</S.EmptyHint>}
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
            {vm.isNativeField(screenKey, field.key)
              ? 'Do sistema · '
              : vm.isPluginField(screenKey, field.key)
                ? 'Extensão · '
                : ''}
            {vm.fieldTypeLabel(field.type)}
            {field.section ? ` · ${field.section}` : ''}
            {` · fieldName: ${field.key}`}
            {vm.hasNativeOverride(screenKey, field.key) ? ' · ajustado' : ''}
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
          {vm.isNativeField(screenKey, field.key) ? (
            <S.IconButton
              title="Restaurar padrão do sistema"
              disabled={!vm.hasNativeOverride(screenKey, field.key)}
              onClick={() => void vm.restoreNativeField(screenKey, field.key)}
            >
              <RiArrowGoBackLine size={16} />
            </S.IconButton>
          ) : (
            <S.DangerIconButton
              title={
                vm.isPluginField(screenKey, field.key)
                  ? 'Campo de extensão — não pode ser excluído'
                  : 'Excluir campo'
              }
              disabled={vm.isTitleField(screenKey, field.key) || vm.isPluginField(screenKey, field.key)}
              onClick={() => vm.requestDeleteField(screenKey, field.key)}
            >
              <RiDeleteBinLine size={16} />
            </S.DangerIconButton>
          )}
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
          {vm.isManagedScreen(screen.key) && (
            <S.PluginBadge title={vm.managedScreenOwner(screen.key) ?? undefined}>Extensão</S.PluginBadge>
          )}
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
          <S.DangerIconButton
            title={vm.isManagedScreen(screen.key) ? 'Tela de extensão — remova a extensão para excluir' : 'Excluir tela'}
            disabled={vm.isManagedScreen(screen.key)}
            onClick={() => vm.requestDeleteScreen(screen.key)}
          >
            <RiDeleteBinLine size={16} />
          </S.DangerIconButton>
        </S.CardActions>
      )}
      {screen.kind === 'builtin' && (
        <S.CardActions>
          <S.IconButton title="Configurar registros filhos" onClick={() => vm.openEditScreen(screen.key)}>
            <RiPencilLine size={16} />
          </S.IconButton>
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
        <Modal
          title={vm.screenModalTitle}
          onClose={vm.closeScreenModal}
          size="xlarge"
        >
          {vm.screenModalTabs.length > 1 && (
            <S.ModalTabs>
              {vm.screenModalTabs.map((tab) => (
                <S.ModalTabBtn
                  key={tab.key}
                  $active={vm.screenModalTab === tab.key}
                  onClick={() => vm.setScreenModalTab(tab.key)}
                >
                  {tab.label}
                </S.ModalTabBtn>
              ))}
            </S.ModalTabs>
          )}
          <S.ModalForm>
            {/* Título, ícone, abas e ações são fixos nas telas do sistema — lá não há aba "Geral". */}
            {vm.screenModalTab === 'general' && !vm.screenModalIsBuiltin && (
              <>
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
                <S.RulesDivider>Abas do registro</S.RulesDivider>
                <S.CheckboxCell>
                  <Checkbox
                    label="Habilitar aba de Anotações"
                    checked={vm.screenForm.hasNotes}
                    onChange={(next) => vm.updateScreenForm({ hasNotes: next })}
                  />
                </S.CheckboxCell>
                <S.CheckboxCell>
                  <Checkbox
                    label="Habilitar aba de Documentos"
                    checked={vm.screenForm.hasDocuments}
                    onChange={(next) => vm.updateScreenForm({ hasDocuments: next })}
                  />
                </S.CheckboxCell>
                <S.CheckboxCell>
                  <Checkbox
                    label="Habilitar Etiquetas"
                    checked={vm.screenForm.hasTags}
                    onChange={(next) => vm.updateScreenForm({ hasTags: next })}
                  />
                </S.CheckboxCell>
                {vm.screenForm.hasTags && (
                  <>
                    <InputGroup>
                      <Label>Conjunto de etiquetas</Label>
                      <Input
                        value={vm.screenForm.tagCollection}
                        onChange={(e) => vm.updateScreenForm({ tagCollection: e.target.value })}
                        placeholder={vm.suggestedTagCollection}
                      />
                      <S.FieldHint>
                        As etiquetas criadas ficam neste conjunto, e continuam lá mesmo se a tela for
                        excluída. Em branco, o sistema cria
                        {vm.suggestedTagCollection ? ` "${vm.suggestedTagCollection}"` : ' um conjunto para esta tela'}.
                      </S.FieldHint>
                    </InputGroup>
                    <InputGroup>
                      <Label>Reaproveitar etiquetas de outra tela</Label>
                      <SearchSelect
                        options={vm.tagListOptions}
                        value={vm.screenForm.tagCollection}
                        onChange={(value) => vm.updateScreenForm({ tagCollection: value })}
                        placeholder="Escolha para compartilhar as etiquetas"
                      />
                    </InputGroup>
                  </>
                )}
                {vm.screenModalIsEdit && (
                  <S.CheckboxCell>
                    <Checkbox
                      label="Tela ativa (visível no menu lateral)"
                      checked={vm.screenForm.enabled}
                      onChange={(next) => vm.updateScreenForm({ enabled: next })}
                    />
                  </S.CheckboxCell>
                )}
              </>
            )}

            {vm.screenModalTab === 'children' && (
              <>
                <S.FullRow>
                  <InfoBanner
                    variant="info"
                    message="Telas que possuem um campo apontando para esta. Ao marcar, os registros dela passam a aparecer como uma aba dentro de cada registro desta tela — e ela sai do menu lateral e da busca."
                  />
                </S.FullRow>
                {vm.childCandidates.map((candidate) => {
                  const linkField = vm.screenForm.childLinks[candidate.key];
                  const isChild = linkField !== undefined;
                  return (
                    <React.Fragment key={candidate.key}>
                      <S.CheckboxCell>
                        <Checkbox
                          label={candidate.label}
                          checked={isChild}
                          onChange={() => vm.toggleChildScreen(candidate.key)}
                        />
                      </S.CheckboxCell>
                      {isChild && candidate.fieldOptions.length > 1 ? (
                        <InputGroup>
                          <Label>{`Campo de vínculo de ${candidate.label} *`}</Label>
                          <SearchSelect
                            options={candidate.fieldOptions}
                            value={linkField}
                            onChange={(value) => vm.setChildLinkField(candidate.key, value)}
                            placeholder="Escolha o campo"
                          />
                        </InputGroup>
                      ) : <div />}
                    </React.Fragment>
                  );
                })}
              </>
            )}

            {vm.screenModalTab === 'list' && vm.modalListActionOptions.map((option) => (
              <S.CheckboxCell key={option.key}>
                <Checkbox
                  label={option.label}
                  checked={vm.screenForm.listActions.includes(option.key)}
                  onChange={() => vm.toggleListAction(option.key)}
                  disabled={!vm.screenModalIsBuiltin && option.key === 'manageTags' && !vm.screenForm.hasTags}
                />
              </S.CheckboxCell>
            ))}
            {vm.screenModalTab === 'actions' && (
              <>
                <InputGroup>
                  <Label>Ações da tela de detalhe</Label>
                  <MultiSearchSelect
                    options={vm.actionOptions}
                    values={vm.screenForm.viewActionIds}
                    onChange={vm.setScreenViewActionIds}
                    placeholder="Nenhuma ação"
                  />
                </InputGroup>
                <InputGroup>
                  <Label>Ações do card na listagem</Label>
                  <MultiSearchSelect
                    options={vm.actionOptions}
                    values={vm.screenForm.cardActionIds}
                    onChange={vm.setScreenCardActionIds}
                    placeholder="Nenhuma ação"
                  />
                </InputGroup>
              </>
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
        <Modal title={vm.fieldModalIsNative ? 'Ajustar Campo do Sistema' : (vm.fieldModalIsEdit ? 'Editar Campo' : 'Novo Campo')} onClose={vm.closeFieldModal} size="xlarge">
          <S.ModalTabs>
            <S.ModalTabBtn $active={vm.fieldModalTab === 'general'} onClick={() => vm.setFieldModalTab('general')}>
              Geral
            </S.ModalTabBtn>
            <S.ModalTabBtn $active={vm.fieldModalTab === 'advanced'} onClick={() => vm.setFieldModalTab('advanced')}>
              Avançado
            </S.ModalTabBtn>
          </S.ModalTabs>
          <S.ModalForm>
            {vm.fieldModalIsNative && (
              <S.FullRow>
                <InfoBanner
                  variant="info"
                  message="Campo do sistema: pode ser configurado à vontade, mas não excluído. A chave e o tipo ficam fixos porque definem como o valor é gravado."
                />
              </S.FullRow>
            )}
            {vm.fieldModalTab === 'general' && (
              <>
            <InputGroup>
              <Label>Nome do campo *</Label>
              <Input
                value={vm.fieldForm.label}
                onChange={(e) => vm.updateFieldForm({ label: e.target.value })}
                placeholder="Ex: Data de aniversário"
              />
            </InputGroup>
            {!vm.fieldModalIsNative && (
              <>
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
            {vm.fieldForm.type === 'reference' && (
              <>
                <InputGroup>
                  <Label>Tela vinculada *</Label>
                  <SearchSelect
                    options={vm.refEntityOptions}
                    value={vm.fieldForm.refEntity}
                    onChange={(value) => vm.updateFieldForm({ refEntity: value })}
                    placeholder="Escolha a tela"
                  />
                </InputGroup>
                {!vm.fieldModalIsEdit && (
                  <S.CheckboxCell>
                    <Checkbox
                      label="Permitir múltiplas seleções"
                      checked={vm.fieldForm.multi}
                      onChange={(next) => vm.updateFieldForm({ multi: next })}
                    />
                  </S.CheckboxCell>
                )}
              </>
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
                <S.CheckboxCell>
                  <Checkbox
                    label="Permitir que usuários adicionem novas opções"
                    checked={vm.fieldForm.optionsAllowUserAdd}
                    onChange={(next) => vm.updateFieldForm({ optionsAllowUserAdd: next })}
                  />
                </S.CheckboxCell>
                {vm.fieldForm.optionsAllowUserAdd && (
                  <>
                    <InputGroup>
                      <Label>Lista de opções</Label>
                      <Input
                        value={vm.fieldForm.lookupCollection}
                        onChange={(e) => vm.updateFieldForm({ lookupCollection: e.target.value })}
                        placeholder={vm.suggestedLookupCollection}
                      />
                      <S.FieldHint>
                        As opções cadastradas pelos usuários ficam nesta lista, e continuam lá mesmo
                        se a tela for excluída. Em branco, o sistema cria
                        {vm.suggestedLookupCollection ? ` "${vm.suggestedLookupCollection}"` : ' uma lista para este campo'}.
                      </S.FieldHint>
                    </InputGroup>
                    <InputGroup>
                      <Label>Reaproveitar uma lista existente</Label>
                      <SearchSelect
                        options={vm.lookupOptions}
                        value={vm.fieldForm.lookupCollection}
                        onChange={(value) => vm.updateFieldForm({ lookupCollection: value })}
                        placeholder="Escolha para compartilhar as opções com outra tela"
                      />
                    </InputGroup>
                  </>
                )}
                {!vm.fieldModalIsEdit && (
                  <S.CheckboxCell>
                    <Checkbox
                      label="Permitir múltiplas seleções"
                      checked={vm.fieldForm.multi}
                      onChange={(next) => vm.updateFieldForm({ multi: next })}
                    />
                  </S.CheckboxCell>
                )}
              </>
            )}
              </>
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
            <S.RulesDivider>Comportamento na tela</S.RulesDivider>
            <S.CheckboxCell>
              <Checkbox
                label="Preenchimento obrigatório"
                checked={vm.fieldModalIsTitleField ? true : vm.fieldForm.required}
                disabled={vm.fieldModalIsTitleField}
                onChange={(next) => vm.updateFieldForm({ required: next })}
              />
            </S.CheckboxCell>
            <S.CheckboxCell>
              <Checkbox
                label="Disponível como filtro na listagem"
                checked={vm.fieldForm.filterable}
                onChange={(next) => vm.updateFieldForm({ filterable: next })}
              />
            </S.CheckboxCell>
            <S.CheckboxCell>
              <Checkbox
                label="Exibir na listagem"
                checked={vm.fieldForm.showInList}
                onChange={(next) => vm.updateFieldForm({ showInList: next })}
              />
            </S.CheckboxCell>
            {vm.fieldForm.showInList ? (
              <InputGroup>
                <Label>Título no card da listagem</Label>
                <Input
                  value={vm.fieldForm.listLabel}
                  onChange={(e) => vm.updateFieldForm({ listLabel: e.target.value })}
                  placeholder="Opcional — se vazio, o valor aparece sem título no card"
                />
              </InputGroup>
            ) : <div />}
              </>
            )}

            {vm.fieldModalTab === 'advanced' && (
              <>
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
                      <Label>Validação pronta</Label>
                      <SearchSelect
                        options={vm.validateCheckOptions}
                        value={vm.fieldForm.ruleValidateCheck}
                        onChange={(value) => vm.updateFieldForm({ ruleValidateCheck: value as typeof vm.fieldForm.ruleValidateCheck })}
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
                {vm.aggregationFromOptions.length > 1 && (
                  <>
                    <S.RulesDivider>Valor vindo dos registros filhos</S.RulesDivider>
                    <S.FullRow>
                      <InfoBanner
                        message="Use para totalizar registros de outra tela vinculados a este — como o total dos itens de uma venda. O valor é recalculado automaticamente sempre que um filho é criado, alterado ou excluído."
                        variant="info"
                      />
                    </S.FullRow>
                    <InputGroup>
                      <Label>Tela dos filhos</Label>
                      <SearchSelect
                        options={vm.aggregationFromOptions}
                        value={vm.fieldForm.aggregationFrom}
                        onChange={(value) => vm.updateFieldForm({ aggregationFrom: value, aggregationVia: '', aggregationField: '' })}
                        placeholder="Nenhuma (campo comum)"
                      />
                    </InputGroup>
                    {vm.fieldForm.aggregationFrom !== '' && (
                      <>
                        <InputGroup>
                          <Label>Campo do filho que aponta para esta tela</Label>
                          <SearchSelect
                            options={vm.aggregationViaOptions}
                            value={vm.fieldForm.aggregationVia}
                            onChange={(value) => vm.updateFieldForm({ aggregationVia: value })}
                            placeholder="Escolha o vínculo"
                          />
                        </InputGroup>
                        <InputGroup>
                          <Label>Operação</Label>
                          <SearchSelect
                            options={vm.aggregationOpOptions}
                            value={vm.fieldForm.aggregationOp}
                            onChange={(value) => vm.updateFieldForm({ aggregationOp: value as typeof vm.fieldForm.aggregationOp })}
                            placeholder="Escolha a operação"
                          />
                        </InputGroup>
                        {vm.fieldForm.aggregationOp !== 'count' && (
                          <InputGroup>
                            <Label>Campo do filho a ser medido</Label>
                            <SearchSelect
                              options={vm.aggregationFieldOptions}
                              value={vm.fieldForm.aggregationField}
                              onChange={(value) => vm.updateFieldForm({ aggregationField: value })}
                              placeholder="Escolha o campo"
                            />
                          </InputGroup>
                        )}
                        <S.FullRow>
                          <InputGroup>
                            <Label>Considerar apenas os filhos que atendam a (opcional)</Label>
                            <ExpressionEditor
                              value={vm.fieldForm.aggregationFilter}
                              onChange={(value) => vm.updateFieldForm({ aggregationFilter: value })}
                              workflowVariables={vm.aggregationFilterVariables}
                              placeholder="Ex: status != 'cancelado'"
                            />
                          </InputGroup>
                        </S.FullRow>
                      </>
                    )}
                  </>
                )}
                <S.RulesDivider>Comportamento por expressão</S.RulesDivider>
                <S.FullRow>
                  <InfoBanner
                    message="Nas expressões, referencie os campos da tela pela chave (ex.: status, valor) — comece a digitar para ver as sugestões. Use value para o valor do próprio campo. Em Ocultar, Desabilitar e Ao alterar, um campo de vínculo pode ser navegado (ex.: produto.preco); em Validação e Valor calculado ele vale como identificador, pois essas duas também são conferidas no servidor."
                    variant="info"
                  />
                  <InputGroup>
                    <Label>Valor calculado (preenche o campo automaticamente)</Label>
                    <ExpressionEditor
                      value={vm.fieldForm.logicCompute}
                      onChange={(value) => vm.updateFieldForm({ logicCompute: value })}
                      workflowVariables={vm.fieldExpressionVariables}
                      placeholder="Ex: trim(concat(nome, ' ', sobrenome))"
                    />
                  </InputGroup>
                  <InputGroup>
                    <Label>Validação (retorna a mensagem de erro, ou vazio/null se válido)</Label>
                    <ExpressionEditor
                      value={vm.fieldForm.logicValidate}
                      onChange={(value) => vm.updateFieldForm({ logicValidate: value })}
                      workflowVariables={vm.fieldExpressionVariables}
                      placeholder="Ex: if(isEmpty(value) and status == 'ativo', 'Obrigatório para ativos', null)"
                    />
                  </InputGroup>
                </S.FullRow>
                <InputGroup>
                  <Label>Desabilitar quando (verdadeiro/falso)</Label>
                  <ExpressionEditor
                    value={vm.fieldForm.logicDisabledWhen}
                    onChange={(value) => vm.updateFieldForm({ logicDisabledWhen: value })}
                    workflowVariables={vm.fieldExpressionVariables}
                    placeholder="Ex: status == 'encerrado'"
                  />
                </InputGroup>
                <S.FullRow>
                  <InputGroup>
                    <Label>Ao alterar, preencher (devolve os campos a preencher)</Label>
                    <ExpressionEditor
                      value={vm.fieldForm.logicOnChange}
                      onChange={(value) => vm.updateFieldForm({ logicOnChange: value })}
                      workflowVariables={vm.fieldExpressionVariables}
                      placeholder="Ex: object('preco', produto.preco, 'unidade', produto.unidade)"
                    />
                  </InputGroup>
                </S.FullRow>
                <InputGroup>
                  <Label>Ao alterar, buscar dados externos</Label>
                  <SearchSelect
                    options={vm.lookupProviderOptions}
                    value={vm.fieldForm.lookupProvider}
                    onChange={(value) => vm.updateFieldForm({ lookupProvider: value })}
                    placeholder="Nenhuma"
                  />
                </InputGroup>
                {vm.fieldForm.lookupProvider !== '' && (
                  <InputGroup>
                    <Label>Preencher dentro de (opcional)</Label>
                    <Input
                      value={vm.fieldForm.lookupTargetPrefix}
                      onChange={(e) => vm.updateFieldForm({ lookupTargetPrefix: e.target.value })}
                      placeholder="Ex: address"
                    />
                  </InputGroup>
                )}
                <InputGroup>
                  <Label>Ocultar quando (verdadeiro/falso)</Label>
                  <ExpressionEditor
                    value={vm.fieldForm.logicHiddenWhen}
                    onChange={(value) => vm.updateFieldForm({ logicHiddenWhen: value })}
                    workflowVariables={vm.fieldExpressionVariables}
                    placeholder="Ex: eletrico == false (some quando NÃO for elétrico)"
                  />
                </InputGroup>
              </>
            )}
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
