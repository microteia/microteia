import type { Bucket } from '@google-cloud/storage';
import type { AuditArchivePutResult, IAuditArchiveStore } from '../../domain/repositories/IAuditArchiveStore';
import type { AuditArchiveProtection } from '../../domain/schema/auditRetention';

const SECONDS_PER_DAY = 24 * 60 * 60;

const statusOf = (error: unknown): number | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'number' ? code : undefined;
};

/**
 * O bucket do arquivo da Auditoria. NÃO é o bucket padrão do projeto: aquele guarda anexos que se
 * apagam, e um bucket com retenção bloqueada não deixa apagar nada.
 *
 * Gravar é `ifGenerationMatch: 0` — "só se não existir" —, e é o servidor de armazenamento que garante,
 * não uma leitura antes. Com o 412, quem decide se é a reexecução do mesmo dia ou outro conteúdo é a
 * comparação byte a byte.
 */
export class GcsAuditArchiveStore implements IAuditArchiveStore {
  constructor(
    private readonly bucketName: string,
    private readonly bucketOf: (name: string) => Bucket,
  ) {}

  isConfigured(): boolean {
    return this.bucketName.trim() !== '';
  }

  private bucket(): Bucket {
    return this.bucketOf(this.bucketName.trim());
  }

  async protection(): Promise<AuditArchiveProtection> {
    const [metadata] = await this.bucket().getMetadata();
    const policy = metadata.retentionPolicy;
    const seconds = policy?.retentionPeriod === undefined ? Number.NaN : Number(policy.retentionPeriod);
    return {
      bucketRetentionLocked: policy?.isLocked === true,
      bucketRetentionDays: Number.isFinite(seconds) ? Math.floor(seconds / SECONDS_PER_DAY) : null,
      objectRetentionLock: metadata.objectRetention?.mode === 'Enabled',
    };
  }

  async put(path: string, content: string, retainUntil: Date | null): Promise<AuditArchivePutResult> {
    try {
      await this.bucket().file(path).save(content, {
        resumable: false,
        preconditionOpts: { ifGenerationMatch: 0 },
        metadata: {
          contentType: 'application/x-ndjson; charset=utf-8',
          ...(retainUntil ? { retention: { mode: 'Locked', retainUntilTime: retainUntil.toISOString() } } : {}),
        },
      });
      return 'created';
    } catch (error) {
      if (statusOf(error) !== 412) throw error;
      return (await this.read(path)) === content ? 'identical' : 'conflict';
    }
  }

  async read(path: string): Promise<string | null> {
    try {
      const [buffer] = await this.bucket().file(path).download();
      return buffer.toString('utf8');
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const [files] = await this.bucket().getFiles({ prefix });
    return files.map((file) => file.name);
  }
}
