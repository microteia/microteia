// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../shared/styles/theme';
import { PortalStoreContext, type PortalStoreValue } from '../../../stores/usePortal';
import { PortalNavigationContext, type PortalNavigationValue } from '../../../stores/usePortalNavigation';
import { NotificationProvider } from '../../../stores/NotificationContext';
import type { PortalActionOutcome, PortalRecordAction } from '../../../domain/entities/Portal';
import { PORTAL_HOST_MODULES } from '../../shared/extensions/portalHostApi';
import { NotificationBanner } from '../../components/layout/NotificationBanner';
import { PortalRecordActions } from './components/PortalRecordActions';

vi.mock('../../shared/i18n/useT', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) => value ?? '',
}));

const usePortalNotify = (PORTAL_HOST_MODULES['@microteia/portal'] as {
  usePortalNotify: () => (message: string, variant?: 'success' | 'warning' | 'error' | 'info') => void;
}).usePortalNotify;

const ACCEPT: PortalRecordAction = {
  id: 'act-accept', title: 'Accept the terms', icon: 'check', confirmMessage: null, danger: false, disabled: false,
};

const navigation = { claimedActions: [], claimActions: () => () => undefined } as unknown as PortalNavigationValue;

const portalStore = (outcome: PortalActionOutcome) => ({
  context: { screens: [{ collection: 'mailboxes', actions: true }] },
  recordsByCollection: { mailboxes: [{ id: 'mailboxes__m1', updatedAt: new Date('2026-10-30T12:00:00Z') }] },
  listRecordActions: vi.fn(async () => [ACCEPT]),
  runRecordAction: vi.fn(async () => outcome),
}) as unknown as PortalStoreValue;

/** O registro aberto do portal como a casca o monta: a barra no registro, o aviso por cima do layout. */
const openRecord = (outcome: PortalActionOutcome, children: React.ReactNode = null) => render(
  <ThemeProvider theme={baseDarkTheme}>
    <PortalStoreContext.Provider value={portalStore(outcome)}>
      <NotificationProvider>
        <PortalNavigationContext.Provider value={navigation}>
          <PortalRecordActions collection="mailboxes" recordId="m1" />
          {children}
        </PortalNavigationContext.Provider>
        <NotificationBanner persistErrors />
      </NotificationProvider>
    </PortalStoreContext.Provider>
  </ThemeProvider>,
);

const settle = () => act(async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
});

const elapse = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});

describe('o desfecho de uma ação do portal é um aviso passageiro', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('o sucesso aparece no aviso, não fica no registro, e some sozinho', async () => {
    openRecord({ status: { code: 'SUCCESS', message: 'Acceptance recorded.' }, actions: [] });
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /Accept the terms/ }));
    await settle();
    expect(screen.getByText('Acceptance recorded.')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();

    await elapse(3000);
    expect(screen.queryByText('Acceptance recorded.')).toBeTruthy();
    await elapse(1500);
    expect(screen.queryByText('Acceptance recorded.')).toBeNull();
  });

  it('o aviso fecha no "x" antes do tempo', async () => {
    openRecord({ status: { code: 'SUCCESS', message: 'Acceptance recorded.' }, actions: [] });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Accept the terms/ }));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'action.close' }));
    await elapse(300);
    expect(screen.queryByText('Acceptance recorded.')).toBeNull();
  });

  it('no portal, o erro fica até o convidado fechá-lo', async () => {
    openRecord({ status: { code: 'ERROR', message: 'The term could not be accepted.' }, actions: [ACCEPT] });
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Accept the terms/ }));
    await settle();

    await elapse(60_000);
    expect(screen.getByText('The term could not be accepted.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'action.close' }));
    await elapse(300);
    expect(screen.queryByText('The term could not be accepted.')).toBeNull();
  });

  it('a view de extensão avisa no mesmo lugar, com "info" quando não diz o tipo', async () => {
    const Probe = () => {
      const notify = usePortalNotify();
      return <button type="button" onClick={() => notify('Draft kept.')}>probe</button>;
    };
    openRecord({ status: { code: 'SUCCESS', message: '' }, actions: [] }, <Probe />);
    await settle();

    fireEvent.click(screen.getByRole('button', { name: 'probe' }));
    await settle();
    expect(screen.getByText('Draft kept.')).toBeTruthy();
    await elapse(10_300);
    expect(screen.queryByText('Draft kept.')).toBeNull();
  });
});

describe('o aviso do escritório não muda', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('sem persistErrors, o erro some sozinho, como sempre', async () => {
    const Probe = () => {
      const notify = usePortalNotify();
      return <button type="button" onClick={() => notify('Could not save.', 'error')}>probe</button>;
    };
    render(
      <ThemeProvider theme={baseDarkTheme}>
        <NotificationProvider>
          <Probe />
          <NotificationBanner />
        </NotificationProvider>
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'probe' }));
    await settle();
    expect(screen.getByText('Could not save.')).toBeTruthy();
    await elapse(10_300);
    expect(screen.queryByText('Could not save.')).toBeNull();
  });
});
