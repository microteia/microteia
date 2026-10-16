import { describe, expect, it } from 'vitest';
import { resolveLabel } from '../../../domain/schema/i18n/messageRef';
import { buildMessageCatalog } from '../../../domain/schema/i18n/messages';
import { normalizeActionOutcome } from '../../../domain/entities/Action';
import { localizeActionOutcome } from './useScreenActions';

const catalog = buildMessageCatalog([{
  locale: 'en',
  namespace: 'com.example.task',
  messages: { 'flow.move.done': 'Task rescheduled.', 'field.date.required': 'Pick a date.' },
}], 'en');

const label = (value: string | null | undefined) => resolveLabel(catalog, value);

/**
 * O defeito: o aviso da tela mostrava "@com.example.task/flow.move.done" em vez da frase. A mensagem
 * que uma Action devolve em `status` é texto declarativo, e passa pelo catálogo como qualquer rótulo.
 */
describe('localizeActionOutcome', () => {
  it('traduz a referência de mensagem devolvida em status.message', () => {
    const outcome = normalizeActionOutcome({ status: ['SUCCESS', '@com.example.task/flow.move.done'] });
    expect(localizeActionOutcome(outcome, label).status.message).toBe('Task rescheduled.');
  });

  it('mantém intacta a mensagem em texto comum', () => {
    const outcome = normalizeActionOutcome({ status: { code: 'WARNING', message: 'Feito à mão' } });
    expect(localizeActionOutcome(outcome, label).status).toEqual({ code: 'WARNING', message: 'Feito à mão' });
  });

  it('traduz os erros por campo e preserva result e comandos', () => {
    const outcome = normalizeActionOutcome({
      result: { date: null },
      actions: ['merge'],
      status: { code: 'ERROR', message: '', fieldErrors: { date: '@com.example.task/field.date.required', note: 'Livre' } },
    });
    const localized = localizeActionOutcome(outcome, label);
    expect(localized.status.fieldErrors).toEqual({ date: 'Pick a date.', note: 'Livre' });
    expect(localized.result).toBe(outcome.result);
    expect(localized.commands).toEqual(['merge']);
  });
});
