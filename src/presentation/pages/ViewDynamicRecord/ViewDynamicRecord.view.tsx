import React from 'react';
import { RiDeleteBinLine, RiFileCopyLine, RiSaveLine } from 'react-icons/ri';
import { S } from './ViewDynamicRecord.styles';
import { useViewDynamicRecordViewModel } from './ViewDynamicRecord.viewmodel';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { getScreenIcon } from '../../shared/screenIcons';

export const ViewDynamicRecordView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewDynamicRecordViewModel(tabKey);
  const definition = vm.definition;

  if (!vm.isAvailable || !definition) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>Registro</S.Title>
        </S.Header>
        <S.BannerWrapper>
          {vm.isLoadingDefinition ? (
            <S.SpinnerWrapper><Spinner /></S.SpinnerWrapper>
          ) : (
            <InfoBanner
              variant="info"
              message="Esta tela personalizada não está mais disponível. Ela pode ter sido desativada ou excluída pelo administrador."
            />
          )}
        </S.BannerWrapper>
      </S.Page>
    );
  }

  if (vm.recordNotFound) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>{definition.titleSingular}</S.Title>
        </S.Header>
        <S.BannerWrapper>
          <InfoBanner variant="info" message="Registro não encontrado. Ele pode ter sido excluído." />
        </S.BannerWrapper>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.TitleRow>
          {getScreenIcon(definition.icon, 22)}
          <S.Title>{vm.isNew ? `Novo ${definition.titleSingular}` : definition.titleSingular}</S.Title>
        </S.TitleRow>
        <S.HeaderActions>
          {!vm.isNew && (
            <Button variant="secondary" onClick={vm.handleClone}>
              <RiFileCopyLine size={16} />
              Clonar
            </Button>
          )}
          {!vm.isNew && vm.isAdmin && (
            <Button variant="danger" onClick={vm.requestDelete}>
              <RiDeleteBinLine size={16} />
              Excluir
            </Button>
          )}
          <Button onClick={() => void vm.handleSave()} disabled={vm.isSaving} $isLoading={vm.isSaving}>
            <RiSaveLine size={16} />
            Salvar
          </Button>
        </S.HeaderActions>
      </S.Header>

      <S.Content>
        <S.FormWrapper>
          <CustomFieldsSection
            screenKey={vm.screenKey}
            fields={vm.sortedFields}
            values={vm.formValues}
            onChange={vm.setFieldValue}
          />
        </S.FormWrapper>
      </S.Content>

      <ConfirmModal
        isOpen={vm.recordToDelete !== null}
        title="Excluir registro"
        message={`Tem certeza que deseja excluir "${vm.recordToDelete?.title ?? ''}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        loading={vm.isDeleting}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
      />
    </S.Page>
  );
};
