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

  children: React.ReactNode;
  modals?: React.ReactNode;
}

export const EntityListView: React.FC<EntityListViewProps> = ({
  title,
  titleIcon,
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
  children,
  modals,
}) => {
  const addIcon = newIcon ?? <RiAddLine size={16} />;
  return (
    <S.Page>
      <S.Header>
        {titleIcon ? (
          <S.TitleRow>
            {titleIcon}
            <S.Title>{title}</S.Title>
          </S.TitleRow>
        ) : (
          <S.Title>{title}</S.Title>
        )}
        <Button onClick={onNew} title={newTitle}>{addIcon}</Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={filterDefs}
          tokens={filterTokens}
          onChange={onFilterChange}
          placeholder={filterPlaceholder}
          screenKey={savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {isLoading ? (
          <S.SpinnerWrap><Spinner /></S.SpinnerWrap>
        ) : isEmpty ? (
          <S.EmptyState>
            <S.EmptyIcon>{emptyIcon}</S.EmptyIcon>
            <S.EmptyTitle>{emptyTitle}</S.EmptyTitle>
            <Button onClick={onNew} variant="secondary">
              {addIcon}
              {emptyActionLabel}
            </Button>
          </S.EmptyState>
        ) : (
          <S.Grid>{children}</S.Grid>
        )}
      </S.Content>

      {modals}
    </S.Page>
  );
};
