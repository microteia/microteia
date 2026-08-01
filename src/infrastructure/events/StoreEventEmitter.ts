type EventCallback = () => void;

class StoreEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => cb());
    }
  }
}

export const storeEvents = new StoreEventEmitter();

export const StoreEvents = {
  PERSONS_UPDATED: 'persons:updated',
  PERSON_TAG_UPDATED: 'person_tag:updated',
  CASE_TAG_UPDATED: 'case_tag:updated',
  DEADLINES_UPDATED: 'deadlines:updated',
  NEWS_UPDATED: 'news:updated',
  NEWS_TAG_UPDATED: 'news_tag:updated',
  PUSH_UPDATED: 'push:updated',
  SAVED_FILTER_UPDATED: 'saved_filter:updated',
  SCREEN_DEFINITIONS_UPDATED: 'screen_definitions:updated',
  RECORDS_UPDATED: 'records:updated',
  WORKFLOWS_UPDATED: 'workflows:updated',
  SCRIPTS_UPDATED: 'scripts:updated',
  ACTIONS_UPDATED: 'actions:updated',
} as const;
