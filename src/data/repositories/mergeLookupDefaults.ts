interface LookupDefaultLike {
  key: string;
  label: string;
}

/**
 * NÃO ordena: ordenar alfabeticamente exige o rótulo TRADUZIDO e a regra de colação do idioma, e
 * nada disso existe na camada de dados. A ordem alfabética é aplicada no `LookupStore`, que já
 * resolve as referências. Aqui fica só a mescla, na ordem "fixas primeiro, depois as do escritório".
 */
export const mergeLookupDefaults = <T extends LookupDefaultLike>(statics: T[], dynamic: T[]): T[] => {
  const reserved = new Set<string>(statics.flatMap((item) => [item.key, item.label]));
  const uniqueDynamic = dynamic.filter((item) => !reserved.has(item.key) && !reserved.has(item.label));
  return [...statics, ...uniqueDynamic];
};
