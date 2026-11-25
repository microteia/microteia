import { canonicalJson } from '../contentFingerprint';
import type { SchemaContext } from '../screenEntity';
import { memberVisibilityBypass, resolveMemberVisibility } from '../memberVisibility';
import { reportViewPermissionId } from '../access/artifactAccess';
import type { RestrictedReportSource } from '../access/artifactAccess';
import { reportSourceCollections } from './reportSpec';
import type { ReportSpec } from './reportSpec';
import { isSnapshotReport, reportAccessPermissions } from './reportSnapshot';

/**
 * O relatório como PORTA (#33).
 *
 * Restrito, ele gera a própria permissão ("Abrir"). O problema é quem responde pelo dado que ele entrega:
 * se a permissão dele substituísse a leitura das coleções, quem EDITA o relatório decidiria o que ele
 * mostra — a Analista sem acesso a Funcionários acrescentaria salário a "Vendas por mês" e o veria. Por
 * isso a porta só abre AVALIZADA: no salvamento, o servidor confere que quem salvou lê tudo o que o
 * relatório toca e guarda, num campo que o cliente não grava, a cópia do spec que ele avalizou.
 *
 * Conferir no salvamento, e não na execução, é o que deixa o relatório sobreviver ao autor: o RH que sai
 * do escritório não tira do Diretor a folha que ele recebeu. Quem vê é decidido em Perfis.
 */
export interface ReportVouch {
  /** Quem respondeu pelo relatório — o uid de quem salvou, ou `extension:<id>` na instalação. */
  by: string;
  at?: unknown;
  /** O spec AVALIZADO. A porta só vale enquanto o spec atual for este. */
  spec: ReportSpec;
}

/** O aval lido do documento. Sem quem respondeu ou sem o spec, não há aval. */
export const reportVouchOf = (value: unknown): ReportVouch | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.by !== 'string' || !raw.by || typeof raw.spec !== 'object' || raw.spec === null) return null;
  return { by: raw.by, at: raw.at, spec: raw.spec as ReportSpec };
};

export interface ReportDoorSource {
  id: string;
  sourceId?: string | null;
  ownerId?: string | null;
  spec: ReportSpec;
  vouch?: ReportVouch | null;
}

/** O relatório PESSOAL nunca é porta: quem o abre é o autor, e ele já precisa ler o que o relatório lê. */
export const isRestrictedReport = (report: Pick<ReportDoorSource, 'ownerId' | 'spec'>): boolean =>
  !report.ownerId && report.spec?.access?.restricted === true;

/**
 * O aval vale para o spec ATUAL. Uma edição que não passou pelo servidor (o console do navegador, um lote
 * antigo) deixa o aval para trás, e o relatório volta a cobrar a leitura de quem o abre — falha fechada.
 */
export const reportVouchHolds = (report: Pick<ReportDoorSource, 'spec' | 'vouch'>): boolean =>
  !!report.vouch?.spec && canonicalJson(report.vouch.spec) === canonicalJson(report.spec);

export const isReportDoor = (report: ReportDoorSource): boolean =>
  isRestrictedReport(report) && reportVouchHolds(report);

/**
 * TUDO o que abrir o relatório exige — a callable, o drill, a série, a lista, o ⌘K e o MCP perguntam aqui.
 * `null` é a série sem origem: quem chama recusa.
 *
 * | Relatório | Exige |
 * |---|---|
 * | restrito e avalizado | só a permissão dele |
 * | restrito sem aval | a permissão dele E a leitura de cada coleção |
 * | do escritório, sem restrição | a leitura de cada coleção (e `access.permission`), como sempre |
 * | pessoal | idem |
 */
export const reportOpenPermissions = (
  report: ReportDoorSource,
  ctx: SchemaContext,
  source: ReportSpec | null | undefined,
): string[] | null => {
  if (isReportDoor(report)) return [reportViewPermissionId(report)];
  const ordinary = reportAccessPermissions(report.spec, ctx, source);
  if (ordinary === null) return null;
  return isRestrictedReport(report) ? [...new Set([reportViewPermissionId(report), ...ordinary])] : ordinary;
};

/**
 * O que quem SALVA um relatório restrito precisa ter para avalizá-lo: a leitura de cada coleção que ele
 * toca — inclusive as alcançadas por referência — e, onde a tela restringe por registro, a permissão que
 * vê todos. Sem a segunda, o vendedor que só enxerga as próprias vendas montaria "Total por vendedor" e
 * entregaria as de todo mundo.
 */
export const reportVouchPermissions = (
  spec: ReportSpec,
  ctx: SchemaContext,
  source: ReportSpec | null | undefined,
): string[] | null => {
  const ordinary = reportAccessPermissions(spec, ctx, source);
  if (ordinary === null) return null;
  const read = isSnapshotReport(spec) ? source : spec;
  const supervision = read
    ? reportSourceCollections(read, ctx).flatMap((collection) => {
      const visibility = resolveMemberVisibility(ctx, collection);
      return visibility ? [memberVisibilityBypass(visibility, collection)] : [];
    })
    : [];
  return [...new Set([...ordinary, ...supervision])];
};

/** Os relatórios como fontes do catálogo — a MESMA conta no `AuthorizationStore` e no `PermissionCatalogCache`. */
export const restrictedReportSources = (
  reports: readonly (Pick<ReportDoorSource, 'id' | 'sourceId' | 'ownerId' | 'spec'> & { title: string })[],
): RestrictedReportSource[] =>
  reports
    .filter((report) => isRestrictedReport(report))
    .map((report) => ({ id: report.id, sourceId: report.sourceId ?? null, title: report.title, restricted: true }));
