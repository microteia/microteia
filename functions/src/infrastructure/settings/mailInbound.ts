import { defineString } from 'firebase-functions/params';
import { MAIL_INBOUND_SUFFIX_PATTERN } from '../../domain/schema/mailbox';
import type { MailInboundAddressing } from '../../domain/schema/mailbox';

/**
 * O domínio que RECEBE o e-mail encaminhado (`in.exemplo.com.br`), cujo MX aponta para o provedor de
 * recepção da instalação. É de quem mantém a instalação, no `.env.<projectId>`. Vazio é "não configurado":
 * as caixas de encaminhamento não podem ser criadas, e nada mais muda — por isso tem `default`.
 *
 * A `description` de cada parâmetro vira o comentário dele no `.env.<projectId>` que o Console escreve: é o
 * único lugar em que quem instala lê o que a variável faz, e por isso ela aponta para a documentação.
 */
export const MAIL_INBOUND_DOMAIN: ReturnType<typeof defineString> = defineString('MAIL_INBOUND_DOMAIN', {
  default: '',
  description: 'Domain whose MX points to the inbound mail provider; forwarded e-mail is addressed to <code>@<domain>. Empty: forwarding is unavailable. See https://doc.microteia.com/#/forwarded-email',
});

/**
 * O sufixo que distingue esta instalação das outras que recebem pelo MESMO domínio — o provedor tem um
 * catch-all só, e o adaptador escolhe a instalação por ele em vez de perguntar a cada uma. Opcional: vazio,
 * o endereço é o de antes.
 */
export const MAIL_INBOUND_SUFFIX: ReturnType<typeof defineString> = defineString('MAIL_INBOUND_SUFFIX', {
  default: '',
  description: 'Optional. Lowercase letters and digits that tell this installation apart from others sharing MAIL_INBOUND_DOMAIN: addresses become <code>_<suffix>@<domain>, and the inbound adapter routes by the suffix (the reference Cloudflare Worker uses <SUFFIX>_URL and <SUFFIX>_SECRET). Addresses without the suffix keep working. See https://doc.microteia.com/#/forwarded-email',
});

/**
 * O segredo com que o adaptador do provedor ASSINA cada mensagem que entrega (`mailInbound`). O mesmo valor
 * vai para a configuração do adaptador. Vazio desliga o encaminhamento, como o domínio vazio.
 */
export const MAIL_INBOUND_SECRET: ReturnType<typeof defineString> = defineString('MAIL_INBOUND_SECRET', {
  default: '',
  description: 'Shared secret the inbound mail adapter signs each delivery with (HMAC-SHA256); choose a long random value and give the same one to the adapter. Empty: forwarding is unavailable. See https://doc.microteia.com/#/forwarded-email',
});

/**
 * O encaminhamento existe nesta instalação: domínio e segredo preenchidos, e o sufixo, se houver, válido.
 * Um sufixo inválido DESLIGA o encaminhamento em vez de ser ignorado: ignorado, a plataforma mostraria
 * endereços sem sufixo que o adaptador mandaria para a instalação errada (ou para nenhuma).
 */
export const mailInboundConfig = (): (MailInboundAddressing & { secret: string }) | null => {
  const domain = MAIL_INBOUND_DOMAIN.value().trim().toLowerCase();
  const suffix = MAIL_INBOUND_SUFFIX.value().trim().toLowerCase();
  const secret = MAIL_INBOUND_SECRET.value();
  if (!domain || !secret) return null;
  if (suffix && !MAIL_INBOUND_SUFFIX_PATTERN.test(suffix)) {
    console.error(`[mail-inbound] MAIL_INBOUND_SUFFIX="${suffix}" is not lowercase letters and digits; forwarding is off until it is fixed.`);
    return null;
  }
  return { domain, suffix, secret };
};
