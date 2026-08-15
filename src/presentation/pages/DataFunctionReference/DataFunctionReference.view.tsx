import React from 'react';
import { RiDatabase2Line } from 'react-icons/ri';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { S } from './DataFunctionReference.styles';
import { useDataFunctionReferenceViewModel } from './DataFunctionReference.viewmodel';

import { useT, useLabel } from '../../shared/i18n/useT';
export const DataFunctionReferenceView: React.FC = () => {
  const t = useT('core.automation');
  const label = useLabel();
  const vm = useDataFunctionReferenceViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>
          <RiDatabase2Line size={22} />
          {t('page.data-function-reference')}
        </S.Title>
      </S.Header>

      <S.Content>
        <S.Intro>{t('data-fn.intro')}</S.Intro>

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

                <S.SubLabel>{t('data-fn.params')}</S.SubLabel>
                <S.ParamList>
                  {fn.params.map((param) => (
                    <S.ParamItem key={param.name}>
                      <code>{param.name}</code> — {label(param.description)}
                    </S.ParamItem>
                  ))}
                </S.ParamList>

                <S.SubLabel>{t('data-fn.returns')}</S.SubLabel>
                <S.Description>{label(fn.returns)}</S.Description>

                <S.SubLabel>{t('functions.example')}</S.SubLabel>
                <S.ExampleWrap>
                  <S.Example>{fn.example}</S.Example>
                </S.ExampleWrap>
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
