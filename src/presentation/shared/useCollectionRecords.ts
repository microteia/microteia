import { useMemo } from 'react';
import { useRecords } from '../../stores/useRecords';
import { toDateValue } from '../../data/utils/toDateValue';

/**
 * Os registros de uma coleção, para uma tela que só precisa LER o que outra entidade guarda —
 * tipicamente para mostrar o nome do registro vinculado ou filtrar por ele.
 *
 * O tipo é do CONSUMIDOR, não do sistema: quem chama diz a forma que usa. É o que permite uma tela
 * nativa depender de uma entidade sem que o kernel a declare — a entidade é descrita pela extensão
 * que a instala, e esta tela vê apenas os campos que exibe.
 *
 * A coleção só tem registros quando alguma tela do escritório a descreve (é ela que o
 * `RecordStore` assina). Sem a extensão instalada, a lista vem vazia — e a tela que a consome
 * mostra o estado vazio, em vez de dado errado.
 */
export const useCollectionRecords = <T extends { id: string }>(collection: string): T[] => {
  const { recordsByCollection } = useRecords();
  return useMemo(
    () => (recordsByCollection[collection] ?? []) as unknown as T[],
    [recordsByCollection, collection],
  );
};

/**
 * A forma de um PROCESSO como as telas ainda nativas (Prazos, Financeiro, Contratos, Agenda,
 * painéis) precisam lê-lo. Não é a declaração da entidade — essa vive na extensão que instala a
 * tela de Processos —, é o contrato de LEITURA de quem exibe um processo vinculado. Sai junto com
 * a última dessas telas a migrar.
 */
export interface CaseRecord {
  id: string;
  caseNumber: string;
  title: string;
  area: string;
  phase: string;
  status: string;
  instance: string;
  court: string;
  responsibleLawyerId: string | null;
  contractId: string | null;
  activePoleIds: string[];
  passivePoleIds: string[];
  causeValue: number | null;
  filedAt: Date | null;
  tagIds: string[];
  createdAt: Date | null;
}

/**
 * A forma de uma PESSOA como as telas ainda nativas (Contratos, Prazos, Financeiro, Agenda, painéis,
 * paleta de comandos) precisam lê-la. Não é a declaração da entidade — essa vive na extensão que
 * instala a tela de Pessoas —, é o contrato de LEITURA de quem exibe uma pessoa vinculada.
 */
export interface PersonRecord {
  id: string;
  name: string;
  type: string;
  email: string;
  cpf: string;
  cnpj: string;
  phone: string;
  status: string;
  relationship: string;
  tagIds: string[];
}

/** A coleção dos processos. Nomeada uma vez para que a chave não se espalhe pelas telas. */
export const CASES_COLLECTION = 'cases';

/** A coleção das pessoas. Mesmo motivo. */
export const PERSONS_COLLECTION = 'persons';

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const list = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);
const ref = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/**
 * Os processos na forma acima. A normalização mora aqui, e não em cada tela: a coleção tem mais de
 * um escritor e documentos de épocas diferentes, então campo ausente vira vazio e data em formato
 * antigo vira `Date` — nenhuma tela precisa se defender disso.
 */
export const useCaseRecords = (): CaseRecord[] => {
  const records = useCollectionRecords<Record<string, unknown> & { id: string }>(CASES_COLLECTION);
  return useMemo(
    () => records.map((record) => ({
      id: record.id,
      caseNumber: text(record.caseNumber),
      title: text(record.title),
      area: text(record.area),
      phase: text(record.phase),
      status: text(record.status),
      instance: text(record.instance),
      court: text(record.court),
      responsibleLawyerId: ref(record.responsibleLawyerId),
      contractId: ref(record.contractId),
      activePoleIds: list(record.activePoleIds),
      passivePoleIds: list(record.passivePoleIds),
      causeValue: typeof record.causeValue === 'number' ? record.causeValue : null,
      filedAt: toDateValue(record.filedAt),
      tagIds: list(record.tagIds),
      createdAt: toDateValue(record.createdAt),
    })),
    [records],
  );
};

/**
 * As pessoas na forma acima, ordenadas por nome — a ordem em que toda tela as apresenta.
 *
 * A normalização mora aqui pelo mesmo motivo dos processos: a coleção tem mais de um escritor e
 * documentos de épocas diferentes, então campo ausente vira vazio e nenhuma tela precisa se defender
 * disso.
 */
export const usePersonRecords = (): PersonRecord[] => {
  const records = useCollectionRecords<Record<string, unknown> & { id: string }>(PERSONS_COLLECTION);
  return useMemo(
    () => records
      .map((record) => ({
        id: record.id,
        name: text(record.name),
        type: text(record.type),
        email: text(record.email),
        cpf: text(record.cpf),
        cnpj: text(record.cnpj),
        phone: text(record.phone),
        status: text(record.status),
        relationship: text(record.relationship),
        tagIds: list(record.tagIds),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [records],
  );
};
