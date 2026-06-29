import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { MarkdownLink } from '../MarkdownLink';

const components = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: (props: any) => <MarkdownLink href={props.href}>{props.children}</MarkdownLink>,
};

export interface MarkdownContentProps {
  children: string;
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ children }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw]}
    components={components}
  >
    {children}
  </ReactMarkdown>
);
