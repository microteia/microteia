import React from 'react';
import { InfoBanner } from '../InfoBanner';
import { ReportView } from '../ReportView';
import { MarkdownContent } from '../MarkdownContent';
import type { WidgetSpec } from '../../../../domain/schema/ui/widgetSpec';
import { isWidgetSpec } from '../../../../domain/schema/ui/widgetSpec';
import { useLabel } from '../../../shared/i18n/useT';
import { S } from './WidgetRenderer.styles';

interface WidgetRendererProps {
  spec: unknown;
}

/**
 * Renderiza um WidgetSpec recursivamente. Nó desconhecido ou malformado é IGNORADO (não quebra a
 * tela) — um plugin escrito para uma versão mais nova do DSL degrada, não derruba o app. Zero
 * `dangerouslySetInnerHTML`, zero estilo vindo do plugin: cada nó é um componente do Microteia.
 *
 * Todo texto do spec passa por `resolveLabel` antes de aparecer. É a MESMA regra do rótulo de tela e
 * de campo, e por isso não introduz um caminho novo: `@ns/chave` traduz, texto comum passa intacto.
 * Sem isto o DSL era o único lugar declarativo onde a frase tinha de nascer num idioma — o que deixava
 * a apresentação de uma extensão e a tela que ela declara sob regras diferentes.
 */
export const WidgetRenderer: React.FC<WidgetRendererProps> = ({ spec }) => {
  if (!isWidgetSpec(spec)) return null;
  return <WidgetNode node={spec} />;
};

const WidgetNode: React.FC<{ node: WidgetSpec }> = ({ node }) => {
  const label = useLabel();

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
      return <S.Heading>{label(node.text)}</S.Heading>;
    case 'text':
      return <S.Text $muted={node.muted ?? false}>{label(node.text)}</S.Text>;
    case 'markdown':
      return (
        <S.Markdown>
          <MarkdownContent>{label(node.content)}</MarkdownContent>
        </S.Markdown>
      );
    case 'metric':
      return (
        <S.Metric>
          <S.MetricValue>{label(node.value)}</S.MetricValue>
          <S.MetricLabel>{label(node.label)}</S.MetricLabel>
        </S.Metric>
      );
    case 'keyValue':
      return (
        <S.KeyValue>
          {node.items.map((item, index) => (
            <React.Fragment key={`${item.label}-${index}`}>
              <S.KvKey>{label(item.label)}</S.KvKey>
              <S.KvValue>{label(item.value)}</S.KvValue>
            </React.Fragment>
          ))}
        </S.KeyValue>
      );
    case 'banner':
      return <InfoBanner message={label(node.message)} variant={node.variant ?? 'info'} />;
    case 'divider':
      return <S.Divider />;
    case 'report':
      return <ReportView reportKey={node.report} />;
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
