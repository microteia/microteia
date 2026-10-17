import { buildPermissionCatalog } from './resolvePermissions';
import { KERNEL_PERMISSIONS, KERNEL_PERMISSION_RESOURCES } from './kernelPermissions';
import { textFingerprint } from '../contentFingerprint';

/**
 * A impressão digital do que o CÓDIGO diz sobre permissões — o que muda com a versão do kernel e
 * que nenhum gatilho do Firestore consegue observar.
 *
 * Os gatilhos cobrem o banco: perfil, membro, tela, extensão. Não cobrem o dia em que uma versão
 * nova altera de que uma permissão depende — nenhuma escrita acontece para acordá-los, e o conjunto
 * materializado que as Security Rules leem fica velho em silêncio, enquanto a tela (que recalcula
 * sozinha) segue acertando. O sintoma é "a tela oferece e salvar recusa", e ninguém o associa à
 * causa. Carimbar esta digital em cada membro é o que deixa o próprio sistema perceber a diferença.
 *
 * **Ela é DERIVADA, nunca escrita à mão.** Um número que alguém precisa lembrar de subir é um número
 * que fica para trás — e ficaria justamente na versão em que a mudança importava. Por isso ela não é
 * o `KERNEL_VERSION`: aquele só se move quando o PACOTE INSTALADO muda de forma, e mudar o `requires`
 * de uma permissão do núcleo não o move.
 */

/**
 * O recurso sintético existe para que a digital cubra a DERIVAÇÃO, e não só os dados declarados.
 * Foi uma regra de derivação que criou o problema em primeiro lugar — o dia em que criar, editar e
 * excluir passaram a exigir ver. Sem ele, aquela mudança não moveria digital nenhuma.
 */
const DERIVATION_PROBE = 'derivationProbe';

const catalogShape = (): string => {
  const catalog = buildPermissionCatalog(
    KERNEL_PERMISSIONS.map((permission) => ({ permission, source: 'core.access' })),
    [...KERNEL_PERMISSION_RESOURCES, { id: DERIVATION_PROBE, name: DERIVATION_PROBE, deriveCrud: true }],
  );
  return catalog.list
    .map((permission) => `${permission.id}<${[...permission.requires].sort().join(',')}`)
    .join('|');
};

/**
 * Só `id` e `requires` entram: é o que decide o conjunto EFETIVO. Rótulo e descrição mudam a cada
 * tradução e não mudariam permissão nenhuma — incluí-los faria o escritório inteiro recalcular à
 * toa a cada ajuste de texto.
 */
export const KERNEL_CATALOG_FINGERPRINT = textFingerprint(catalogShape());
