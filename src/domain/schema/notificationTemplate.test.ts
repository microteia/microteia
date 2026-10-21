import { describe, expect, it } from 'vitest';
import {
  asNotificationEmailLayout,
  asNotificationTemplates,
  buildNotificationEmailHtml,
  DEFAULT_NOTIFICATION_EMAIL_LAYOUT,
  escapeMarkdown,
  fillNotificationTemplate,
  notificationMarkdownToText,
  notificationTemplateFor,
  renderNotificationMarkdown,
} from './notificationTemplate';

describe('Markdown do e-mail', () => {
  it('formata só o que é seguro, e escapa o resto', () => {
    const html = renderNotificationMarkdown('**Olá** e *bem-vindo*\nlinha 2\n\n- um\n- dois\n\n<script>x</script> [site](https://a.test/a_b_c)');
    expect(html).toContain('<strong>Olá</strong>');
    expect(html).toContain('<em>bem-vindo</em>');
    expect(html).toContain('linha 2');
    expect(html).toContain('<li>um</li>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('href="https://a.test/a_b_c"');
    expect(renderNotificationMarkdown('[x](javascript:alert(1))')).not.toContain('href');
  });

  it('o valor de registro escapado continua texto — nem link, nem negrito', () => {
    const value = escapeMarkdown('[clique](https://evil.test) **forte**');
    const html = renderNotificationMarkdown(`Veja: ${value}`);
    expect(html).not.toContain('href');
    expect(html).not.toContain('<strong>');
    expect(html).toContain('[clique](https://evil.test) **forte**');
    expect(notificationMarkdownToText('**a** [b](https://c.test)')).toBe('a b (https://c.test)');
  });
});

describe('modelos', () => {
  it('preenche as variáveis conhecidas e deixa à vista as que não existem', () => {
    expect(fillNotificationTemplate('Oi {guest}, de {tenant} {nada}', { guest: 'Ana', tenant: 'Acme' }))
      .toBe('Oi Ana, de Acme {nada}');
  });

  it('o do tipo vence o Geral, canal por canal', () => {
    const templates = asNotificationTemplates({
      '': { email: { subject: 'Geral', body: '' }, push: { title: 'P', body: '' } },
      'ext/a': { email: { subject: 'Do tipo', body: 'x' } },
      'ext/ruim': 'não é objeto',
    });
    expect(notificationTemplateFor(templates, 'ext/a', 'email')?.subject).toBe('Do tipo');
    expect(notificationTemplateFor(templates, 'ext/a', 'push')?.title).toBe('P');
    expect(templates).not.toHaveProperty('ext/ruim');
  });

  it('layout malformado vira o padrão; cor só em #rrggbb', () => {
    expect(asNotificationEmailLayout('x')).toEqual(DEFAULT_NOTIFICATION_EMAIL_LAYOUT);
    expect(asNotificationEmailLayout({ accentColor: 'red;background:url(x)' }).accentColor).toBe('');
    expect(asNotificationEmailLayout({ accentColor: '#12ab34', showLogo: false }))
      .toMatchObject({ accentColor: '#12ab34', showLogo: false });
  });

  it('o logo só entra por https, e o botão só com link', () => {
    const base = {
      title: 'T', body: 'b', linkUrl: '', linkLabel: 'Abrir', footer: 'f', tenantName: 'Acme',
      layout: DEFAULT_NOTIFICATION_EMAIL_LAYOUT,
    };
    expect(buildNotificationEmailHtml({ ...base, logoURL: 'http://x/logo.png' })).not.toContain('<img');
    expect(buildNotificationEmailHtml({ ...base, logoURL: 'https://x/logo.png' })).toContain('<img src="https://x/logo.png"');
    expect(buildNotificationEmailHtml({ ...base, logoURL: null })).not.toContain('Abrir');
  });
});
