import React from 'react';
import { RiCheckLine, RiCloseLine, RiForbidLine, RiLoader4Line, RiStackLine, RiTimeLine, RiToolsLine } from 'react-icons/ri';
import { MarkdownContent } from '../../ui/MarkdownContent';
import type { AssistantItem, AssistantToolStatus } from '../assistantItems';
import { S } from './AssistantMessage.styles';

export interface AssistantMessageLabels {
  toolLabel: (name: string) => string;
  statusLabel: (status: AssistantToolStatus) => string;
  interrupted: string;
  summaryTitle: string;
}

const STATUS_TONE: Record<AssistantToolStatus, 'muted' | 'success' | 'danger' | 'warning' | 'primary'> = {
  running: 'primary',
  done: 'success',
  failed: 'danger',
  declined: 'muted',
  awaiting: 'warning',
};

const StatusIcon: React.FC<{ status: AssistantToolStatus }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <S.Spin><RiLoader4Line size={13} /></S.Spin>;
    case 'done':
      return <RiCheckLine size={13} />;
    case 'failed':
      return <RiCloseLine size={13} />;
    case 'declined':
      return <RiForbidLine size={13} />;
    case 'awaiting':
      return <RiTimeLine size={13} />;
  }
};

/**
 * Um item da conversa. Só renderiza o que recebe: a pergunta, a resposta em Markdown (sem HTML e sem
 * imagem, com os links do app abrindo a aba), uma ferramenta como cartão recolhível e o resumo de uma
 * compactação.
 */
export const AssistantMessage: React.FC<{ item: AssistantItem; labels: AssistantMessageLabels }> = ({ item, labels }) => {
  switch (item.kind) {
    case 'user':
      return (
        <S.UserRow>
          <S.UserBubble>{item.text}</S.UserBubble>
        </S.UserRow>
      );
    case 'assistant':
      return (
        <div>
          <S.Answer $streaming={item.streaming}>
            <MarkdownContent untrusted internalLinks>{item.markdown}</MarkdownContent>
          </S.Answer>
          {item.interrupted && <S.Note>{labels.interrupted}</S.Note>}
        </div>
      );
    case 'tool':
      return (
        <S.Collapsible>
          <S.Summary>
            <RiToolsLine size={13} />
            <S.ToolName>{labels.toolLabel(item.name)}</S.ToolName>
            <S.Status $tone={STATUS_TONE[item.status]} title={labels.statusLabel(item.status)}>
              <StatusIcon status={item.status} />
            </S.Status>
          </S.Summary>
          <S.Code>{item.input}</S.Code>
        </S.Collapsible>
      );
    case 'summary':
      return (
        <S.Collapsible>
          <S.Summary>
            <RiStackLine size={13} />
            <S.ToolName>{labels.summaryTitle}</S.ToolName>
          </S.Summary>
          <S.SummaryBody>
            <S.Answer $streaming={false}>
              <MarkdownContent untrusted internalLinks>{item.markdown}</MarkdownContent>
            </S.Answer>
          </S.SummaryBody>
        </S.Collapsible>
      );
  }
};
