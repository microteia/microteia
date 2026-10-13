import type { RecordActionCommand } from '../../presentation/shared/recordActions/recordActionHost';
import { GenerateDocumentDialog } from '../../presentation/components/ui/GenerateDocumentDialog';

/**
 * "Gerar documento" pergunta antes de agir — que modelo, em que formato —, e por isso abre um
 * diálogo em vez de executar. A geração em si é do servidor, pelo mesmo caso de uso do passo
 * `render-document`.
 */
export const generateDocumentCommand: RecordActionCommand = (host) => {
  host.openDialog(GenerateDocumentDialog);
};
