import { describe, expect, it } from 'vitest';
import {
  EMPTY_MAILBOX_SETTINGS,
  MAIL_FILTER_MAX_TERMS,
  forwardingConfirmationOf,
  mailInboundTokenOf,
  hasMailFilter,
  mailAddressOf,
  mailFilterIssue,
  mailServerPrefilter,
  mailboxSettingsIssue,
  matchesMailFilter,
  matchesSenderTerm,
} from './mailbox';
import type { MailboxSettings } from './mailbox';

const message = (from: string, subject = 'Intimação eletrônica', attachmentCount = 0) => ({ from, subject, attachmentCount });

describe('matchesSenderTerm', () => {
  it('casa o endereço inteiro, sem diferença de maiúscula', () => {
    expect(matchesSenderTerm('Intimacao@TJBA.jus.br', 'intimacao@tjba.jus.br')).toBe(true);
    expect(matchesSenderTerm('outro@tjba.jus.br', 'intimacao@tjba.jus.br')).toBe(false);
  });

  it('lê o endereço de dentro do nome de exibição', () => {
    expect(mailAddressOf('"Tribunal" <intimacao@tjba.jus.br>')).toBe('intimacao@tjba.jus.br');
    expect(matchesSenderTerm('"Tribunal" <intimacao@tjba.jus.br>', '@tjba.jus.br')).toBe(true);
  });

  it('domínio com ou sem @ casa o domínio e os subdomínios, e não um domínio que só termina igual', () => {
    expect(matchesSenderTerm('a@tjba.jus.br', 'tjba.jus.br')).toBe(true);
    expect(matchesSenderTerm('a@mail.tjba.jus.br', '@tjba.jus.br')).toBe(true);
    expect(matchesSenderTerm('a@falsotjba.jus.br', 'tjba.jus.br')).toBe(false);
  });

  it('curinga de subdomínio casa qualquer subdomínio, e não o domínio nu', () => {
    expect(matchesSenderTerm('a@tjba.jus.br', '*.jus.br')).toBe(true);
    expect(matchesSenderTerm('a@jus.br', '*.jus.br')).toBe(false);
    expect(matchesSenderTerm('a@jus.br.evil.com', '*.jus.br')).toBe(false);
  });
});

describe('matchesMailFilter', () => {
  it('sem filtro, tudo passa', () => {
    expect(matchesMailFilter(undefined, message('a@b.com'))).toBe(true);
    expect(matchesMailFilter({ from: [], subject: [] }, message('a@b.com'))).toBe(true);
  });

  it('entre listas vale E; dentro de uma lista, OU', () => {
    const filter = { from: ['*.jus.br', 'recortedigital.adv.br'], subject: ['intimação', 'publicação'] };
    expect(matchesMailFilter(filter, message('a@tjba.jus.br', 'Nova INTIMACAO'))).toBe(true);
    expect(matchesMailFilter(filter, message('a@recortedigital.adv.br', 'Publicação do dia'))).toBe(true);
    expect(matchesMailFilter(filter, message('a@tjba.jus.br', 'Newsletter'))).toBe(false);
    expect(matchesMailFilter(filter, message('a@gmail.com', 'Intimação'))).toBe(false);
  });

  it('o assunto ignora acento e maiúscula', () => {
    expect(matchesMailFilter({ subject: ['Publicação'] }, message('a@b.com', 'publicacao disponivel'))).toBe(true);
  });

  it('anexo: true exige, false recusa, ausente não importa', () => {
    expect(matchesMailFilter({ hasAttachments: true }, message('a@b.com', 's', 0))).toBe(false);
    expect(matchesMailFilter({ hasAttachments: true }, message('a@b.com', 's', 2))).toBe(true);
    expect(matchesMailFilter({ hasAttachments: false }, message('a@b.com', 's', 1))).toBe(false);
    expect(matchesMailFilter({ hasAttachments: null }, message('a@b.com', 's', 1))).toBe(true);
  });
});

describe('hasMailFilter e mailFilterIssue', () => {
  it('termos em branco não contam como filtro', () => {
    expect(hasMailFilter({ from: ['  '], subject: [] })).toBe(false);
    expect(hasMailFilter({ hasAttachments: false })).toBe(true);
  });

  it('recusa lista longa demais, termo que não é texto e remetente com espaço ou curinga nu', () => {
    expect(mailFilterIssue({ from: Array.from({ length: MAIL_FILTER_MAX_TERMS + 1 }, (_, i) => `a${i}.com`) }))
      .toBe('@core.automation/mail.filter.too-many');
    expect(mailFilterIssue({ subject: [1 as unknown as string] })).toBe('@core.automation/mail.filter.invalid');
    expect(mailFilterIssue({ from: ['a b.com'] })).toBe('@core.automation/mail.filter.sender-invalid');
    expect(mailFilterIssue({ from: ['*'] })).toBe('@core.automation/mail.filter.sender-invalid');
    expect(mailFilterIssue({ from: ['*.jus.br'], subject: ['x'] })).toBeNull();
  });
});

describe('mailServerPrefilter', () => {
  it('sem automação, ou com uma que aceita qualquer remetente e assunto, pede tudo', () => {
    expect(mailServerPrefilter([])).toEqual({ kind: 'all' });
    expect(mailServerPrefilter([{ from: ['a.com'] }, null])).toEqual({ kind: 'all' });
  });

  it('todas restringem o remetente: pede a união dos remetentes, sem curinga nem @', () => {
    expect(mailServerPrefilter([{ from: ['*.jus.br'] }, { from: ['@b.com', 'x@c.com'], subject: ['s'] }]))
      .toEqual({ kind: 'from', terms: ['jus.br', 'b.com', 'x@c.com'] });
  });

  it('uma sem remetente, todas com assunto: pede a união dos assuntos', () => {
    expect(mailServerPrefilter([{ from: ['a.com'], subject: ['fatura'] }, { subject: ['pedido'] }]))
      .toEqual({ kind: 'subject', terms: ['fatura', 'pedido'] });
  });

  it('uma restringe só remetente e outra só assunto: pede tudo, porque nenhuma dimensão serve às duas', () => {
    expect(mailServerPrefilter([{ from: ['a.com'] }, { subject: ['pedido'] }])).toEqual({ kind: 'all' });
  });
});

describe('mailboxSettingsIssue', () => {
  const valid: MailboxSettings = {
    ...EMPTY_MAILBOX_SETTINGS,
    name: 'Intimações',
    imap: { host: 'imap.gmail.com', port: 993, secure: true, username: 'me@gmail.com', folder: 'INBOX' },
  };

  it('aceita a configuração completa', () => {
    expect(mailboxSettingsIssue(valid)).toBeNull();
  });

  it('cobra nome, servidor, porta, usuário e intervalo dentro do tique', () => {
    expect(mailboxSettingsIssue({ ...valid, name: ' ' })).toBe('@core.automation/mailbox.issue.name');
    expect(mailboxSettingsIssue({ ...valid, imap: { ...valid.imap, host: 'imap gmail.com' } })).toBe('@core.automation/mailbox.issue.host');
    expect(mailboxSettingsIssue({ ...valid, imap: { ...valid.imap, port: 70000 } })).toBe('@core.automation/mailbox.issue.port');
    expect(mailboxSettingsIssue({ ...valid, imap: { ...valid.imap, username: '' } })).toBe('@core.automation/mailbox.issue.username');
    expect(mailboxSettingsIssue({ ...valid, pollEveryMinutes: 1 })).toBe('@core.automation/mailbox.issue.interval');
    expect(mailboxSettingsIssue({ ...valid, pollEveryMinutes: 7.5 })).toBe('@core.automation/mailbox.issue.interval');
  });
});

describe('encaminhamento — endereço e confirmação', () => {
  const token = 'abcdefghijklmnopqrstuvwx';

  it('lê o código do destinatário do envelope, com ou sem etiqueta, só no domínio da instalação', () => {
    expect(mailInboundTokenOf(`${token}@in.example.com`, 'in.example.com')).toBe(token);
    expect(mailInboundTokenOf(`<${token.toUpperCase()}+gmail@IN.example.com>`, 'in.example.com')).toBe(token);
    expect(mailInboundTokenOf(`${token}@outro.com`, 'in.example.com')).toBeNull();
    expect(mailInboundTokenOf('curto@in.example.com', 'in.example.com')).toBeNull();
  });

  it('reconhece a confirmação de encaminhamento do Gmail, com o código e o link', () => {
    const confirmation = forwardingConfirmationOf({
      from: 'Equipe do Gmail <forwarding-noreply@google.com>',
      subject: '(#123456789) Confirmação de encaminhamento do Gmail - Receber e-mails de pessoa@gmail.com',
      text: 'Para permitir, clique em https://mail-settings.google.com/mail/vf-%5BABC%5D-xyz?param=1 e pronto.',
    }, new Date('2026-11-14T10:00:00.000Z'));
    expect(confirmation).toEqual({
      code: '123456789',
      url: 'https://mail-settings.google.com/mail/vf-%5BABC%5D-xyz?param=1',
      receivedAt: '2026-11-14T10:00:00.000Z',
    });
  });

  it('não confunde e-mail comum com a confirmação', () => {
    expect(forwardingConfirmationOf({ from: 'a@tjba.jus.br', subject: '(#123456789)', text: '' }, new Date())).toBeNull();
  });

  it('a caixa de encaminhamento não cobra servidor, usuário nem intervalo', () => {
    expect(mailboxSettingsIssue({ ...EMPTY_MAILBOX_SETTINGS, name: 'Intimações', source: 'forward' })).toBeNull();
  });
});
