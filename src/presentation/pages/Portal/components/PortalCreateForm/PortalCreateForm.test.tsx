// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../../../shared/styles/theme';
import { PortalStoreContext, type PortalStoreValue } from '../../../../../stores/usePortal';
import { NotificationProvider } from '../../../../../stores/NotificationContext';
import { NotificationBanner } from '../../../../components/layout/NotificationBanner';
import type { PortalFieldInfo, PortalScreenInfo } from '../../../../../domain/entities/Portal';
import { PortalCreateForm } from './PortalCreateForm.view';

vi.mock('../../../../shared/i18n/useT', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) => value ?? '',
}));

const ZIP: PortalFieldInfo = {
  key: 'zip',
  label: 'Zip code',
  type: 'masked',
  required: true,
  mask: { templates: ['#####-###'], inputMode: 'numeric' },
  lookup: {
    binding: { provider: 'com.acme/zip-lookup', map: { street: 'street', city: 'city', note: 'internalNote' } },
    provider: {
      key: 'com.acme/zip-lookup',
      label: 'Zip lookup',
      input: [{ op: 'digits' }],
      when: 'length(value) == 8',
      request: { url: 'https://zip.example.com/{value}.json' },
      map: { street: 'logradouro', city: 'localidade', note: 'complemento' },
      failWhen: { path: 'erro', message: 'Zip code not found' },
      errorMessage: 'Zip lookup unavailable',
    },
  },
};

const MOBILE: PortalFieldInfo = {
  key: 'mobile',
  label: 'Mobile',
  type: 'masked',
  mask: { templates: ['(##) ####-####', '(##) #####-####'], placeholder: '(00) 00000-0000', inputMode: 'numeric' },
};

const fieldsOf = (...extra: PortalFieldInfo[]): PortalFieldInfo[] => [
  ZIP,
  { key: 'street', label: 'Street', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  MOBILE,
  ...extra,
];

const screenWith = (fields: PortalFieldInfo[]): PortalScreenInfo => ({
  id: 'contactRequests',
  collection: 'contactRequests',
  titleSingular: 'Contact request',
  titlePlural: 'Contact requests',
  icon: 'mail',
  documents: false,
  trackViews: false,
  actions: false,
  uploads: null,
  parent: { collection: 'companies' },
  fields: [],
  create: { fields, link: { collection: 'companies', label: 'Company' } },
  edit: { fields, onlyOwn: false },
}) as PortalScreenInfo;

const respond = (body: unknown) => ({ ok: true, text: async () => JSON.stringify(body) }) as unknown as Response;

let fetchMock: ReturnType<typeof vi.fn>;
let submit: ReturnType<typeof vi.fn>;
let update: ReturnType<typeof vi.fn>;

const renderForm = (
  fields: PortalFieldInfo[] = fieldsOf(),
  editing: { recordId: string; values: Record<string, unknown> } | null = null,
) => {
  const store = { listLinkOptions: vi.fn(async () => []), submit, update } as unknown as PortalStoreValue;
  return render(
    <ThemeProvider theme={baseDarkTheme}>
      <PortalStoreContext.Provider value={store}>
        <NotificationProvider>
          <PortalCreateForm
            screen={screenWith(fields)}
            fixedLinkRecordId="acme"
            editing={editing}
            onCancel={() => undefined}
            onSubmitted={() => undefined}
          />
          <NotificationBanner persistErrors />
        </NotificationProvider>
      </PortalStoreContext.Provider>
    </ThemeProvider>,
  );
};

const input = (id: string) => document.getElementById(`portal-create-${id}`) as HTMLInputElement;
const type = (id: string, value: string) => fireEvent.change(input(id), { target: { value } });
const elapse = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('formulário do portal — máscara e busca externa como no escritório', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn(async () => respond({ logradouro: 'Rua Chile', localidade: 'Salvador', complemento: 'internal' }));
    vi.stubGlobal('fetch', fetchMock);
    submit = vi.fn(async () => undefined);
    update = vi.fn(async () => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('digitar o CEP aplica a máscara, busca e preenche só o que o convidado escreve', async () => {
    renderForm();

    type('zip', '40010000');
    expect(input('zip').value).toBe('40010-000');
    expect(input('zip').inputMode).toBe('numeric');
    expect(fetchMock).not.toHaveBeenCalled();

    await elapse(400);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://zip.example.com/40010000.json');
    expect(input('street').value).toBe('Rua Chile');
    expect(input('city').value).toBe('Salvador');

    fireEvent.click(screen.getByRole('button', { name: 'portal.create.send' }));
    await elapse(0);

    expect(submit).toHaveBeenCalledWith('contactRequests', 'acme', { zip: '40010-000', street: 'Rua Chile', city: 'Salvador' });
  });

  it('o celular segue o molde do preset, trocando de molde conforme o tamanho', () => {
    renderForm();

    expect(input('mobile').placeholder).toBe('(00) 00000-0000');
    type('mobile', '7133334444');
    expect(input('mobile').value).toBe('(71) 3333-4444');
    type('mobile', '71999998888');
    expect(input('mobile').value).toBe('(71) 99999-8888');
  });

  it('digitar rápido dispara uma busca só, pelo último valor', async () => {
    renderForm();

    type('zip', '4001000');
    await elapse(200);
    type('zip', '40020000');
    await elapse(400);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://zip.example.com/40020000.json');
  });

  it('CEP não encontrado avisa com a frase do provedor e não preenche nada', async () => {
    fetchMock.mockImplementation(async () => respond({ erro: true }));
    renderForm();

    type('zip', '99999999');
    await elapse(400);

    expect(screen.getByText('Zip code not found')).toBeTruthy();
    expect(input('street').value).toBe('');
  });

  it('na edição, a busca preenche por cima do que o convidado já tinha', async () => {
    renderForm(fieldsOf(), { recordId: 'r1', values: { zip: '01001-000', street: 'Old street', city: 'São Paulo', mobile: '' } });

    type('zip', '40010000');
    await elapse(400);
    fireEvent.click(screen.getByRole('button', { name: 'portal.edit.save' }));
    await elapse(0);

    expect(update).toHaveBeenCalledWith('contactRequests', 'r1', { zip: '40010-000', street: 'Rua Chile', city: 'Salvador', mobile: null });
  });

  it('campo sem a declaração continua como sempre: texto comum e nenhuma busca', async () => {
    renderForm([
      { key: 'zip', label: 'Zip code', type: 'masked' },
      { key: 'street', label: 'Street', type: 'text' },
    ]);

    type('zip', '40010000');
    await elapse(400);

    expect(input('zip').value).toBe('40010000');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('formulário do portal — a segunda referência é escolhida, não digitada (EV-37)', () => {
  const INVOICE: PortalFieldInfo = { key: 'invoiceId', label: 'Invoice', type: 'reference', reference: { collection: 'invoices', multi: false } };
  const SUBJECT: PortalFieldInfo = { key: 'subject', label: 'Subject', type: 'text' };

  const renderWithReference = (editing: { recordId: string; values: Record<string, unknown>; labels?: Record<string, string> } | null = null) => {
    submit = vi.fn(async () => undefined);
    update = vi.fn(async () => undefined);
    const listLinkOptions = vi.fn(async (collection: string) =>
      (collection === 'invoices' ? [{ recordId: 'nf1', label: 'NF 1' }, { recordId: 'nf2', label: 'NF 2' }] : []));
    const store = { listLinkOptions, submit, update } as unknown as PortalStoreValue;
    render(
      <ThemeProvider theme={baseDarkTheme}>
        <PortalStoreContext.Provider value={store}>
          <NotificationProvider>
            <PortalCreateForm
              screen={screenWith([SUBJECT, INVOICE])}
              fixedLinkRecordId="acme"
              editing={editing}
              onCancel={() => undefined}
              onSubmitted={() => undefined}
            />
          </NotificationProvider>
        </PortalStoreContext.Provider>
      </ThemeProvider>,
    );
    return { listLinkOptions };
  };

  it('oferece só os registros que o convidado vê, pelo título, e envia o id escolhido', async () => {
    const { listLinkOptions } = renderWithReference();

    fireEvent.click(await screen.findByRole('button', { name: 'portal.create.link.placeholder' }));
    fireEvent.mouseDown(screen.getByText('NF 2'));
    type('subject', 'Dúvida');
    fireEvent.click(screen.getByRole('button', { name: 'portal.create.send' }));

    expect(listLinkOptions).toHaveBeenCalledWith('invoices');
    expect(input('invoiceId')).toBeNull();
    await vi.waitFor(() => expect(submit).toHaveBeenCalledWith('contactRequests', 'acme', { subject: 'Dúvida', invoiceId: 'nf2' }));
  });

  it('na edição, o registro já apontado aparece pelo nome, mesmo fora da lista, e volta como estava', async () => {
    renderWithReference({ recordId: 'r1', values: { subject: 'A', invoiceId: 'office-set' }, labels: { invoiceId: 'Office record' } });

    expect(await screen.findByText('Office record')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'portal.edit.save' }));

    await vi.waitFor(() => expect(update).toHaveBeenCalledWith('contactRequests', 'r1', { subject: 'A', invoiceId: 'office-set' }));
  });
});
