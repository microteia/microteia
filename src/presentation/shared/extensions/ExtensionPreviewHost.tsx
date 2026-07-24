import React from 'react';
import { evaluateExtensionView } from './evaluateExtensionView';

/**
 * Renderiza a fonte de uma view de extensão AO VIVO durante a autoria — a mesma avaliação do runtime,
 * então o que se vê é o que roda. Deve ser embrulhado por um `ErrorBoundary` (com `key={source}` para
 * remontar a cada edição): um erro de render aqui não pode derrubar a tela "Criar extensão".
 *
 * O componente é COMPILADO da fonte do autor — dinâmico por natureza. `evaluateExtensionView` memoiza
 * por chave, então a referência é estável enquanto a fonte não muda (e o ErrorBoundary remonta quando
 * muda). Por isso a regra `static-components` é um falso-positivo aqui e é suprimida na linha.
 */
export const ExtensionPreviewHost: React.FC<{ source: string }> = ({ source }) =>
  React.createElement(evaluateExtensionView('__preview__', source), { tabKey: '__preview__' });
