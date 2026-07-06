import React from 'react';
import { RiBookLine } from 'react-icons/ri';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { S } from './FunctionReference.styles';
import { useFunctionReferenceViewModel } from './FunctionReference.viewmodel';

export const FunctionReferenceView: React.FC = () => {
  const vm = useFunctionReferenceViewModel();

  console.log('[FunctionReference] Rendering:', {
    filterDefs: vm.filterDefs.length,
    filteredFunctions: vm.filteredFunctions.length
  });

  return (
    <S.Page>
      <S.Header>
        <S.Title>
          <RiBookLine size={22} />
          Referência de Expressões
        </S.Title>
      </S.Header>

      <S.Content>
        <S.FilterContainer>
          <CompositeFilter
            defs={vm.filterDefs}
            tokens={vm.filterTokens}
            onChange={vm.setFilterTokens}
            placeholder="Buscar funções..."
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
          <S.EmptyState>
            Nenhuma função encontrada com os filtros aplicados.
          </S.EmptyState>
        )}
      </S.Content>
    </S.Page>
  );
};
