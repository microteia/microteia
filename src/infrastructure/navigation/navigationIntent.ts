type FilterIntent = { key: string; values: string[] }[];
type IntentListener = (tokens: FilterIntent) => void;

const intents = new Map<string, FilterIntent>();
const listeners = new Map<string, Set<IntentListener>>();

export const setNavigationIntent = (screenKey: string, tokens: FilterIntent): void => {
  const subscribers = listeners.get(screenKey);
  if (subscribers && subscribers.size > 0) {
    subscribers.forEach((listener) => listener(tokens));
    return;
  }
  intents.set(screenKey, tokens);
};

export const consumeNavigationIntent = (screenKey: string): FilterIntent | undefined => {
  const tokens = intents.get(screenKey);
  intents.delete(screenKey);
  return tokens;
};

export const subscribeNavigationIntent = (screenKey: string, listener: IntentListener): (() => void) => {
  let subscribers = listeners.get(screenKey);
  if (!subscribers) {
    subscribers = new Set();
    listeners.set(screenKey, subscribers);
  }
  subscribers.add(listener);
  return () => subscribers.delete(listener);
};
