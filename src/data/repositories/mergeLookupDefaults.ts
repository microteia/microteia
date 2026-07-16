interface LookupDefaultLike {
  key: string;
  label: string;
}

export const mergeLookupDefaults = <T extends LookupDefaultLike>(statics: T[], dynamic: T[]): T[] => {
  const reserved = new Set<string>(statics.flatMap((item) => [item.key, item.label]));
  const uniqueDynamic = dynamic.filter((item) => !reserved.has(item.key) && !reserved.has(item.label));
  return [...statics, ...uniqueDynamic].sort((a, b) => a.label.localeCompare(b.label));
};
