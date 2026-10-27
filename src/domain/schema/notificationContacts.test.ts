import { describe, expect, it } from 'vitest';
import {
  contactValues,
  EMPTY_NOTIFICATION_SMS_SETTINGS,
  fieldAcceptsContact,
  isOptOutTicket,
  maskContactAddress,
  normalizeContactEmail,
  normalizePhoneNumber,
  notificationOptOutPath,
  notificationSmsSettingsIssue,
} from './notificationContacts';
import type { NotificationSmsSettings } from './notificationContacts';
import { createSchemaContext, fieldDefinitionToNativeSpec, nativeSpecToFieldDefinition } from './screenEntity';
import { parsePath, resolvePath } from './pathResolver';
import type { FieldDefinition } from '../entities/entitySchemas';

describe('contactValues', () => {
  it('separa vários endereços num texto e achata as listas', () => {
    expect(contactValues('a@x.com; b@y.com,c@z.com\nd@w.com')).toEqual(['a@x.com', 'b@y.com', 'c@z.com', 'd@w.com']);
    expect(contactValues(['a@x.com', ['b@y.com'], null, 7199998888])).toEqual(['a@x.com', 'b@y.com', '7199998888']);
    expect(contactValues(undefined)).toEqual([]);
    expect(contactValues({ email: 'a@x.com' })).toEqual([]);
  });
});

describe('normalizeContactEmail', () => {
  it('minúsculas e sem espaço; o que não é e-mail é null', () => {
    expect(normalizeContactEmail('  Fiscal@Empresa.COM.br ')).toBe('fiscal@empresa.com.br');
    expect(normalizeContactEmail('sem-arroba')).toBeNull();
    expect(normalizeContactEmail('a@b')).toBeNull();
    expect(normalizeContactEmail('Nome <a@b.com>')).toBeNull();
  });
});

describe('normalizePhoneNumber', () => {
  it('o número gravado sem país ganha o do escritório, e o zero de longa distância cai', () => {
    expect(normalizePhoneNumber('(71) 99999-8888', '55')).toBe('+5571999998888');
    expect(normalizePhoneNumber('071 99999-8888', '55')).toBe('+5571999998888');
  });

  it('o número que já traz o país fica com o dele', () => {
    expect(normalizePhoneNumber('+1 (555) 000-1111', '55')).toBe('+15550001111');
    expect(normalizePhoneNumber('00351 912 345 678', '55')).toBe('+351912345678');
  });

  it('sem país conhecido, ou fora de 8 a 15 dígitos, não é número', () => {
    expect(normalizePhoneNumber('(71) 99999-8888', '')).toBeNull();
    expect(normalizePhoneNumber('123', '55')).toBeNull();
    expect(normalizePhoneNumber('+1234567890123456', '55')).toBeNull();
    expect(normalizePhoneNumber('', '55')).toBeNull();
  });
});

describe('maskContactAddress', () => {
  it('quem abre o link não aprende o endereço inteiro', () => {
    expect(maskContactAddress('email', 'fiscal@empresa.com.br')).toBe('f***@empresa.com.br');
    expect(maskContactAddress('sms', '+5571999998888')).toBe('+55*******8888');
  });
});

describe('o link de descadastro', () => {
  it('leva o escritório, o bilhete e o idioma de quem recebe', () => {
    expect(notificationOptOutPath('t1', 'abc_DEF-123', 'pt-BR')).toBe('/notifications/opt-out/t1/abc_DEF-123?locale=pt-BR');
    expect(isOptOutTicket('abcdefghijklmnopqrstuvwxyz012345')).toBe(true);
    expect(isOptOutTicket('../../etc')).toBe(false);
    expect(isOptOutTicket('curto')).toBe(false);
  });
});

describe('notificationSmsSettingsIssue', () => {
  const twilio: NotificationSmsSettings = {
    ...EMPTY_NOTIFICATION_SMS_SETTINGS,
    accountSid: `AC${'0'.repeat(32)}`,
    fromNumber: '+15550001111',
    defaultCountryCode: '55',
    appUrl: 'https://app.test',
  };

  it('aceita uma Twilio completa e um webhook https público', () => {
    expect(notificationSmsSettingsIssue(twilio)).toBeNull();
    expect(notificationSmsSettingsIssue({ ...twilio, fromNumber: `MG${'f'.repeat(32)}` })).toBeNull();
    expect(notificationSmsSettingsIssue({ ...twilio, provider: 'webhook', webhookUrl: 'https://sms.example.com/send' })).toBeNull();
  });

  it('diz o que falta, como referência', () => {
    expect(notificationSmsSettingsIssue({ ...twilio, defaultCountryCode: '' })).toBe('@core.automation/notifications.sms.issue.country');
    expect(notificationSmsSettingsIssue({ ...twilio, appUrl: '' })).toBe('@core.automation/notifications.sms.issue.app-url');
    expect(notificationSmsSettingsIssue({ ...twilio, accountSid: 'AC1' })).toBe('@core.automation/notifications.sms.issue.account');
    expect(notificationSmsSettingsIssue({ ...twilio, fromNumber: '7199998888' })).toBe('@core.automation/notifications.sms.issue.from');
  });

  it('o webhook não pode apontar para a rede de dentro', () => {
    for (const webhookUrl of ['http://sms.example.com', 'https://127.0.0.1/x', 'https://svc.internal/x', 'https://sms.example.com:8443/x']) {
      expect(notificationSmsSettingsIssue({ ...twilio, provider: 'webhook', webhookUrl }))
        .toBe('@core.automation/notifications.sms.issue.webhook');
    }
  });
});

describe('o campo declara o contato', () => {
  const field: FieldDefinition = {
    key: 'email', label: 'E-mail', type: 'text', required: false, order: 0, origin: 'design', contact: 'email',
  };

  it('só texto de uma linha, com ou sem máscara, de um valor', () => {
    expect(fieldAcceptsContact('text')).toBe(true);
    expect(fieldAcceptsContact('masked')).toBe(true);
    expect(fieldAcceptsContact('textarea')).toBe(false);
    expect(fieldAcceptsContact('reference')).toBe(false);
    expect(fieldAcceptsContact('text', true)).toBe(false);
  });

  it('atravessa a forma canônica e volta', () => {
    const spec = fieldDefinitionToNativeSpec(field);
    expect(spec.contact).toBe('email');
    expect(nativeSpecToFieldDefinition(spec, 'email', 0).contact).toBe('email');
    const plain = fieldDefinitionToNativeSpec({ ...field, contact: null });
    expect('contact' in plain).toBe(false);
    expect('contact' in nativeSpecToFieldDefinition(plain, 'email', 0)).toBe(false);
  });

  it('valor desconhecido não vira contato', () => {
    expect(fieldDefinitionToNativeSpec({ ...field, contact: 'fax' as never }).contact).toBeUndefined();
  });

  it('o caminho chega ao nó com o contato — também através de uma referência', () => {
    const ctx = createSchemaContext([
      { id: 'empresas', titleSingular: 'Empresa', titleFieldKey: 'nome', fields: [
        { key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, origin: 'design' },
        field,
      ] },
      { id: 'comunicacoes', titleSingular: 'Comunicação', titleFieldKey: 'assunto', fields: [
        { key: 'assunto', label: 'Assunto', type: 'text', required: false, order: 0, origin: 'design' },
        { key: 'empresaId', label: 'Empresa', type: 'reference', refEntity: 'empresas', required: false, order: 1, origin: 'design' },
      ] },
    ]);
    const root = { kind: 'entity' as const, entityKey: 'comunicacoes', hasOld: false };
    expect(resolvePath(ctx, root, parsePath('empresaId.email')).node).toMatchObject({ kind: 'scalar', contact: 'email' });
    expect(resolvePath(ctx, root, parsePath('empresaId.nome')).node).not.toHaveProperty('contact');
  });
});
