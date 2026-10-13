import { describe, expect, it } from 'vitest';
import { notificationLinkUrl, renderNotificationEmail } from './notificationEmail';

describe('renderNotificationEmail', () => {
  it('escapa o que vem do fluxo e tira quebra de linha do cabeçalho', () => {
    const message = renderNotificationEmail({
      to: 'a@b.co\nBcc: x@y.z',
      title: 'Prazo\r\nBcc: evil@x.y',
      message: '<script>alert(1)</script>\n\nSegundo parágrafo',
      linkUrl: 'https://app.test/view-record:1',
      linkLabel: 'Abrir',
      footer: 'Rodapé',
    });
    expect(message.subject).not.toMatch(/[\r\n]/);
    expect(message.to).not.toMatch(/[\r\n]/);
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
    expect(message.html).toContain('href="https://app.test/view-record:1"');
    expect(message.text).toContain('Segundo parágrafo');
  });
});

describe('notificationLinkUrl', () => {
  it('junta o endereço da aplicação à chave da aba, e some quando falta um dos dois', () => {
    expect(notificationLinkUrl('https://app.test/', '/view-record:1')).toBe('https://app.test/view-record:1');
    expect(notificationLinkUrl('', 'view-record:1')).toBe('');
    expect(notificationLinkUrl('https://app.test', '')).toBe('');
  });
});
