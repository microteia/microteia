import React from 'react';
import { RiAddLine } from 'react-icons/ri';
import { S } from './EntityListView.styles';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { CompositeFilter } from '../../ui/CompositeFilter';
import type { FilterDef, FilterToken } from '../../ui/CompositeFilter';

export interface EntityListViewProps {
  title: string;
  titleIcon?: React.ReactNode;
  /**
   * Peça colada ao TÍTULO — tipicamente um contador ("3 não lidas"). Diferente de `headerExtra`, que
   * fica do lado das ações: um número que qualifica a tela pertence ao nome dela, e ao lado do botão
   * "novo" ele se lê como parte do botão.
   */
  titleExtra?: React.ReactNode;
  onNew: () => void;
  newTitle: string;
  newIcon?: React.ReactNode;

  filterDefs: FilterDef[];
  filterTokens: FilterToken[];
  onFilterChange: (tokens: FilterToken[]) => void;
  filterPlaceholder: string;
  savedFiltersScreenKey: string;

  isLoading: boolean;
  isEmpty: boolean;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyActionLabel: string;

  /**
   * `'page'` (padrão) ocupa a janela inteira. `'embedded'` renderiza dentro de uma aba de detalhe:
   * sem título (o rótulo da aba já nomeia a tela), sem scroll próprio e sem padding lateral.
   */
  variant?: 'page' | 'embedded';

  /**
   * A tela CRIA registros. `false` some com o botão "novo" e com a chamada do estado vazio — é a
   * listagem cujos registros nascem fora dela: o e-mail que o tribunal manda, o registro que uma
   * automação grava. Botão que abriria um formulário sem sentido é pior do que botão nenhum.
   */
  canCreate?: boolean;

  /**
   * Como os cards se distribuem. `'grid'` (padrão) enche a largura com colunas de 320px — a forma de
   * um cadastro, cujo card é um resumo. `'list'` dá a largura INTEIRA a cada card, para a listagem
   * cujo card é uma peça de leitura: o e-mail de uma intimação não se lê em meia coluna.
   */
  layout?: 'grid' | 'list';
  /** Largura mínima da coluna na grade (`theme.listCard.minWidth`). Ausente = `md`, a de sempre. */
  cardMinWidth?: 'sm' | 'md' | 'lg';

  /** Ações extras no cabeçalho, antes do botão "novo" (ex.: Dashboard, ocultar totais). */
  headerExtra?: React.ReactNode;
  /** Faixa entre o cabeçalho e o filtro (ex.: barra de totais do Financeiro). */
  belowHeader?: React.ReactNode;

  children: React.ReactNode;
  modals?: React.ReactNode;
}

export const EntityListView: React.FC<EntityListViewProps> = ({
  title,
  titleIcon,
  titleExtra,
  onNew,
  newTitle,
  newIcon,
  filterDefs,
  filterTokens,
  onFilterChange,
  filterPlaceholder,
  savedFiltersScreenKey,
  isLoading,
  isEmpty,
  emptyIcon,
  emptyTitle,
  emptyActionLabel,
  variant = 'page',
  layout = 'grid',
  cardMinWidth = 'md',
  canCreate = true,
  headerExtra,
  belowHeader,
  children,
  modals,
}) => {
  const addIcon = newIcon ?? <RiAddLine size={16} />;
  const embedded = variant === 'embedded';
  return (
    <S.Page $embedded={embedded}>
      <S.Header $embedded={embedded}>
        {!embedded && (
          <S.TitleRow>
            {titleIcon}
            <S.Title>{title}</S.Title>
            {titleExtra}
          </S.TitleRow>
        )}
        <S.HeaderActions>
          {headerExtra}
          {canCreate && <Button onClick={onNew} title={newTitle}>{addIcon}</Button>}
        </S.HeaderActions>
      </S.Header>

      {belowHeader}

      <S.Toolbar $embedded={embedded}>
        <CompositeFilter
          defs={filterDefs}
          tokens={filterTokens}
          onChange={onFilterChange}
          placeholder={filterPlaceholder}
          screenKey={savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content $embedded={embedded}>
        {isLoading ? (
          <S.SpinnerWrap><Spinner /></S.SpinnerWrap>
        ) : isEmpty ? (
          <S.EmptyState>
            <S.EmptyIcon>{emptyIcon}</S.EmptyIcon>
            <S.EmptyTitle>{emptyTitle}</S.EmptyTitle>
            {canCreate && (
              <Button onClick={onNew} variant="secondary">
                {addIcon}
                {emptyActionLabel}
              </Button>
            )}
          </S.EmptyState>
        ) : (
          <S.Grid $layout={layout} $minWidth={cardMinWidth}>{children}</S.Grid>
        )}
      </S.Content>

      {modals}
    </S.Page>
  );
};
