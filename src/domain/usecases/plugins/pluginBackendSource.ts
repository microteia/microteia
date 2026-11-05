import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { BackendSourceIssueCode } from '../../schema/plugin/backendSource';
import { backendSourceIssues } from '../../schema/plugin/backendSource';
import type { LocalizedIssue } from './pluginReferences';

const ISSUE_MESSAGE: Record<BackendSourceIssueCode, string> = {
  shape: '@core.marketplace/issue.backend-source.shape',
  path: '@core.marketplace/issue.backend-source.path',
  'no-index': '@core.marketplace/issue.backend-source.no-index',
  undeclared: '@core.marketplace/issue.backend-source.undeclared',
};

/** A fonte das Cloud Functions que o pacote traz — ver `PackagedBackendSource`. */
export const packageBackendSourceIssues = (pkg: MarketplacePlugin): LocalizedIssue[] =>
  backendSourceIssues(pkg.backendSource, pkg.manifest.backend?.functions ?? []).map((issue) => ({
    message: ISSUE_MESSAGE[issue.code],
    ...(issue.path !== undefined ? { messageParams: { path: issue.path } } : {}),
  }));
