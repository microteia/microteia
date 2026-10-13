import { describe, expect, it } from 'vitest';
import {
  isChannelEnabled,
  isPushEndpointAllowed,
  NOTIFICATION_SETTINGS_PROPERTIES,
  notificationEmailSettingsIssue,
  notificationRecipientCandidates,
  EMPTY_NOTIFICATION_EMAIL_SETTINGS,
} from './notifications';
import { resolveSetting } from './settings';

describe('notificationRecipientCandidates', () => {
  it('lê o uid de um texto, de um registro ligado a um membro e de uma lista', () => {
    expect(notificationRecipientCandidates('u1')).toEqual(['u1']);
    expect(notificationRecipientCandidates({ id: 'p1', memberId: 'u2' })).toEqual(['u2']);
    expect(notificationRecipientCandidates([{ id: 'u3' }, 'u1', 'u1', '', null])).toEqual(['u3', 'u1']);
    expect(notificationRecipientCandidates(undefined)).toEqual([]);
  });
});

describe('isPushEndpointAllowed', () => {
  it('aceita o serviço de push público e recusa endereço interno', () => {
    expect(isPushEndpointAllowed('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushEndpointAllowed('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isPushEndpointAllowed('http://fcm.googleapis.com/x')).toBe(false);
    expect(isPushEndpointAllowed('https://metadata.google.internal/computeMetadata')).toBe(false);
    expect(isPushEndpointAllowed('https://10.0.0.1/x')).toBe(false);
    expect(isPushEndpointAllowed('https://localhost/x')).toBe(false);
    expect(isPushEndpointAllowed('https://push.example.com:8443/x')).toBe(false);
    expect(isPushEndpointAllowed('not a url')).toBe(false);
  });
});

describe('preferências por canal', () => {
  it('o padrão é receber, e a pessoa vence o escritório', () => {
    const email = NOTIFICATION_SETTINGS_PROPERTIES.find((property) => property.key === 'notifications.email');
    expect(email).toBeDefined();
    if (!email) return;
    expect(resolveSetting(email, { user: {}, tenant: {} }).value).toBe(true);
    expect(resolveSetting(email, { user: {}, tenant: { 'notifications.email': false } }).value).toBe(false);
    expect(resolveSetting(email, { user: { 'notifications.email': true }, tenant: { 'notifications.email': false } }).value).toBe(true);
  });
});

describe('notificationEmailSettingsIssue', () => {
  it('cobra servidor, porta e remetente', () => {
    expect(notificationEmailSettingsIssue(EMPTY_NOTIFICATION_EMAIL_SETTINGS)).toBe('@core.automation/notifications.email.issue.host');
    const valid = { ...EMPTY_NOTIFICATION_EMAIL_SETTINGS, host: 'smtp.example.com', fromAddress: 'no-reply@example.com' };
    expect(notificationEmailSettingsIssue(valid)).toBeNull();
    expect(notificationEmailSettingsIssue({ ...valid, port: 0 })).toBe('@core.automation/notifications.email.issue.port');
    expect(notificationEmailSettingsIssue({ ...valid, fromAddress: 'x' })).toBe('@core.automation/notifications.email.issue.from');
    expect(notificationEmailSettingsIssue({ ...valid, appUrl: 'ftp://x' })).toBe('@core.automation/notifications.email.issue.app-url');
  });
});

describe('isChannelEnabled', () => {
  it('aceita o booleano e o texto que o RunModal transporta', () => {
    expect(isChannelEnabled(true)).toBe(true);
    expect(isChannelEnabled('true')).toBe(true);
    expect(isChannelEnabled(undefined)).toBe(false);
    expect(isChannelEnabled('false')).toBe(false);
  });
});
