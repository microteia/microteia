import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DocumentTemplateContext } from './useDocumentTemplates';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import {
  makeDeleteDocumentTemplateUseCase,
  makeGenerateDocumentUseCase,
  makeGetDocumentTemplatesUseCase,
  makeSaveDocumentTemplateUseCase,
  makeSubscribeToDocumentTemplatesUseCase,
} from '../domain/usecases/documents/DocumentTemplateUseCases';
import type { DocumentTemplate } from '../domain/schema/document/documentTemplate';
import type {
  DocumentTemplateInput,
  GenerateDocumentInput,
} from '../domain/repositories/IDocumentTemplateRepository';
import { LocalizedError } from '../domain/errors/LocalizedError';

/**
 * Os modelos de documento do escritório.
 *
 * Guarda só o que o ESCRITÓRIO gravou. Os modelos de pacote não passam por aqui: são contribuições
 * do host do escritório, que fica ABAIXO deste provedor na árvore — quem junta os dois é
 * `useResolvedDocumentTemplates`, pela mesma regra que o servidor aplica.
 */
export const DocumentTemplateStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { documentTemplateRepository } = useDI();

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetDocumentTemplatesUseCase(documentTemplateRepository),
    subscribe: makeSubscribeToDocumentTemplatesUseCase(documentTemplateRepository),
    save: makeSaveDocumentTemplateUseCase(documentTemplateRepository),
    delete: makeDeleteDocumentTemplateUseCase(documentTemplateRepository),
    generate: makeGenerateDocumentUseCase(documentTemplateRepository),
  }), [documentTemplateRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      setTemplates(await uc.get.execute(currentTenant.id));
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, uc.get]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa o cache ao sair do escritório
      setTemplates([]);
      return;
    }
    setIsLoading(true);
    const unsub = uc.subscribe.execute(currentTenant.id, (list) => {
      setTemplates(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, [currentTenant, uc.subscribe]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.DOCUMENT_TEMPLATES_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const saveTemplate = useCallback(async (input: DocumentTemplateInput) => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    await uc.save.execute(currentTenant.id, input, user?.id ?? null);
    storeEvents.emit(StoreEvents.DOCUMENT_TEMPLATES_UPDATED);
  }, [currentTenant, user, uc.save]);

  const deleteTemplate = useCallback(async (key: string) => {
    if (!currentTenant) return;
    await uc.delete.execute(currentTenant.id, key);
    storeEvents.emit(StoreEvents.DOCUMENT_TEMPLATES_UPDATED);
  }, [currentTenant, uc.delete]);

  const generateDocument = useCallback(async (input: Omit<GenerateDocumentInput, 'tenantId'>) => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    const result = await uc.generate.execute({ ...input, tenantId: currentTenant.id });
    if (result.document && result.destination !== 'downloads') storeEvents.emit(StoreEvents.RECORD_DOCUMENTS_UPDATED);
    return result;
  }, [currentTenant, uc.generate]);

  return (
    <DocumentTemplateContext.Provider value={{
      templates,
      isLoading,
      saveTemplate,
      deleteTemplate,
      generateDocument,
      refresh,
    }}>
      {children}
    </DocumentTemplateContext.Provider>
  );
};
