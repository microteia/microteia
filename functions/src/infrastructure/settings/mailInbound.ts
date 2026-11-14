import { defineString } from 'firebase-functions/params';

/**
 * O domínio que RECEBE o e-mail encaminhado (`in.exemplo.com.br`), cujo MX aponta para o provedor de
 * recepção da instalação. É de quem mantém a instalação, no `.env.<projectId>`. Vazio é "não configurado":
 * as caixas de encaminhamento não podem ser criadas, e nada mais muda — por isso tem `default`.
 */
export const MAIL_INBOUND_DOMAIN: ReturnType<typeof defineString> = defineString('MAIL_INBOUND_DOMAIN', {
  default: '',
  description: 'Domain whose MX points to the inbound mail provider; forwarded e-mail is addressed to <code>@<domain>. Empty: forwarding is unavailable.',
});

/**
 * O segredo com que o adaptador do provedor ASSINA cada mensagem que entrega (`mailInbound`). O mesmo valor
 * vai para a configuração do adaptador. Vazio desliga o encaminhamento, como o domínio vazio.
 */
export const MAIL_INBOUND_SECRET: ReturnType<typeof defineString> = defineString('MAIL_INBOUND_SECRET', {
  default: '',
  description: 'Shared secret the inbound mail adapter signs each delivery with (HMAC-SHA256). Empty: forwarding is unavailable.',
});

/** O encaminhamento existe nesta instalação: os dois estão preenchidos. */
export const mailInboundConfig = (): { domain: string; secret: string } | null => {
  const domain = MAIL_INBOUND_DOMAIN.value().trim().toLowerCase();
  const secret = MAIL_INBOUND_SECRET.value();
  return domain && secret ? { domain, secret } : null;
};
