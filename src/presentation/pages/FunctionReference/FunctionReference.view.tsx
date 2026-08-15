import React from 'react';
import { RiBookLine } from 'react-icons/ri';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { S } from './FunctionReference.styles';
import { useFunctionReferenceViewModel } from './FunctionReference.viewmodel';

import { useT, useLabel } from '../../shared/i18n/useT';
export const FunctionReferenceView: React.FC = () => {
  const t = useT('core.automation');
  const label = useLabel();
  const vm = useFunctionReferenceViewModel();

  if (vm.loading) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>
            <RiBookLine size={22} />
            {t('page.function-reference')}
          </S.Title>
        </S.Header>
        <S.Content>
          <S.EmptyState>{t('functions.loading')}</S.EmptyState>
        </S.Content>
      </S.Page>
    );
  }

  if (vm.error) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>
            <RiBookLine size={22} />
            {t('page.function-reference')}
          </S.Title>
        </S.Header>
        <S.Content>
          <S.EmptyState>{t('functions.load-failed', { detail: vm.error })}</S.EmptyState>
        </S.Content>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.Title>
          <RiBookLine size={22} />
          {t('page.function-reference')}
        </S.Title>
      </S.Header>

      <S.Content>
        <S.FilterContainer>
          <CompositeFilter
            defs={vm.filterDefs}
            tokens={vm.filterTokens}
            onChange={vm.setFilterTokens}
            placeholder={t('functions.filter.placeholder')}
          />
        </S.FilterContainer>

        {vm.filteredFunctions.length > 0 ? (
          <S.FunctionGrid>
            {vm.filteredFunctions.map((fn) => (
              <S.FunctionCard key={fn.name}>
                <S.FunctionHeader>
                  <S.FunctionName>{fn.name}</S.FunctionName>
                  <S.CategoryBadge>{label(fn.category)}</S.CategoryBadge>
                </S.FunctionHeader>
                <S.Signature>{fn.signature}</S.Signature>
                <S.Description>{label(fn.description)}</S.Description>
                <S.ExampleLabel>{t('functions.example')}</S.ExampleLabel>
                <S.Example>{fn.example}</S.Example>
              </S.FunctionCard>
            ))}
          </S.FunctionGrid>
        ) : (
          <S.EmptyState>{t('functions.none-found')}</S.EmptyState>
        )}
      </S.Content>
    </S.Page>
  );
};
