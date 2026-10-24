import { Timestamp } from 'firebase/firestore';

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/**
 * Um campo de data chega do Firestore como Timestamp. Como a coleção não tem mapper escrito à mão,
 * a conversão é genérica e recursiva — nada acima desta camada precisa conhecer o tipo do Firestore.
 *
 * É a fronteira dos DOIS leitores de registro do front: o escritório (`FirebaseRecordRepository`) e a
 * projeção do portal (`FirebasePortalRepository`). Uma view recebe a mesma forma pelos dois — a
 * projeção entregava o Timestamp cru, e o cartão que comparava datas mostrava menos do que devia,
 * sem erro nenhum.
 */
export const toPlainValues = (value: unknown): unknown => {
  if (value instanceof Timestamp) return value.toDate();
  if (Array.isArray(value)) return value.map(toPlainValues);
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPlainValues(item)]));
  }
  return value;
};
