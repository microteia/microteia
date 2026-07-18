import React from 'react';
import { S } from './EntityListCard.styles';

export interface EntityCardAction {
  key: string;
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}

export interface EntityCardMetaRow {
  key: string;
  icon?: React.ReactNode;
  value: React.ReactNode;
}

export interface EntityCardTag {
  id: string;
  name: string;
  color: string;
}

export interface EntityListCardProps {
  avatar: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: EntityCardAction[];
  metaRows: EntityCardMetaRow[];
  tags?: EntityCardTag[];
  /** Conteúdo exclusivo da tela, logo abaixo do cabeçalho e antes das meta-linhas
   *  (ex.: badges de status/fase e os polos do Processo). */
  belowHeader?: React.ReactNode;
  /** Conteúdo exclusivo após as meta-linhas (ex.: campos adicionais). */
  extra?: React.ReactNode;
  /** Conteúdo exclusivo no rodapé, após as etiquetas (ex.: o valor do lançamento). */
  footer?: React.ReactNode;
  /** Faixa lateral colorida — leitura rápida de severidade (ex.: prioridade do Prazo). */
  accentColor?: string;
  onClick?: () => void;
}

export const EntityListCard: React.FC<EntityListCardProps> = ({
  avatar,
  title,
  subtitle,
  actions,
  metaRows,
  tags,
  belowHeader,
  extra,
  footer,
  accentColor,
  onClick,
}) => (
  <S.Card onClick={onClick} $accent={accentColor}>
    {actions && actions.length > 0 && (
      <S.Actions onClick={(e) => e.stopPropagation()}>
        {actions.map((action) => (
          <S.ActionButton
            key={action.key}
            type="button"
            title={action.title}
            $danger={action.danger}
            onClick={action.onClick}
          >
            {action.icon}
          </S.ActionButton>
        ))}
      </S.Actions>
    )}

    <S.Header>
      <S.Avatar>{avatar}</S.Avatar>
      <S.HeaderInfo>
        <S.Title>{title}</S.Title>
        {subtitle && <S.Subtitle>{subtitle}</S.Subtitle>}
      </S.HeaderInfo>
    </S.Header>

    {belowHeader}

    {metaRows.length > 0 && (
      <S.Meta>
        {metaRows.map((row) => (
          <S.MetaRow key={row.key}>
            {row.icon}
            {row.value}
          </S.MetaRow>
        ))}
      </S.Meta>
    )}

    {extra}

    {tags && tags.length > 0 && (
      <S.Tags onClick={(e) => e.stopPropagation()}>
        {tags.map((tag) => (
          <S.TagPill key={tag.id} $color={tag.color}>
            <S.TagDot $color={tag.color} />
            {tag.name}
          </S.TagPill>
        ))}
      </S.Tags>
    )}

    {footer}
  </S.Card>
);
