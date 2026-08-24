import { describe, expect, it } from 'vitest';
import * as sdk from './index';
import { KERNEL_VERSION } from '../domain/schema/plugin/kernelVersion';

/**
 * A superfície do SDK é CONTRATO: a partir do momento em que ela sai daqui, alguém de fora escreve
 * contra ela, e removê-la ou renomeá-la quebra código que não está neste repositório.
 *
 * Este teste não impede a mudança — impede a mudança DISTRAÍDA. Acrescentar um símbolo é aditivo e só
 * pede o minor do `KERNEL_VERSION`; remover ou renomear é quebra e pede o major. As duas coisas
 * passam por atualizar a lista abaixo, que é onde a decisão fica registrada.
 *
 * É a mesma mecânica de `PT_BR_MESSAGES_FINGERPRINT` e de `backendFingerprint`, pelo mesmo motivo: o
 * defeito que ela pega não tem sintoma local nenhum.
 */
const PUBLISHED = [
  'ACCESS_API_VERSION', 'ACCESS_EXTENSION_POINTS', 'ACCESS_PERMISSION_POINT', 'ACCESS_REQUIREMENT_POINT', 'ACCESS_RESOURCE_POINT', 'CRUD_ACTIONS', 'accessPermissionContribution', 'accessRequirementContribution', 'accessPermissionOf', 'accessResourceContribution', 'buildPermissionCatalog', 'collectionPermissionId', 'declaredPermissionsOf', 'declaredRequirementsOf', 'declaredResourcesOf', 'dependenciesOf', 'isValidAccessPermissionId', 'parseAccessPermission', 'resolveEffective', 'validateAccessPermission', 'validateAccessRequirement',
  'DATA_API_VERSION', 'DATA_ENTITY_POINT', 'DATA_EXTENSION_POINTS', 'DATA_EXTERNAL_LOOKUP_POINT',
  'DATA_FIELD_RULE_PRESET_POINT', 'DATA_LOOKUP_POINT', 'DATA_SERVICE_POINT',
  'DEFAULT_CONTRIBUTION_PRIORITY', 'DEFAULT_LOCALE', 'I18N_API_VERSION', 'I18N_EXTENSION_POINTS',
  'I18N_MESSAGES_POINT', 'IMPL_KINDS', 'KERNEL_PLUGIN_ID', 'KERNEL_VERSION', 'MESSAGE_REF_SIGIL',
  'MIGRATION_ID_MAX_LENGTH', 'MIGRATION_ID_PATTERN', 'MIGRATION_PHASES', 'PERMISSION_DOMAINS',
  'SETTINGS_SCOPES', 'THEME_API_VERSION', 'THEME_DEFINITION_POINT', 'THEME_EXTENSION_POINTS',
  'THEME_TOKENS_POINT', 'THIRD_PARTY_IMPL_KINDS', 'UI_API_VERSION', 'UI_COMMAND_POINT',
  'UI_EXTENSION_POINTS', 'UI_NAV_POINT', 'UI_PAGE_POINT', 'UI_RECORD_ACTION_POINT',
  'UI_SETTINGS_POINT', 'UI_TAB_POINT', 'UI_WIDGET_POINT', 'WIDGET_NODE_TYPES',
  'CUSTOM_FIELD_TYPES', 'FIELD_EXPRESSION_FUNCTION_NAMES', 'STEP_TYPES',
  'backendFingerprint', 'command', 'compareSemVer', 'contributionKey', 'fieldRulePresetContribution',
  'isApiVersionCompatible', 'isKernelCompatible', 'isMessageRef', 'isTrustedOnlyImplKind',
  'isValidContributionId', 'isValidExtensionPointId', 'isValidMessageKey', 'isValidPermission',
  'isValidPluginId', 'isValidRange', 'isValidSemVer', 'isWidgetSpec', 'lookupProviderContribution',
  'messageBundleContribution', 'nav', 'packageFingerprint', 'packageIssues', 'packageOutRefs',
  'packageSizeAdvisory', 'page', 'parsePackage', 'parseSemVer', 'pointContribution', 'qualifyKey',
  'recordAction', 'satisfiesRange', 'serializePackage', 'settingsSection', 'sortContributions',
  'surfaceTab', 'surfaceTabSpec', 'surfaceWidget', 'surfaceWidgetSpec', 'themeTokensContribution',
  'validateBackendRequirement', 'validateContribution', 'validateExtensionPoint',
  'validateMigrations', 'validatePackage', 'validatePermissions', 'validatePluginManifest',
  'validatePluginPackage', 'widgetChildren', 'widgetPage',
].sort();

/**
 * Os TIPOS são a maior parte do que sai daqui, e `Object.keys` não os vê — eles não existem em tempo de
 * execução. Sem esta lista, remover um tipo do barril não quebraria teste nenhum e quebraria o
 * `plugin.ts` de quem já escreveu contra ele.
 */
const PUBLISHED_TYPES = [
  'AccessPermission', 'AccessRequirement', 'CatalogPermission', 'CrudAction', 'DeclaredPermission', 'DeclaredRequirement', 'ParsedAccessPermission', 'PermissionCatalog', 'PermissionResource', 'ResolvedPermissions',
  'ActionDefinition', 'ActionLocalCommand', 'ActionModuleTemplate', 'ActionOutcome', 'AggregationOp',
  'AuthoredPlugin',
  'AuthoredView', 'BackendPrerequisite', 'CapabilityProvision', 'CapabilityRequirement', 'Condition',
  'Contribution', 'CustomFieldMask', 'CustomFieldOption', 'CustomFieldType', 'CustomFieldValue',
  'DiagnosticCode',
  'DiagnosticSeverity', 'EventInputMapping', 'ExpressionInputMapping', 'ExtensionPointDefinition',
  'FieldAggregation', 'FieldDefinition', 'FieldFileConfig', 'FieldLogic', 'FieldLookupBinding',
  'FieldOrigin', 'FieldRulePreset', 'FieldRulePresetMask', 'FieldRulePresetValidate', 'FieldRules',
  'FirestoreIndexField', 'FirestoreIndexSpec', 'FormatOp', 'FormatRule', 'ImplKind', 'ImplRef',
  'InputMapping',
  'LiteralInputMapping', 'LocaleCode', 'LookupModuleTemplate', 'LookupProviderFailure',
  'LookupProviderRequest', 'LookupProviderSpec', 'MarketplacePlugin', 'MessageBundle', 'MessageParams',
  'MigrationPhase', 'OutputInputMapping', 'PackageRef', 'PackageValidationIssue', 'ParsePackageResult',
  'ParsedPermission', 'PermissionDomain', 'PluginBackendRequirement', 'PluginDiagnostic',
  'PluginLifecycle', 'PluginLifecycleHook', 'PluginManifest', 'PluginMigration', 'PluginPublisher',
  'QueryOperator', 'QueryOrderBy', 'QueryPredicate', 'QuerySpec', 'RefKind', 'ScreenListAction',
  'ScreenModuleTemplate', 'ScreenPatchTemplate', 'Script', 'ScriptModuleTemplate', 'ScriptOutputParam',
  'SdkIssue', 'SemVer', 'SettingsProperty', 'SettingsPropertyOption', 'SettingsPropertyType',
  'SettingsScope', 'SettingsSection', 'StepType', 'TemplateField', 'ThemeBase', 'ThemeSpec',
  'ThemeTagColor', 'ThemeTokenBundle', 'TranslateFn', 'UiCommandMetadata', 'UiNavBadge',
  'UiNavMetadata', 'UiPageMetadata', 'UiRecordActionMetadata', 'UiTabMetadata', 'UiWidgetMetadata',
  'ValidateManifestOptions', 'ValidateRule', 'VariableInputMapping', 'ViewModuleTemplate',
  'WidgetNodeType',
  'WidgetSpec', 'WorkflowDefinition', 'WorkflowLoopConfig', 'WorkflowModuleTemplate',
  'WorkflowParameter', 'WorkflowParameterType', 'WorkflowStep', 'WorkflowStepBranches',
].sort();

const BARREL = import.meta.glob('/src/sdk/index.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})['/src/sdk/index.ts'] as string;

describe('a superfície publicada do SDK', () => {
  it('é exatamente a lista declarada — nem um símbolo a mais, nem a menos', () => {
    expect(Object.keys(sdk).sort()).toEqual(PUBLISHED);
  });

  /**
   * O SDK viaja junto com o pacote do kernel, e é o `KERNEL_VERSION` que amarra os dois: um autor que
   * escreveu contra `^1.4.0` precisa saber se o que ele usa continua valendo.
   */
  it('publica a versão do contrato Kernel↔plugins', () => {
    expect(sdk.KERNEL_VERSION).toBe(KERNEL_VERSION);
    expect(sdk.KERNEL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exporta exatamente os tipos declarados', () => {
    const exported = [...BARREL.matchAll(/export type \{([^}]*)\}/gs)]
      .flatMap((match) => match[1].split(','))
      .map((name) => name.trim())
      .filter((name) => name !== '')
      .sort();
    expect([...new Set(exported)]).toEqual(PUBLISHED_TYPES);
  });

  it('o barril é uma LISTA, nunca um `export *` — é ele que decide o que sai daqui', () => {
    const statements = BARREL.split('\n').filter((line) => line.startsWith('export'));
    expect(statements.filter((line) => /^export\s+\*/.test(line))).toEqual([]);
    expect(statements.length).toBeGreaterThan(10);
  });

  /** Um construtor de contribuição que não existisse tornaria o barril uma promessa vazia. */
  it('todo construtor de contribuição é chamável', () => {
    for (const name of ['page', 'nav', 'command', 'recordAction', 'settingsSection', 'widgetPage',
      'surfaceTab', 'surfaceTabSpec', 'surfaceWidget', 'surfaceWidgetSpec', 'pointContribution']) {
      expect(typeof (sdk as unknown as Record<string, unknown>)[name], name).toBe('function');
    }
  });
});
