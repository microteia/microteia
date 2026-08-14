import React from 'react';
import { Modal } from '../../../Modal';
import { CompositeFilter } from '../../../CompositeFilter';
import { S } from './FunctionReferenceModal.styles';
import { useFunctionReferenceModalViewModel } from './FunctionReferenceModal.viewmodel';

import { useT } from '../../../../../shared/i18n/useT';
export interface FunctionReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FunctionReferenceModal: React.FC<FunctionReferenceModalProps> = ({ isOpen, onClose }) => {
  const vm = useFunctionReferenceModalViewModel();
  const t = useT('core.ui');
  if (!isOpen) return null;

  return (
    <Modal title={t('core.automation/page.function-reference')} onClose={onClose} size="large">
      <S.FilterContainer>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder={t('expression.reference.search')}
        />
      </S.FilterContainer>

      {vm.filteredFunctions.length > 0 ? (
        <S.FunctionGrid>
          {vm.filteredFunctions.map((fn) => (
            <S.FunctionCard key={fn.name}>
              <S.FunctionHeader>
                <S.FunctionName>{fn.name}</S.FunctionName>
                <S.CategoryBadge>{fn.category}</S.CategoryBadge>
              </S.FunctionHeader>
              <S.Signature>{fn.signature}</S.Signature>
              <S.Description>{fn.description}</S.Description>
              <S.ExampleLabel>Exemplo</S.ExampleLabel>
              <S.Example>{fn.example}</S.Example>
            </S.FunctionCard>
          ))}
        </S.FunctionGrid>
      ) : (
        <S.EmptyState>{t('expression.reference.none-found')}</S.EmptyState>
      )}
    </Modal>
  );
};
