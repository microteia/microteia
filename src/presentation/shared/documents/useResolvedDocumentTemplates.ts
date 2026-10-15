import { useMemo } from 'react';
import { useContributions } from '../../../stores/useKernel';
import { useDocumentTemplates } from '../../../stores/useDocumentTemplates';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import type {
  ResolvedDocumentTemplate,
  ScreenKeyOfSource,
  TemplateScreenIndex,
} from '../../../domain/schema/document/documentTemplate';
import {
  DOCUMENT_TEMPLATE_POINT,
  resolveDocumentTemplates,
  templateScreenIndex,
} from '../../../domain/schema/document/documentTemplate';

/** A chave e a coleção de cada tela instalada — a mesma pergunta que o servidor faz ao esquema. */
const useTemplateScreenIndex = (): TemplateScreenIndex => {
  const { definitions } = useScreenDefinitions();
  return useMemo(
    () => templateScreenIndex(definitions.map((definition) => ({
      key: definition.id,
      sourceId: definition.sourceId,
      collection: definition.dataCollection,
    }))),
    [definitions],
  );
};

/** A chave instalada da tela de cada `sourceId`. */
export const useScreenKeyOfSource = (): ScreenKeyOfSource => useTemplateScreenIndex().keyOfSource;

/**
 * Os modelos que VALEM no escritório: as contribuições `document.template` do host do escritório,
 * sobrepostas pelos documentos que ele gravou. É a mesma função que o servidor aplica — o modelo
 * oferecido aqui é o modelo que a geração encontra.
 */
export const useResolvedDocumentTemplates = (): ResolvedDocumentTemplate[] => {
  const { templates } = useDocumentTemplates();
  const contributions = useContributions(DOCUMENT_TEMPLATE_POINT);
  const screens = useTemplateScreenIndex();
  return useMemo(
    () => resolveDocumentTemplates(contributions, templates, screens),
    [contributions, templates, screens],
  );
};
