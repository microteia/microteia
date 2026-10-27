import type { IRecordImportJobRepository, RecordImportJob } from './IRecordImportJobRepository';
import { emptyImportTotals } from '../schema/recordImport';

/** Os jobs em memória, com as mesmas duas propriedades de que a corretude depende: soma e fecho único. */
export class FakeRecordImportJobs implements IRecordImportJobRepository {
  readonly jobs = new Map<string, RecordImportJob & { expiresAt: Date }>();

  private seq = 0;

  async create(_tenantId: string, job: Parameters<IRecordImportJobRepository['create']>[1]): Promise<string> {
    this.seq += 1;
    const id = `import-${this.seq}`;
    this.jobs.set(id, { ...job, id, status: 'running', totals: emptyImportTotals() });
    return id;
  }

  async get(_tenantId: string, importId: string): Promise<RecordImportJob | null> {
    const job = this.jobs.get(importId);
    return job ? { ...job, totals: { ...job.totals } } : null;
  }

  async addTotals(_tenantId: string, importId: string, totals: RecordImportJob['totals']): Promise<void> {
    const job = this.jobs.get(importId);
    if (!job) throw new Error(`no job ${importId}`);
    job.totals = {
      created: job.totals.created + totals.created,
      updated: job.totals.updated + totals.updated,
      failed: job.totals.failed + totals.failed,
    };
  }

  async close(_tenantId: string, importId: string, status: 'finished' | 'cancelled'): Promise<RecordImportJob | null> {
    const job = this.jobs.get(importId);
    if (!job || job.status !== 'running') return null;
    job.status = status;
    return { ...job, totals: { ...job.totals } };
  }
}
