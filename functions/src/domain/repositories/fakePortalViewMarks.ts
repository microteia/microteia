import type { IPortalViewMarks } from './IPortalViewMarks';
import { isRepeatedPortalView } from '../schema/portal';

/** As marcas em memória, com a MESMA regra de janela da implementação do Firestore. */
export const makeFakePortalViewMarks = () => {
  const marks = new Map<string, { tenantId: string; at: Date }>();
  const port: IPortalViewMarks = {
    claim: async (markId, tenantId, at) => {
      if (isRepeatedPortalView(marks.get(markId)?.at ?? null, at)) return false;
      marks.set(markId, { tenantId, at });
      return true;
    },
    release: async (markId, at) => {
      if (marks.get(markId)?.at.getTime() === at.getTime()) marks.delete(markId);
    },
  };
  return { port, marks };
};
