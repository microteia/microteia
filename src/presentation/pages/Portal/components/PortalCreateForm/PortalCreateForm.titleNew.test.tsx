// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../../../shared/styles/theme';
import { PortalStoreContext, type PortalStoreValue } from '../../../../../stores/usePortal';
import { NotificationProvider } from '../../../../../stores/NotificationContext';
import type { PortalScreenInfo } from '../../../../../domain/entities/Portal';
import { PortalCreateForm } from './PortalCreateForm.view';

const replies = (titleNew?: string): PortalScreenInfo => ({
  id: 'replies',
  collection: 'replies',
  titleSingular: 'Reply',
  titlePlural: 'Replies',
  ...(titleNew ? { titleNew } : {}),
  icon: 'mail',
  documents: false,
  trackViews: false,
  actions: false,
  uploads: null,
  parent: { collection: 'notices' },
  fields: [],
  create: { fields: [], link: { collection: 'notices', label: 'Notice' } },
  edit: null,
}) as PortalScreenInfo;

const renderForm = (target: PortalScreenInfo) => {
  const store = { listLinkOptions: vi.fn(async () => []), submit: vi.fn(), update: vi.fn() } as unknown as PortalStoreValue;
  return render(
    <ThemeProvider theme={baseDarkTheme}>
      <PortalStoreContext.Provider value={store}>
        <NotificationProvider>
          <PortalCreateForm screen={target} fixedLinkRecordId="n1" editing={null} onCancel={() => undefined} onSubmitted={() => undefined} />
        </NotificationProvider>
      </PortalStoreContext.Provider>
    </ThemeProvider>,
  );
};

describe('o cabeçalho do formulário de criação do portal (#56)', () => {
  afterEach(cleanup);

  it('usa a frase declarada do registro novo (`titleNew`), como o escritório', () => {
    renderForm(replies('Write a reply'));
    expect(screen.getByText('Write a reply')).toBeTruthy();
    expect(screen.queryByText('core.tenant/portal.create.title')).toBeNull();
  });

  it('sem `titleNew`, continua a frase do catálogo com o singular', () => {
    renderForm(replies());
    // Sem o provedor de idioma, o catálogo responde pela chave.
    expect(screen.getByText('core.tenant/portal.create.title')).toBeTruthy();
    expect(screen.queryByText('Write a reply')).toBeNull();
  });
});
