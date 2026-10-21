/**
 * O LOGO do escritório: um arquivo no Storage, e a URL de download dele em `tenants/{id}.logoURL`.
 * É do kernel, e não um campo do Form Design: quem o lê é o próprio núcleo — o topo do portal e o
 * cabeçalho do e-mail —, e um campo que cada escritório criasse com outro nome não chegaria a eles.
 *
 * A pasta é reservada no `storage.rules`: só quem altera o escritório envia, só imagem, até 2 MB, e
 * cada envio é um arquivo NOVO — ninguém sobrescreve o que um e-mail já enviado aponta.
 */
export const TENANT_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const tenantLogoStoragePath = (tenantId: string, fileName: string): string =>
  `tenants/${tenantId}/branding/logo/${fileName}`;
