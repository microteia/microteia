import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { ExternalMarkdownLink, MarkdownLink } from '../MarkdownLink';
import { CopyButton } from '../CopyButton';
import { S } from './MarkdownContent.styles';

const components = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: (props: any) => <MarkdownLink href={props.href}>{props.children}</MarkdownLink>,
};

const untrustedComponents = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: (props: any) => <ExternalMarkdownLink href={props.href}>{props.children}</ExternalMarkdownLink>,
};

interface HastNode {
  type?: string;
  value?: string;
  children?: HastNode[];
}

/** O texto de um nó da árvore do Markdown — o que o bloco de código mostra, sem marcação. */
const textOf = (node: HastNode | undefined): string =>
  !node ? '' : node.type === 'text' ? node.value ?? '' : (node.children ?? []).map(textOf).join('');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CopyablePre = (props: any) => (
  <S.CodeBlock>
    <pre>{props.children}</pre>
    <S.CopyCorner>
      <CopyButton text={textOf(props.node as HastNode).replace(/\n$/, '')} size={13} />
    </S.CopyCorner>
  </S.CodeBlock>
);

/**
 * Sem HTML e sem imagem no texto que não é do escritório. O HTML cru desenharia o que o pacote quisesse —
 * um formulário, uma moldura por cima da página — na tela de quem é de fora; a imagem de outro endereço
 * contaria a esse endereço quem abriu a página.
 */
const UNTRUSTED_DISALLOWED = ['img'];

export interface MarkdownContentProps {
  children: string;
  /**
   * O texto veio de fora do escritório (o de um pacote, no portal): sem HTML, sem imagem, e todo link
   * externo. Ausente, o Markdown do escritório — com HTML, como o editor de notas o grava.
   */
  untrusted?: boolean;
  /**
   * Com `untrusted`: os links do PRÓPRIO app (`/microteia/...`) abrem a aba, como no Markdown do
   * escritório. É o caso do texto escrito por uma IA para quem está dentro do escritório — o HTML e a
   * imagem continuam barrados, mas o link para um registro é justamente o que a resposta quer dar.
   */
  internalLinks?: boolean;
  /** Um botão de copiar em cada bloco de código — o comando, a consulta ou o trecho que a pessoa vai colar. */
  copyableCode?: boolean;
}

const withCopy = <T extends object>(base: T): T & { pre: typeof CopyablePre } => ({ ...base, pre: CopyablePre });
const copyableComponents = withCopy(components);
const copyableUntrustedComponents = withCopy(untrustedComponents);

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ children, untrusted, internalLinks, copyableCode }) => (
  untrusted ? (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      disallowedElements={UNTRUSTED_DISALLOWED}
      unwrapDisallowed
      components={internalLinks
        ? (copyableCode ? copyableComponents : components)
        : (copyableCode ? copyableUntrustedComponents : untrustedComponents)}
    >
      {children}
    </ReactMarkdown>
  ) : (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={components}
    >
      {children}
    </ReactMarkdown>
  )
);
