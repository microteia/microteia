import React from 'react';
import { InfoBanner } from '../InfoBanner';
import { MarkdownContent } from '../MarkdownContent';
import type { WidgetSpec } from '../../../shared/widget/widgetSpec';
import { isWidgetSpec } from '../../../shared/widget/widgetSpec';
import { S } from './WidgetRenderer.styles';

interface WidgetRendererProps {
  spec: unknown;
}

/**
 * Renderiza um WidgetSpec recursivamente. Nó desconhecido ou malformado é IGNORADO (não quebra a
 * tela) — um plugin escrito para uma versão mais nova do DSL degrada, não derruba o app. Zero
 * `dangerouslySetInnerHTML`, zero estilo vindo do plugin: cada nó é um componente do Curatino.
 */
export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ spec }) => {
  if (!isWidgetSpec(spec)) return null;
  return <WidgetNode node={spec} />;
};

const WidgetNode: React.FC<{ node: WidgetSpec }> = ({ node }) => {
  switch (node.type) {
    case 'stack':
      return (
        <S.Stack $gap={node.gap ?? 'md'}>
          <Children nodes={node.children} />
        </S.Stack>
      );
    case 'grid':
      return (
        <S.Grid $columns={Math.max(1, node.columns ?? 2)}>
          <Children nodes={node.children} />
        </S.Grid>
      );
    case 'heading':
      return <S.Heading>{node.text}</S.Heading>;
    case 'text':
      return <S.Text $muted={node.muted ?? false}>{node.text}</S.Text>;
    case 'markdown':
      return (
        <S.Markdown>
          <MarkdownContent>{node.content}</MarkdownContent>
        </S.Markdown>
      );
    case 'metric':
      return (
        <S.Metric>
          <S.MetricValue>{node.value}</S.MetricValue>
          <S.MetricLabel>{node.label}</S.MetricLabel>
        </S.Metric>
      );
    case 'keyValue':
      return (
        <S.KeyValue>
          {node.items.map((item, index) => (
            <React.Fragment key={`${item.label}-${index}`}>
              <S.KvKey>{item.label}</S.KvKey>
              <S.KvValue>{item.value}</S.KvValue>
            </React.Fragment>
          ))}
        </S.KeyValue>
      );
    case 'banner':
      return <InfoBanner message={node.message} variant={node.variant ?? 'info'} />;
    case 'divider':
      return <S.Divider />;
  }
};

const Children: React.FC<{ nodes: WidgetSpec[] }> = ({ nodes }) => (
  <>
    {(Array.isArray(nodes) ? nodes : [])
      .filter(isWidgetSpec)
      .map((child, index) => (
        <WidgetNode key={index} node={child} />
      ))}
  </>
);
