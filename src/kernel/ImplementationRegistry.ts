export interface ImplementationRegistry {
  register(pluginId: string, key: string, implementation: unknown): void;
  resolve<T>(pluginId: string, key: string): T | undefined;
  has(pluginId: string, key: string): boolean;
  keysOf(pluginId: string): string[];
  size(): number;
  removeByPlugin(pluginId: string): number;
  clear(): void;
}

const compositeKey = (pluginId: string, key: string): string => `${pluginId}::${key}`;

/**
 * Guarda as implementações `impl: { kind: 'code' }` dos plugins first-party. É o único lugar do
 * Kernel que conhece um valor não-serializável, e mesmo assim só por chave opaca — o Kernel nunca
 * sabe o que a função faz nem de onde veio. Namespaced por plugin, para que dois plugins possam
 * usar a mesma chave sem colidir.
 */
export const createImplementationRegistry = (): ImplementationRegistry => {
  const implementations = new Map<string, unknown>();

  return {
    register(pluginId, key, implementation) {
      implementations.set(compositeKey(pluginId, key), implementation);
    },

    resolve<T>(pluginId: string, key: string): T | undefined {
      return implementations.get(compositeKey(pluginId, key)) as T | undefined;
    },

    has: (pluginId, key) => implementations.has(compositeKey(pluginId, key)),

    keysOf: (pluginId) => {
      const prefix = `${pluginId}::`;
      return Array.from(implementations.keys())
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length))
        .sort();
    },

    size: () => implementations.size,

    removeByPlugin(pluginId) {
      const prefix = `${pluginId}::`;
      let removed = 0;
      for (const key of implementations.keys()) {
        if (key.startsWith(prefix)) {
          implementations.delete(key);
          removed += 1;
        }
      }
      return removed;
    },

    clear: () => implementations.clear(),
  };
};
