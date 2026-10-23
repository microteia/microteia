import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import type { DiagnosticCode, PluginDiagnostic } from '../domain/schema/plugin/diagnostics';
import { KERNEL_VERSION } from '../domain/schema/plugin/kernelVersion';
import { validatePluginManifest } from '../domain/schema/plugin/pluginManifest';
import type { PackageRef } from '../domain/usecases/plugins/pluginReferences';
import { packageIssues, validatePackage } from '../domain/usecases/plugins/pluginReferences';
import { workflowStepIssues } from '../domain/usecases/plugins/workflowIntegrity';
import type { NavTargetOwner } from '../domain/usecases/plugins/navTargets';
import { navTargetIssues } from '../domain/usecases/plugins/navTargets';
import { navFilterIssues } from '../domain/usecases/plugins/navFilters';

/**
 * De qual das três checagens o problema veio. Quem exibe usa isso para escolher a frase — a
 * referencial é a única que sabe apontar o artefato, e por isso é a única que carrega `ref`.
 */
export type SdkIssueSource = 'manifest' | 'reference' | 'package';

/**
 * Um problema de pacote, na forma que atravessa as três origens sem perder o que cada uma sabe.
 *
 * `message` é uma REFERÊNCIA de mensagem (`@core.marketplace/…`), nunca o texto: a validação roda no
 * domínio, no backend e num terminal fora daqui, onde não existe idioma. Quem exibe resolve.
 */
export interface SdkIssue {
  source: SdkIssueSource;
  message: string;
  messageParams?: Record<string, string>;
  /** Só em `source: 'manifest'` — o código do diagnóstico e o caminho dentro do manifest. */
  code?: DiagnosticCode;
  path?: string;
  /**
   * Só em `source: 'reference'` — o artefato de que a recusa FALA. Nem sempre é um alvo pendente: na
   * integridade de passo ele é a automação DONA do defeito, e tratá-lo como alvo faz a frase dizer
   * que a automação referencia a si mesma. Quem escolhe a frase escolhe pela `message`.
   */
  ref?: PackageRef;
}

export interface ValidatePluginPackageOptions {
  /**
   * Confere também cada contribuição contra os pontos de extensão instalados. Fica desligado por
   * padrão porque o catálogo de pontos vive no host: um pacote que contribui para um ponto de outra
   * extensão é válido, e reprová-lo aqui recusaria uma instalação legítima.
   */
  validateContributions?: boolean;
  kernelVersion?: string;
  /**
   * As OUTRAS extensões que quem pergunta enxerga — as páginas e as telas delas. É contra elas, além do
   * próprio pacote e do kernel, que um item de menu é conferido. Uma dependência declarada que não está
   * aqui não gera recusa: o item que poderia levar a ela é "não dá para conferir daqui", e quem tem um
   * relatório de avisos o diz (`navTargetChecks`).
   */
  visiblePlugins?: NavTargetOwner[];
}

const fromDiagnostic = (diagnostic: PluginDiagnostic): SdkIssue => ({
  source: 'manifest',
  message: diagnostic.message,
  messageParams: diagnostic.messageParams,
  code: diagnostic.code,
  path: diagnostic.path,
});

/**
 * A validação de um pacote — UMA porta, e é de propósito.
 *
 * As três checagens (manifest, integridade referencial, tamanho e migrações) eram montadas à mão em
 * quatro lugares: a tela de autoria, os dois caminhos de importação e a importação de traduções. Uma
 * checagem nova acrescentada num deles não chegava aos outros, e o defeito aparecia do lado que
 * ninguém tinha lembrado — que é o mesmo motivo de `packageIssues` já ser uma porta só.
 *
 * O `summary` entra aqui porque é exigência do pacote, não da tela: sem ele a extensão instala sem
 * ter o que dizer sobre si na lista.
 */
export const validatePluginPackage = (
  pkg: MarketplacePlugin,
  options: ValidatePluginPackageOptions = {},
): SdkIssue[] => [
  ...validatePluginManifest(pkg.manifest, {
    kernelVersion: options.kernelVersion ?? KERNEL_VERSION,
    validateContributions: options.validateContributions ?? false,
  }).map(fromDiagnostic),
  ...(pkg.summary?.trim()
    ? []
    : [{ source: 'package' as const, message: '@core.marketplace/issue.package.no-summary' }]),
  ...validatePackage(pkg).map((issue) => ({
    source: 'reference' as const,
    message: issue.message,
    messageParams: issue.messageParams,
    ref: issue.ref,
  })),
  ...packageIssues(pkg).map((issue) => ({
    source: 'package' as const,
    message: issue.message,
    messageParams: issue.messageParams,
  })),
  // O item de menu que não leva a lugar nenhum. Sem esta recusa ele instalava, e a aba abria em branco.
  ...navTargetIssues(pkg, options.visiblePlugins).map((issue) => ({
    source: 'package' as const,
    message: issue.message,
    messageParams: issue.messageParams,
  })),
  // O filtro com que o atalho abre a lista. Uma chave que a lista não reconhece abria a lista inteira,
  // e o selo voltava a contar um recorte que o clique não mostrava.
  ...navFilterIssues(pkg).map((issue) => ({
    source: 'package' as const,
    message: issue.message,
    messageParams: issue.messageParams,
  })),
  // A integridade do PASSO. Entra como `reference` porque é a mesma natureza: um nome que a
  // declaração usa e que não resolve. Sem ela, um `stepDefinitionId` errado passava por todas as
  // checagens e só falava no log do motor, com o fluxo já rodando.
  ...workflowStepIssues(pkg).map((issue) => ({
    source: 'reference' as const,
    message: issue.message,
    messageParams: issue.messageParams,
    ref: issue.ref,
  })),
];
