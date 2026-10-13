import { useMemo } from 'react';
import { useContributions } from '../../../stores/useKernel';
import { useDocumentTemplates } from '../../../stores/useDocumentTemplates';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import type { ResolvedDocumentTemplate, ScreenKeyOfSource } from '../../../domain/schema/document/documentTemplate';
import { DOCUMENT_TEMPLATE_POINT, resolveDocumentTemplates } from '../../../domain/schema/document/documentTemplate';

/** A chave instalada da tela de cada `sourceId` — a mesma pergunta que o servidor faz ao esquema. */
export const useScreenKeyOfSource = (): ScreenKeyOfSource => {
  const { definitions } = useScreenDefinitions();
  return useMemo(() => {
    const keyBySource = new Map(
      definitions.filter((definition) => !!definition.sourceId).map((definition) => [definition.sourceId as string, definition.id]),
    );
    return (sourceId: string) => keyBySource.get(sourceId);
  }, [definitions]);
};

/**
 * Os modelos que VALEM no escritório: as contribuições `document.template` do host do escritório,
 * sobrepostas pelos documentos que ele gravou. É a mesma função que o servidor aplica — o modelo
 * oferecido aqui é o modelo que a geração encontra.
 */
export const useResolvedDocumentTemplates = (): ResolvedDocumentTemplate[] => {
  const { templates } = useDocumentTemplates();
  const contributions = useContributions(DOCUMENT_TEMPLATE_POINT);
  const screenKeyOf = useScreenKeyOfSource();
  return useMemo(
    () => resolveDocumentTemplates(contributions, templates, screenKeyOf),
    [contributions, templates, screenKeyOf],
  );
};
