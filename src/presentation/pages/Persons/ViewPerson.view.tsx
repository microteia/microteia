import React from 'react';
import {
  RiUserLine,
  RiBuildingLine,
  RiDeleteBinLine,
  RiToggleLine,
  RiLinkM,
  RiCheckLine,
  RiFileCopyLine,
  RiPriceTag3Line,
  RiSaveLine,
} from 'react-icons/ri';
import { S } from './ViewPerson.styles';
import { useViewPersonViewModel } from './ViewPerson.viewmodel';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { NotesPanel, DocumentsPanel } from '../../components/layout/EntityDetailPanels';

export const ViewPersonView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewPersonViewModel(tabKey);

  const appliedTags = vm.person ? vm.tagAdapter.getAppliedTags(vm.person.id) : [];

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.Avatar>
            {(vm.formData.name || 'N').charAt(0).toUpperCase()}
          </S.Avatar>
          <S.HeaderInfo>
            <S.Title>{vm.isNew ? 'Nova Pessoa' : (vm.person?.name ?? 'Pessoa')}</S.Title>
            <S.SubTitle>
              {vm.formData.type === 'Pessoa Física'
                ? <><RiUserLine size={13} /> Pessoa Física</>
                : <><RiBuildingLine size={13} /> Pessoa Jurídica</>}
            </S.SubTitle>
            {!vm.isNew && appliedTags.length > 0 && (
              <S.Tags>
                {appliedTags.map((t) => (
                  <S.TagPill key={t.id} $color={t.color}>
                    <S.TagDot $color={t.color} />
                    {t.name}
                  </S.TagPill>
                ))}
              </S.Tags>
            )}
          </S.HeaderInfo>
        </S.HeaderLeft>

        <S.HeaderActions>
          {!vm.isNew && (
            <>
              <Button variant="ghost" size="sm" onClick={vm.handleCopyDeepLink} title="Copiar link">
                {vm.copyLinkDone ? <RiCheckLine size={14} /> : <RiLinkM size={14} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={vm.handleClone} title="Clonar">
                <RiFileCopyLine size={14} />
              </Button>
              <Button variant="ghost" size="sm" title={vm.person?.status === 'Ativo' ? 'Inativar' : 'Ativar'} onClick={() => void vm.handleToggleStatus()}>
                <S.ToggleIcon $enabled={vm.person?.status === 'Ativo'}>
                  <RiToggleLine size={14} />
                </S.ToggleIcon>
              </Button>
              <Button variant="ghost" size="sm" title="Gerenciar etiquetas" onClick={vm.openTagManager}>
                <RiPriceTag3Line size={14} />
              </Button>
            </>
          )}
          {(vm.activeTab === 'data' || vm.isNew) && (
            <S.SaveBtn onClick={() => void vm.handleSave()} disabled={vm.isSaving} title={vm.isSaving ? 'Salvando...' : 'Salvar'}>
              <RiSaveLine size={14} />
            </S.SaveBtn>
          )}
          {!vm.isNew && vm.isAdmin && (
            <S.DeleteBtn onClick={vm.handleDeletePerson} title="Excluir Pessoa">
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      {!vm.isNew && (
        <S.TabBar>
          <S.TabBtn $active={vm.activeTab === 'data'} onClick={() => vm.setActiveTab('data')}>Dados</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'notes'} onClick={() => vm.setActiveTab('notes')}>Anotações</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'documents'} onClick={() => vm.setActiveTab('documents')}>Documentos</S.TabBtn>
        </S.TabBar>
      )}

      <S.Content>
        {(vm.activeTab === 'data' || vm.isNew) && (
          <S.FormGrid>
            <S.FormGroup $fullWidth>
              <CustomFieldsSection
                screenKey="persons-native"
                fields={vm.nativeFields}
                values={vm.nativeValues}
                onChange={vm.setNativeFieldValue}
                lookupOptions={vm.personLookupOptions}
                onAddLookupOption={vm.handleAddPersonLookup}
                onDeleteLookupOption={vm.handleDeletePersonLookup}
                canDeleteLookupOption={vm.isAdmin}
              />
            </S.FormGroup>

            {vm.customFields.length > 0 && (
              <>
                <S.SectionTitle>Campos adicionais</S.SectionTitle>
                <S.FormGroup $fullWidth>
                  <CustomFieldsSection
                    screenKey="persons"
                    fields={vm.customFields}
                    values={vm.customValues}
                    onChange={vm.setCustomValue}
                  />
                </S.FormGroup>
              </>
            )}
          </S.FormGrid>
        )}

        {vm.activeTab === 'notes' && !vm.isNew && (
          <NotesPanel controller={vm.notesController} isAdmin={vm.isAdmin} />
        )}

        {vm.activeTab === 'documents' && !vm.isNew && (
          <DocumentsPanel controller={vm.docsController} isAdmin={vm.isAdmin} />
        )}
      </S.Content>

      {vm.isTagManagerOpen && vm.person && (
        <TagManager
          entityId={vm.person.id}
          onClose={vm.closeTagManager}
          adapter={vm.tagAdapter}
        />
      )}

      <ConfirmModal
        isOpen={!!vm.personToDelete}
        onConfirm={() => void vm.confirmDeletePerson()}
        onCancel={vm.cancelDeletePerson}
        title="Excluir Pessoa"
        message={`Tem certeza que deseja excluir "${vm.personToDelete?.name}"? Todos os dados da pessoa serão perdidos.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
