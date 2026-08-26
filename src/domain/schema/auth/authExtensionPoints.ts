import type { ExtensionPointDefinition } from '../plugin/extensionPoint';

export const AUTH_PROVIDER_POINT = 'auth.provider';

export const AUTH_API_VERSION = '1.0.0';

/**
 * COMO o produto fala com um provedor de identidade. É uma união fechada, e é a chave de todo o
 * desenho: `oidc` e `saml` são os dois em que o escritório escolhe o provedor, e os dois são
 * configurados no Firebase Auth do próprio projeto — o que resta ao pacote é DIZER o id, nunca
 * implementar o protocolo.
 *
 * É por isso que este ponto não aceita implementação nenhuma. Um SSO corporativo cabe inteiro numa
 * declaração; exigir código o tornaria privilégio de primeira parte, e SSO é justamente o que cada
 * escritório precisa acrescentar sem passar por nós.
 *
 * `password` não é um provedor externo: é o formulário de e-mail e senha do próprio produto. Está na
 * mesma lista porque é a MESMA decisão — quem entra por onde —, e é o que permite uma instalação de
 * SSO obrigatório simplesmente não declará-lo.
 */
export type AuthProviderKind =
  | 'password'
  | 'google'
  | 'facebook'
  | 'microsoft'
  | 'apple'
  | 'github'
  | 'oidc'
  | 'saml';

export const AUTH_PROVIDER_KINDS: readonly AuthProviderKind[] = [
  'password',
  'google',
  'facebook',
  'microsoft',
  'apple',
  'github',
  'oidc',
  'saml',
] as const;

/**
 * As espécies em que `providerId` é OBRIGATÓRIO: sem ele o Firebase não sabe a quem falar, e o botão
 * apareceria na tela de entrada para falhar no clique.
 */
export const AUTH_PROVIDER_KINDS_REQUIRING_ID: readonly AuthProviderKind[] = ['oidc', 'saml'] as const;

/**
 * `popup` abre uma janela; `redirect` sai desta página e volta. O padrão é `popup` porque é o que já
 * valia, mas `redirect` não é um capricho: é o único caminho onde a janela é bloqueada — navegador
 * corporativo endurecido, dentro de um iframe, num aplicativo embutido.
 */
export type AuthProviderFlow = 'popup' | 'redirect';

/**
 * Um MEIO DE ENTRAR, como a tela de entrada o mostra e como o produto o executa.
 *
 * Tudo aqui é serializável, e isso é requisito: a declaração viaja num `.json` até um escritório que
 * não roda este bundle. `label` é referência de mensagem (`@ns/chave`) quando o texto é do pacote, ou
 * o texto que o escritório escreveu — a mesma regra de `useLabel()` de qualquer rótulo declarativo.
 */
export interface AuthProviderMetadata {
  key: string;
  label: string;
  kind: AuthProviderKind;
  /**
   * O id configurado no Firebase Auth do projeto — `oidc.acme`, `saml.acme`. Obrigatório em `oidc` e
   * `saml`, ignorado nas demais espécies, que têm o id fixo do provedor.
   */
  providerId?: string;
  scopes?: string[];
  /** Parâmetros do provedor (`prompt`, `hd`, `tenant`), repassados como declarados. */
  customParameters?: Record<string, string>;
  flow?: AuthProviderFlow;
  /** Chave do conjunto curado de `screenIcons`, para a espécie que não tem marca conhecida. */
  icon?: string;
  order?: number;
  defaultEnabled?: boolean;
}

export const AUTH_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: AUTH_PROVIDER_POINT,
    apiVersion: AUTH_API_VERSION,
    title: '@core.auth/point.provider',
    description: '@core.auth/point.provider.description',
    ownerPluginId: 'core.auth',
    allowedImplKinds: [],
    implRequired: false,
    multiple: true,
  },
];

/**
 * O que o repositório precisa para executar a entrada — a metadata sem o que é só da TELA (rótulo,
 * ícone, ordem). Existe separada porque a camada de dados não deve receber texto de interface: o
 * `FirebaseAuthRepository` não tem o que fazer com um rótulo, e recebê-lo o convidaria a exibi-lo.
 */
export interface AuthProviderSpec {
  kind: AuthProviderKind;
  providerId?: string;
  scopes?: string[];
  customParameters?: Record<string, string>;
  flow?: AuthProviderFlow;
}

export const authProviderSpecOf = (metadata: AuthProviderMetadata): AuthProviderSpec => ({
  kind: metadata.kind,
  providerId: metadata.providerId,
  scopes: metadata.scopes,
  customParameters: metadata.customParameters,
  flow: metadata.flow,
});

/**
 * A metadata solta de um `.json` de terceiro, lida com desconfiança. Declaração incompleta descarta
 * o PROVEDOR, e não a tela de entrada: um botão que não sabe a quem falar é pior que um botão
 * ausente, porque tranca quem clicou nele fora do sistema sem dizer por quê.
 */
export const asAuthProviderMetadata = (
  metadata: Record<string, unknown>,
): AuthProviderMetadata | null => {
  const { key, label, kind } = metadata;
  if (typeof key !== 'string' || key === '') return null;
  if (typeof label !== 'string' || label === '') return null;
  if (typeof kind !== 'string' || !AUTH_PROVIDER_KINDS.includes(kind as AuthProviderKind)) return null;

  const providerKind = kind as AuthProviderKind;
  const providerId = typeof metadata.providerId === 'string' ? metadata.providerId : undefined;
  if (AUTH_PROVIDER_KINDS_REQUIRING_ID.includes(providerKind) && !providerId) return null;

  const scopes = Array.isArray(metadata.scopes) && metadata.scopes.every((scope) => typeof scope === 'string')
    ? (metadata.scopes as string[])
    : undefined;

  const declaredParameters = metadata.customParameters;
  const customParameters = declaredParameters && typeof declaredParameters === 'object'
    ? Object.fromEntries(
      Object.entries(declaredParameters as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    )
    : undefined;

  return {
    key,
    label,
    kind: providerKind,
    providerId,
    scopes,
    customParameters,
    flow: metadata.flow === 'redirect' ? 'redirect' : undefined,
    icon: typeof metadata.icon === 'string' ? metadata.icon : undefined,
    order: typeof metadata.order === 'number' ? metadata.order : undefined,
    defaultEnabled: typeof metadata.defaultEnabled === 'boolean' ? metadata.defaultEnabled : undefined,
  };
};
