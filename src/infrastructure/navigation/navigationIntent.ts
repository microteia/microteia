type FilterIntent = { key: string; values: string[] }[];

const intents = new Map<string, FilterIntent>();

export const setNavigationIntent = (screenKey: string, tokens: FilterIntent): void => {
  intents.set(screenKey, tokens);
};

export const consumeNavigationIntent = (screenKey: string): FilterIntent | undefined => {
  const tokens = intents.get(screenKey);
  intents.delete(screenKey);
  return tokens;
};
