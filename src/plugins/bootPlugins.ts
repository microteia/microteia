import type { PluginRecord } from '../kernel';
import { extensionRecordFrom } from '../domain/usecases/plugins/extensionRecordFrom';
import { readStampedExtensions } from '../infrastructure/boot/stampedExtensions';
import { CORE_PLUGINS } from './index';

/**
 * O que o host BASE carrega: os plugins do núcleo mais as extensões carimbadas na instalação.
 *
 * É o host das rotas PÚBLICAS — a tela de entrada e os Termos. Dentro do escritório ele é substituído
 * pelo `TenantKernelProvider`, e é de propósito: o que a instalação carimba vale ANTES do login; o que
 * vale dentro é o que o escritório instalou. Misturar os dois faria uma extensão carimbada aparecer no
 * menu de todo escritório da instalação sem ninguém tê-la instalado.
 *
 * **Sempre `trusted: false`.** Nada carimbado roda JavaScript: um `impl: code` é ignorado pelo Kernel,
 * e o que passa é só declaração. Não é precaução — é o que permite carimbar sem revisar código, que é
 * a condição para isto ser útil a quem instala.
 *
 * Calculado uma vez, na carga do módulo, porque o carimbo não muda em tempo de execução: ele é um
 * arquivo servido antes do bundle.
 */
export const BOOT_PLUGINS: PluginRecord[] = [
  ...CORE_PLUGINS,
  ...readStampedExtensions().map((pkg) => extensionRecordFrom(pkg, false)),
];
