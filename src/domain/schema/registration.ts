/**
 * CONTAS NOVAS NA INSTALAÇÃO — o que o `SYSTEM` decide, em Gestão de Acessos › Usuários, sobre quem
 * chega pela primeira vez. São duas perguntas, no mesmo documento:
 *
 * - `acceptNewAccounts`: a conta nova pode EXISTIR?
 * - `selfServiceTenants`: a conta nova ganha um escritório PRÓPRIO? Falso é a instalação compartilhada: a
 *   conta espera ser adicionada a um, e só o `SYSTEM` abre escritórios (`createOrganization`).
 *
 * As duas eram para ser configuração de instalação (o autocadastro de escritório foi `SELF_SERVICE_TENANTS`
 * no `.env`), e saíram de lá pelo mesmo motivo: mudar exigia redeploy das functions, e a decisão é de quem
 * administra o sistema, não de quem o instala.
 *
 * Fechada a trava, o primeiro acesso de quem ainda não tem conta é recusado, em TODOS os escritórios e por
 * qualquer provedor de entrada. Três decisões organizam o resto:
 *
 * 1. **A recusa acontece DEPOIS de a conta existir no Firebase Auth.** Impedir a criação em si exige
 *    uma blocking function (`beforeUserCreated`), e ela só existe no Identity Platform — o mesmo
 *    upgrade irreversível e cobrado que já foi recusado para o segundo fator. O gatilho de criação
 *    confere a trava, grava a recusa que o navegador lê e APAGA a conta: quem tentou não fica
 *    cadastrado, e volta a poder entrar no dia em que a trava abrir.
 * 2. **O documento ausente é ABERTO.** Uma instalação anterior ao recurso continua como estava; quem
 *    fecha é o bootstrap da PRIMEIRA conta (a que nasce `SYSTEM`), na mesma transação que a promove —
 *    instalação nova já nasce fechada.
 * 3. **O convidado do portal passa.** O escritório o convidou pelo e-mail (ou o servidor abriu a conta
 *    dele pelo provedor do portal): a entrada foi autorizada por quem responde por ela.
 */

/** Documento único da instalação. `system/` só é alcançado pelo Admin SDK, salvo este documento. */
export const REGISTRATION_POLICY_PATH = 'system/registration';

/** A recusa que o navegador de quem tentou entrar lê para explicar o motivo. Só o servidor escreve. */
export const REGISTRATION_REFUSALS_COLLECTION = 'registrationRefusals';

/** A recusa só serve à tentativa em curso; o TTL do Firestore (`expiresAt`) a expurga depois. */
export const REGISTRATION_REFUSAL_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * A frase que a tela de entrada mostra a quem foi recusado. Chave ABSOLUTA (com `/`): o `t()` de
 * qualquer namespace a resolve sem prefixo, e a referência `@` dela é o erro do domínio.
 */
export const REGISTRATION_CLOSED_KEY = 'core.workspace/login.error.registration-closed';
export const REGISTRATION_CLOSED_MESSAGE = `@${REGISTRATION_CLOSED_KEY}`;

export interface RegistrationPolicy {
  acceptNewAccounts: boolean;
  selfServiceTenants: boolean;
}

/**
 * Só `false` desliga: documento ausente, ou campo ilegível, é o comportamento de antes — conta nova
 * aceita, e com escritório próprio.
 */
export const registrationPolicyOf = (data: unknown): RegistrationPolicy => {
  const fields = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  return {
    acceptNewAccounts: fields.acceptNewAccounts !== false,
    selfServiceTenants: fields.selfServiceTenants !== false,
  };
};
