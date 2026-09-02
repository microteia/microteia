import { describe, it, expect } from 'vitest';
import { LocalizedError, errorParamsOf, wrappedErrorParams } from './LocalizedError';
import { buildMessageCatalog, translate } from '../schema/i18n/messages';

/**
 * O catálogo mínimo do defeito que originou `wrappedErrorParams`: uma frase que embrulha outra, e a
 * de dentro interpolando três valores que só o domínio conhece.
 */
const catalog = buildMessageCatalog(
  [
    {
      locale: 'en',
      namespace: 'core.marketplace',
      messages: {
        'extension.operation-failed': 'Could not complete the operation: {detail}',
        'install.dependency-missing':
          'This extension references {kind} "{id}" of extension "{plugin}", which is not installed.',
        'ref.kind.action': 'the action',
      },
    },
  ],
  'en',
);

describe('errorParamsOf', () => {
  it('devolve os parâmetros de um LocalizedError', () => {
    const error = new LocalizedError('@core.marketplace/install.dependency-missing', { id: 'a1' });
    expect(errorParamsOf(error)).toEqual({ id: 'a1' });
  });

  it('devolve undefined para qualquer outro erro', () => {
    expect(errorParamsOf(new Error('boom'))).toBeUndefined();
  });
});

describe('wrappedErrorParams', () => {
  /**
   * A recusa chegava à tela com `{kind}`, `{id}` e `{plugin}` crus: quem embrulhava passava só o
   * `{detail}`, e o motor desce para a mensagem aninhada apenas os parâmetros que a de fora recebeu.
   */
  it('desce os parâmetros do erro para a frase que o embrulha', () => {
    const error = new LocalizedError('@core.marketplace/install.dependency-missing', {
      kind: '@core.marketplace/ref.kind.action',
      id: 'send-email',
      plugin: 'com.acme.mail',
    });

    expect(translate(catalog, 'core.marketplace/extension.operation-failed', wrappedErrorParams(error)))
      .toBe(
        'Could not complete the operation: This extension references the action "send-email" '
        + 'of extension "com.acme.mail", which is not installed.',
      );
  });

  it('embrulha um erro comum com a mensagem dele', () => {
    expect(translate(catalog, 'core.marketplace/extension.operation-failed', wrappedErrorParams(new Error('boom'))))
      .toBe('Could not complete the operation: boom');
  });

  it('usa o detalhe de reserva quando o que foi lançado não é um Error', () => {
    expect(wrappedErrorParams('x', 'unknown failure').detail).toBe('unknown failure');
  });
});
