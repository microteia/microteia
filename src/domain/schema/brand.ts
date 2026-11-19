/**
 * A IDENTIDADE da instalação: o produto que ela é para quem a usa.
 *
 * Uma instalação da Microteia costuma ser um produto de um ramo só — gestão jurídica, gestão de
 * fatura de energia —, e quem abre a tela de entrada está entrando NESSE produto, não na plataforma
 * que o executa. A identidade é da INSTALAÇÃO, e não do escritório, porque a tela de entrada roda
 * acima de qualquer escritório: não há tenant de onde lê-la. Pelo mesmo motivo do SSO, ela chega
 * carimbada pelo `microteia deploy`.
 *
 * `name`, `tagline` e `description` são DADO de quem instala, como o nome de uma tela que o
 * escritório digitou: passam por `useLabel()`, e uma referência `@namespace/chave` é a saída para
 * quem quiser traduzi-los.
 */
export interface InstallationBrand {
  name: string;
  /** A frase curta, sob o nome na barra lateral. */
  tagline: string | null;
  /** A frase da tela de entrada. Ausente, vale a `tagline`. */
  description: string | null;
  /** Caminho na própria instalação (`/brand/logo-<hash>.png`). Ausente, vale o logo da plataforma. */
  logo: string | null;
  /** `#rrggbb`. Ausente, vale a cor do tema escolhido. */
  accent: string | null;
}

const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i;

export const isAccentColor = (value: unknown): value is string =>
  typeof value === 'string' && ACCENT_PATTERN.test(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

/**
 * Só caminho da PRÓPRIA origem. O carimbo é escrito pelo nosso Console, mas é o primeiro código que a
 * página lê, e um `//outro-host/x.png` ou um `javascript:` editado à mão ali iria direto para o `src`
 * de uma imagem na tela de entrada.
 */
const sameOriginPath = (value: unknown): string | null => {
  const path = text(value);
  if (path === null) return null;
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') ? path : null;
};

/**
 * Lê o carimbo sem nunca lançar: um deploy interrompido ou uma edição à mão produzem o mesmo tipo de
 * arquivo pela metade, e aqui uma exceção é a tela branca. Sem `name` não há identidade — é a forma
 * do placeholder que viaja no pacote, e é o que devolve a instalação à identidade da plataforma.
 */
export const parseStampedBrand = (stamped: unknown): InstallationBrand | null => {
  if (typeof stamped !== 'object' || stamped === null || Array.isArray(stamped)) return null;
  const source = stamped as Record<string, unknown>;
  const name = text(source.name);
  if (name === null) return null;
  return {
    name,
    tagline: text(source.tagline),
    description: text(source.description),
    logo: sameOriginPath(source.logo),
    accent: isAccentColor(source.accent) ? source.accent.toLowerCase() : null,
  };
};
