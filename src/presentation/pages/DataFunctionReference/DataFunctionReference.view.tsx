import React from 'react';
import { RiDatabase2Line } from 'react-icons/ri';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { S } from './DataFunctionReference.styles';
import { useDataFunctionReferenceViewModel } from './DataFunctionReference.viewmodel';

export const DataFunctionReferenceView: React.FC = () => {
  const vm = useDataFunctionReferenceViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>
          <RiDatabase2Line size={22} />
          Funções de Dados
        </S.Title>
      </S.Header>

      <S.Content>
        <S.Intro>
          Funções disponíveis dentro de um Script para acessar os dados do escritório. Em todas elas, o escritório atual
          é aplicado automaticamente — não é possível acessar dados de outro escritório.
        </S.Intro>

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

                <S.SubLabel>Parâmetros</S.SubLabel>
                <S.ParamList>
                  {fn.params.map((param) => (
                    <S.ParamItem key={param.name}>
                      <code>{param.name}</code> — {param.description}
                    </S.ParamItem>
                  ))}
                </S.ParamList>

                <S.SubLabel>Retorno</S.SubLabel>
                <S.Description>{fn.returns}</S.Description>

                <S.SubLabel>Exemplo</S.SubLabel>
                <S.ExampleWrap>
                  <S.Example>{fn.example}</S.Example>
                </S.ExampleWrap>
              </S.FunctionCard>
            ))}
          </S.FunctionGrid>
        ) : (
          <S.EmptyState>Nenhuma função encontrada com os filtros aplicados.</S.EmptyState>
        )}
      </S.Content>
    </S.Page>
  );
};
