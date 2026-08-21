// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../shared/styles/theme';
import { evaluateExtensionView } from './evaluateExtensionView';

const renderThemed = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={baseDarkTheme}>{ui}</ThemeProvider>);

describe('evaluateExtensionView', () => {
  it('compila uma view TSX com JSX e devolve um componente renderizável', () => {
    const source = `
      export default function View() {
        return <div>olá extensão</div>;
      }
    `;
    const Component = evaluateExtensionView('t::ok', source);
    expect(typeof Component).toBe('function');
    const { getByText } = renderThemed(<Component tabKey="t" />);
    expect(getByText('olá extensão')).toBeTruthy();
  });

  it('resolve imports da API curada do host (react)', () => {
    const source = `
      import { useState } from 'react';
      export default function View() {
        const [n] = useState(7);
        return <span>valor {n}</span>;
      }
    `;
    const Component = evaluateExtensionView('t::react', source);
    const { getByText } = renderThemed(<Component tabKey="t" />);
    expect(getByText(/valor 7/)).toBeTruthy();
  });

  it('require de módulo fora da superfície vira fallback (não lança)', () => {
    const source = `
      import { qualquer } from 'node:fs';
      export default () => <div>{qualquer}</div>;
    `;
    const Component = evaluateExtensionView('t::forbidden', source);
    const { getByText } = renderThemed(<Component tabKey="t" />);
    expect(getByText(/core\.marketplace\/extension\.load-failed/)).toBeTruthy();
  });

  it('fonte que não exporta componente vira fallback', () => {
    const Component = evaluateExtensionView('t::noexport', 'export const x = 1;');
    const { getByText } = renderThemed(<Component tabKey="t" />);
    expect(getByText(/core\.marketplace\/extension\.load-failed/)).toBeTruthy();
  });

  it('memoiza por cacheKey e reavalia quando a fonte muda', () => {
    const a = evaluateExtensionView('t::memo', 'export default () => null;');
    const again = evaluateExtensionView('t::memo', 'export default () => null;');
    expect(again).toBe(a);
    const changed = evaluateExtensionView('t::memo', 'export default function V() { return null; }');
    expect(changed).not.toBe(a);
  });
  /**
   * O compilador do SDK aceita uma LISTA de arquivos por view e os funde num módulo só, para que a
   * extensão possa ser escrita em MVVM. Quem tem de aceitar o resultado é este avaliador: a fusão
   * repete o import de `react` (um por arquivo) e junta escopos que nasceram separados. Este caso é a
   * forma exata do que a fusão produz — se ele parar de renderizar, o pacote fundido não abre a tela.
   */
  it('renderiza a fonte FUNDIDA de uma view escrita em vários arquivos', () => {
    const source = [
      '// --- ./Panel.view.tsx ---',
      "import { useMemo } from 'react';",
      'export default function Panel() {',
      '  const total = useTally();',
      '  return <Wrap>{useMemo(() => total, [total])}</Wrap>;',
      '}',
      '// --- ./Panel.viewmodel.tsx ---',
      "import { useMemo } from 'react';",
      'export const useTally = () => useMemo(() => 7, []);',
      '// --- ./Panel.styles.tsx ---',
      "import { styled } from 'styled-components';",
      'export const Wrap = styled.div`padding: 8px;`;',
    ].join('\n');

    const Component = evaluateExtensionView('t::merged', source);
    const { getByText } = renderThemed(<Component tabKey="t" />);
    expect(getByText('7')).toBeTruthy();
  });
});
