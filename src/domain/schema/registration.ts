import { isValidPluginId } from './plugin/artifactRef';
import { isValidLocale, normalizeLocale, type LocaleCode } from './i18n/localeNegotiation';

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
  /**
   * As extensões do catálogo que todo escritório novo recebe instaladas (ids). A marca é a intenção do
   * `SYSTEM`; quem decide o que de fato instalar, na criação do escritório, confere de novo o catálogo.
   * Ver `schema/plugin/defaultExtensions.ts`.
   */
  defaultExtensions: string[];
  /**
   * O idioma com que todo escritório novo nasce (`i18n.locale` dele), ou `null` para nascer sem idioma
   * escolhido — o idioma-fonte no servidor, o do navegador na tela.
   *
   * Existe por causa das SEMENTES, não da interface: o servidor resolve o texto semeado no idioma
   * GRAVADO do escritório no instante em que o grava, e não enxerga o navegador. Um escritório que
   * nascia sem idioma recebia as extensões padrão com os dados em inglês, mesmo com a tradução
   * instalada — e dali em diante aquilo é dado dele, que trocar o idioma não retraduz.
   *
   * Validado pela FORMA, nunca contra os pacotes instalados — a mesma regra de `i18n.locale`.
   */
  defaultLocale: LocaleCode | null;
  /**
   * O plano com que nasce o escritório novo — o do autocadastro e o que o `SYSTEM` abre em nome de
   * alguém (#24). O escritório recebe também o limite de membros do plano. `null`, ou um plano que não
   * existe ou foi arquivado, abre o escritório sem plano e com o limite de antes (`NO_PLAN_MEMBER_LIMIT`).
   */
  defaultPlanId: string | null;
}

const defaultExtensionsOf = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => isValidPluginId(id)))]
    : [];

const defaultLocaleOf = (value: unknown): LocaleCode | null =>
  typeof value === 'string' && value.trim() !== '' && isValidLocale(value) ? normalizeLocale(value) : null;

/**
 * Só `false` desliga: documento ausente, ou campo ilegível, é o comportamento de antes — conta nova
 * aceita, e com escritório próprio.
 */
export const registrationPolicyOf = (data: unknown): RegistrationPolicy => {
  const fields = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
  return {
    acceptNewAccounts: fields.acceptNewAccounts !== false,
    selfServiceTenants: fields.selfServiceTenants !== false,
    defaultExtensions: defaultExtensionsOf(fields.defaultExtensions),
    defaultLocale: defaultLocaleOf(fields.defaultLocale),
    defaultPlanId: typeof fields.defaultPlanId === 'string' && fields.defaultPlanId.trim() !== '' ? fields.defaultPlanId : null,
  };
};
