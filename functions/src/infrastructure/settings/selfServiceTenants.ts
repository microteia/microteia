import { defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions/v2';

/**
 * Se o cadastro de uma conta abre um escritório para ela — de quem mantém a instalação, no
 * `.env.<projectId>` dela. Vazio é o comportamento de sempre (abre), e é por isso que tem `default`: a
 * instalação que não pensou nisso não tem nada a preencher.
 *
 * Mora no `.env`, e não no `microteia.yaml`, pela divisão que a instalação já faz: o `.yaml` é estado que
 * os comandos do Console escrevem; o `.env` é o que uma pessoa decide e digita, e é o único dos dois que
 * chega às functions — com o `provision` percebendo a troca e redeployando quem o carrega.
 */
export const SELF_SERVICE_TENANTS: ReturnType<typeof defineString> = defineString('SELF_SERVICE_TENANTS', { default: '', description: 'Set to false to stop sign-up from creating an organization for each new account. Empty or true: every new account gets its own organization.' });

/**
 * `''` e `true` abrem; `false` fecha. Qualquer outra coisa FECHA, com aviso no log: quem escreveu `no` ou
 * `off` quis desligar, e ler isso como "ligado" abriria escritórios numa instalação compartilhada
 * justamente quando alguém tentou impedir.
 */
export const selfServiceTenantsOf = (raw: string): boolean => {
  const value = raw.trim().toLowerCase();
  if (value === '' || value === 'true') return true;
  if (value !== 'false') {
    logger.error(`[bootstrap] SELF_SERVICE_TENANTS="${raw}" is not "true" or "false"; treating it as false.`);
  }
  return false;
};

export const selfServiceTenantsEnabled = (): boolean => selfServiceTenantsOf(SELF_SERVICE_TENANTS.value());
