import React from 'react';
import { RiEditLine } from 'react-icons/ri';
import { S } from './PortalTemplateNodes.styles';
import { S as CardList } from '../PortalCardList/PortalCardList.styles';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { getScreenIcon } from '../../../../shared/screenIcons';
import { PortalRecordActions } from '../PortalRecordActions';
import type { ResolvedPortalNode } from '../../resolvePortalTemplate';
import type { PortalFieldView } from '../../Portal.viewmodel';

export interface PortalTemplateNodesProps {
  nodes: ResolvedPortalNode[];
  /** O registro aberto: o botão de alterar. No cartão não há. */
  onEdit?: () => void;
  /** O registro aberto: de quem são as ações (`portal.actions`). No cartão não há. */
  actions?: { collection: string; recordId: string } | null;
  /** O widget declarado da home: abrir um registro da lista dele (`records`). */
  onOpen?: (collection: string, id: string) => void;
}

const FieldValue: React.FC<{ field: PortalFieldView }> = ({ field }) =>
  field.href ? (
    <S.Link href={field.href} target="_blank" rel="noopener noreferrer">{field.value}</S.Link>
  ) : (
    <>
      {field.color && <S.OptionDot $color={field.color} />}
      <S.FieldValue>{field.value}</S.FieldValue>
    </>
  );

const NodeView: React.FC<{ node: ResolvedPortalNode } & Omit<PortalTemplateNodesProps, 'nodes'>> = ({ node, onEdit, actions, onOpen }) => {
  const children = (list: ResolvedPortalNode[]) =>
    list.map((child) => <NodeView key={child.key} node={child} onEdit={onEdit} actions={actions} onOpen={onOpen} />);
  switch (node.kind) {
    case 'row':
      return <S.Row $gap={node.gap} $align={node.align} $justify={node.justify} $wrap={node.wrap}>{children(node.children)}</S.Row>;
    case 'stack':
      return <S.Stack $gap={node.gap}>{children(node.children)}</S.Stack>;
    case 'section':
      return (
        <S.Section $gap={node.gap}>
          {node.title && <S.SectionTitle>{node.title}</S.SectionTitle>}
          {children(node.children)}
        </S.Section>
      );
    case 'spacer':
      return <S.Spacer />;
    case 'divider':
      return <S.Divider />;
    case 'title':
      return <S.Title $size={node.size}>{node.text}</S.Title>;
    case 'field':
      return (
        <S.Field $variant={node.variant} $size={node.size}>
          {node.iconKey && getScreenIcon(node.iconKey, 14)}
          {node.label && <S.FieldLabel>{node.label}:</S.FieldLabel>}
          {node.variant === 'badge'
            ? <Badge color={node.field.color ?? undefined}>{node.field.value}</Badge>
            : <FieldValue field={node.field} />}
        </S.Field>
      );
    case 'fields':
      return (
        <S.Fields>
          {node.fields.map((field) => (
            <S.FieldsItem key={field.key}>
              <S.FieldsLabel>{field.label}</S.FieldsLabel>
              <S.FieldsValue><FieldValue field={field} /></S.FieldsValue>
            </S.FieldsItem>
          ))}
        </S.Fields>
      );
    case 'summary':
      return <S.Summary>{node.text}</S.Summary>;
    case 'updated':
      return <S.Updated>{node.text}</S.Updated>;
    case 'text':
      return <S.Text $tone={node.tone} $size={node.size}>{node.text}</S.Text>;
    case 'icon':
      return <S.Icon $tone={node.tone}>{getScreenIcon(node.iconKey, 14)}</S.Icon>;
    case 'edit':
      return onEdit ? (
        <Button size="sm" variant="secondary" onClick={onEdit}>
          <RiEditLine size={14} />
          {node.label}
        </Button>
      ) : null;
    case 'actions':
      return actions ? <PortalRecordActions {...actions} /> : null;
    case 'count':
      return <S.Count $tone={node.tone} $size={node.size}>{node.text}</S.Count>;
    case 'records':
      return node.cards.length === 0 ? (
        <S.Empty>{node.empty}</S.Empty>
      ) : (
        <CardList.List $layout={node.arrangement.layout} $minWidth={node.arrangement.minWidth}>
          {node.cards.map((card) => (
            <CardList.Card
              key={card.id}
              type="button"
              $accent={card.accentColor ?? undefined}
              onClick={() => onOpen?.(card.collection, card.id)}
            >
              {children(card.nodes ?? [])}
            </CardList.Card>
          ))}
        </CardList.List>
      );
    default:
      return null;
  }
};

/**
 * O desenho do portal declarado — pela tela (`portal.template`), já respondido para um registro, ou pelo
 * widget da home (`portalWidgetSpec`). Só desenha: o que aparece, com que valor e em que ordem veio
 * decidido de `resolvePortalNodes`.
 */
export const PortalTemplateNodes: React.FC<PortalTemplateNodesProps> = ({ nodes, onEdit, actions, onOpen }) => (
  <>
    {nodes.map((node) => <NodeView key={node.key} node={node} onEdit={onEdit} actions={actions} onOpen={onOpen} />)}
  </>
);
