import React from 'react';
import { Badge } from '../Badge';
import { MarkdownContent } from '../MarkdownContent';
import { CustomFieldMetaRows } from '../CustomFieldMetaRows';
import { UserAvatar } from '../UserAvatar';
import { getScreenIcon } from '../../../shared/screenIcons';
import { S } from './RecordCardTemplate.styles';
import { useRecordCardTemplateViewModel } from './RecordCardTemplate.viewmodel';
import type { RecordCardTemplateProps, RecordCardTemplateViewModel } from './RecordCardTemplate.viewmodel';
import type { ResolvedCardNode } from '../../../shared/entityScreen/resolveCardTemplate';
import type { RecordCardAction } from '../../../shared/entityScreen/useRecordListViewModel';

const ActionButtons: React.FC<{ actions: RecordCardAction[] }> = ({ actions }) => (
  <>
    {actions.map((action) => (
      <S.ActionButton
        key={action.key}
        type="button"
        title={action.title}
        $danger={action.danger}
        disabled={action.disabled}
        onClick={action.onClick}
      >
        {action.active === undefined
          ? (action.iconKey ? getScreenIcon(action.iconKey, 14) : null)
          : <S.ToggleIcon $on={action.active}>{action.iconKey ? getScreenIcon(action.iconKey, 14) : null}</S.ToggleIcon>}
      </S.ActionButton>
    ))}
  </>
);

const CardNodeView: React.FC<{ node: ResolvedCardNode; vm: RecordCardTemplateViewModel }> = ({ node, vm }) => {
  switch (node.kind) {
    case 'row':
      return (
        <S.Row $gap={node.gap} $align={node.align} $justify={node.justify} $wrap={node.wrap}>
          {node.children.map((child) => <CardNodeView key={child.key} node={child} vm={vm} />)}
        </S.Row>
      );
    case 'stack':
      return (
        <S.Stack $gap={node.gap}>
          {node.children.map((child) => <CardNodeView key={child.key} node={child} vm={vm} />)}
        </S.Stack>
      );
    case 'spacer':
      return <S.Spacer />;
    case 'divider':
      return <S.Divider />;
    case 'avatar':
      return (
        <S.SizedAvatar $size={node.size}>
          {node.imageUrl
            ? <UserAvatar src={node.imageUrl} name={node.name} size={vm.avatarPixels[node.size]} fallback={getScreenIcon(vm.screenIcon, 22)} />
            : getScreenIcon(vm.screenIcon, 22)}
        </S.SizedAvatar>
      );
    case 'title':
      return <S.SizedTitle $size={node.size}>{node.text}</S.SizedTitle>;
    case 'subtitle':
      return (
        <S.Subtitle>
          {node.iconKey && getScreenIcon(node.iconKey, 12)}
          {node.text}
        </S.Subtitle>
      );
    case 'field':
      return (
        <S.Field $variant={node.variant} $size={node.size}>
          {node.iconKey && getScreenIcon(node.iconKey, 12)}
          {node.label && <S.FieldLabel>{node.label}:</S.FieldLabel>}
          {node.item.badges && node.item.badges.length > 0 ? (
            <S.BadgeWrap>
              {node.item.badges.map((badge, index) => (
                <Badge key={`${node.key}-${index}`} color={badge.color}>{badge.label}</Badge>
              ))}
            </S.BadgeWrap>
          ) : node.item.type === 'markdown' ? (
            <MarkdownContent>{node.item.value}</MarkdownContent>
          ) : (
            <S.FieldValue>{node.item.value}</S.FieldValue>
          )}
        </S.Field>
      );
    case 'fields':
      return <CustomFieldMetaRows items={node.items} />;
    case 'metaRows':
      return (
        <S.Meta>
          {node.rows.map((row) => (
            <S.MetaRow key={row.key}>
              {row.iconKey && getScreenIcon(row.iconKey, 12)}
              {row.value}
            </S.MetaRow>
          ))}
        </S.Meta>
      );
    case 'tags':
      return (
        <S.Tags onClick={(event) => event.stopPropagation()}>
          {node.tags.map((tag) => (
            <S.TagPill key={tag.id} $color={tag.color}>
              <S.TagDot $color={tag.color} />
              {tag.name}
            </S.TagPill>
          ))}
        </S.Tags>
      );
    case 'actions':
      return node.placement === 'hover' ? (
        <S.Actions onClick={(event) => event.stopPropagation()}>
          <ActionButtons actions={node.actions} />
        </S.Actions>
      ) : (
        <S.InlineActions onClick={(event) => event.stopPropagation()}>
          <ActionButtons actions={node.actions} />
        </S.InlineActions>
      );
    case 'text':
      return <S.Text $tone={node.tone} $size={node.size}>{node.text}</S.Text>;
    case 'icon':
      return <S.Icon $tone={node.tone}>{getScreenIcon(node.iconKey, 14)}</S.Icon>;
    default:
      return null;
  }
};

/**
 * O cartão de um registro desenhado pela declaração da tela (`cardTemplate`). Mesma casca, mesmos
 * átomos e mesmas ações do cartão padrão — só o arranjo muda.
 */
export const RecordCardTemplate: React.FC<RecordCardTemplateProps> = (props) => {
  const vm = useRecordCardTemplateViewModel(props);
  return (
    <S.Card onClick={vm.onOpen} $accent={vm.accentColor}>
      {vm.nodes.map((node) => <CardNodeView key={node.key} node={node} vm={vm} />)}
    </S.Card>
  );
};
