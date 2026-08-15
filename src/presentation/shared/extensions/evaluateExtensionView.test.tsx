// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { darkTheme } from '../../../shared/styles/theme';
import { evaluateExtensionView } from './evaluateExtensionView';

const renderThemed = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);

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
});
