import { z } from 'zod';

export const extractedJulgadoSchema = z.object({
  processNumbers: z.array(z.string().min(1)).min(1),
  theme: z.string().min(1),
  court: z.string().min(1),
  legalBranch: z.string().min(1),
  relator: z.string().nullable(),
  panel: z.string().nullable(),
  judgmentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  publicationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  bulletinNumber: z.string().nullable(),
  highlight: z.string().min(1),
  fullText: z.string().min(1),
});

export const extractedJulgadosArraySchema = z.array(extractedJulgadoSchema);

export type ExtractedJulgado = z.infer<typeof extractedJulgadoSchema>;
