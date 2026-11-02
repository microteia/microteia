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
  SAVED_FILTER_UPDATED: 'saved_filter:updated',
  SCREEN_DEFINITIONS_UPDATED: 'screen_definitions:updated',
  RECORDS_UPDATED: 'records:updated',
  WORKFLOWS_UPDATED: 'workflows:updated',
  SCRIPTS_UPDATED: 'scripts:updated',
  ACTIONS_UPDATED: 'actions:updated',
  REPORTS_UPDATED: 'reports:updated',
  DOCUMENT_TEMPLATES_UPDATED: 'document-templates:updated',
  RECORD_DOCUMENTS_UPDATED: 'record-documents:updated',
  ROLES_UPDATED: 'roles:updated',
  BUSINESS_CALENDARS_UPDATED: 'business-calendars:updated',
} as const;
