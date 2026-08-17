/**
 * O nome da faixa de abas da tela do escritório. Quem quiser acrescentar uma aba declara este mesmo
 * nome em `ui.tab`.
 *
 * Vive num módulo próprio, e não no manifest, porque as duas pontas o leem: o manifest, ao declarar
 * as abas, e a tela, ao hospedar a superfície. Se estivesse no manifest, a tela — carregada sob
 * demanda por ele — importaria de volta quem a carregou.
 */
export const TENANT_SETTINGS_SURFACE = 'tenant-settings';
