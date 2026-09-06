import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DIProvider } from './infrastructure/di/DIContainer';
import { KernelProvider } from './stores/KernelContext';
import { TenantKernelProvider } from './stores/TenantKernelProvider';
import { BOOT_PLUGINS } from './plugins/bootPlugins';
import { ThemeProvider } from './stores/ThemeContext';
import { LocaleProvider, TenantLocaleProvider } from './stores/LocaleContext';
import { TenantThemeBridge } from './stores/TenantThemeBridge';
import { AuthProvider } from './stores/AuthContext';
import { TenantStoreProvider } from './stores/TenantStore';
import { TagStoreProvider } from './stores/TagStore';
import { RoleStoreProvider } from './stores/RoleStore';
import { AuthorizationStoreProvider } from './stores/AuthorizationStore';
import { LookupStoreProvider } from './stores/LookupStore';
import { SavedFilterStoreProvider } from './stores/SavedFilterStore';
import { SettingsStoreProvider } from './stores/SettingsStore';
import { ScreenDefinitionStoreProvider } from './stores/ScreenDefinitionStore';
import { ActionStoreProvider } from './stores/ActionStore';
import { ReportDefinitionStoreProvider } from './stores/ReportDefinitionStore';
import { RecordStoreProvider } from './stores/RecordStore';
import { WorkflowStoreProvider } from './stores/WorkflowStore';
import { ScriptStoreProvider } from './stores/ScriptStore';
import { PluginStoreProvider } from './stores/PluginStore';
import { TenantExtensionStoreProvider } from './stores/TenantExtensionStore';
import { InstalledExtensionStoreProvider } from './stores/InstalledExtensionStore';
import { PublicExtensionStoreProvider } from './stores/PublicExtensionStore';
import { AuditLogStoreProvider } from './stores/AuditLogStore';
import { AuditLogAlertStoreProvider } from './stores/AuditLogAlertStore';
import { WorkspaceStoreProvider } from './stores/WorkspaceStore';
import { NotificationProvider } from './stores/NotificationContext';
import { CommandPaletteProvider } from './stores/CommandPaletteContext';
import { TextAnnotationStoreProvider } from './stores/TextAnnotationStore';
import { ExpressionFunctionStoreProvider } from './stores/ExpressionFunctionStore';
import { StepCatalogProvider } from './stores/StepCatalogStore';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginView } from './presentation/pages/Login/Login.view';
import { LicenseView } from './presentation/pages/License/License.view';
import { WorkspaceShell } from './presentation/components/layout/WorkspaceShell';
import { ExtensionStartupHost } from './presentation/shared/extensions/ExtensionStartupHost';
import { FieldRulePresetBridge } from './presentation/shared/FieldRulePresetBridge';
import { AppErrorBoundary } from './presentation/components/layout/AppErrorBoundary';

const App: React.FC = () => {
  return (
    <KernelProvider records={BOOT_PLUGINS}>
    <DIProvider>
      <ThemeProvider>
        <LocaleProvider>
        <AuthProvider>
          <ExpressionFunctionStoreProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginView />} />
              <Route path="/license" element={<LicenseView />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <TenantStoreProvider>
                        <ScreenDefinitionStoreProvider>
                        <RoleStoreProvider>
                        <TagStoreProvider>
                        <LookupStoreProvider>
                                        <SettingsStoreProvider>
                                        <SavedFilterStoreProvider>
                                          <RecordStoreProvider>
                                          <WorkflowStoreProvider>
                                          <ScriptStoreProvider>
                                          <PluginStoreProvider>
                                          <TenantExtensionStoreProvider>
                                          <InstalledExtensionStoreProvider>
                                          <PublicExtensionStoreProvider>
                                          <ActionStoreProvider>
                                          <ReportDefinitionStoreProvider>
                                          <AuditLogStoreProvider>
                                          <WorkspaceStoreProvider>
                                            <NotificationProvider>
                                              <StepCatalogProvider>
                                              <CommandPaletteProvider>
                                                <TextAnnotationStoreProvider>
                                                  <AppErrorBoundary>
                                                    <TenantKernelProvider>
                                                      <AuthorizationStoreProvider>
                                                      <AuditLogAlertStoreProvider>
                                                      <TenantLocaleProvider>
                                                        <TenantThemeBridge />
                                                        <FieldRulePresetBridge />
                                                        <ExtensionStartupHost />
                                                        <WorkspaceShell />
                                                      </TenantLocaleProvider>
                                                      </AuditLogAlertStoreProvider>
                                                      </AuthorizationStoreProvider>
                                                    </TenantKernelProvider>
                                                  </AppErrorBoundary>
                                                </TextAnnotationStoreProvider>
                                              </CommandPaletteProvider>
                                              </StepCatalogProvider>
                                            </NotificationProvider>
                                          </WorkspaceStoreProvider>
                                          </AuditLogStoreProvider>
                                          </ReportDefinitionStoreProvider>
                                          </ActionStoreProvider>
                                          </PublicExtensionStoreProvider>
                                          </InstalledExtensionStoreProvider>
                                          </TenantExtensionStoreProvider>
                                          </PluginStoreProvider>
                                          </ScriptStoreProvider>
                                          </WorkflowStoreProvider>
                                          </RecordStoreProvider>
                                        </SavedFilterStoreProvider>
                                        </SettingsStoreProvider>
                        </LookupStoreProvider>
                        </TagStoreProvider>
                        </RoleStoreProvider>
                        </ScreenDefinitionStoreProvider>
                    </TenantStoreProvider>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
          </ExpressionFunctionStoreProvider>
        </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </DIProvider>
    </KernelProvider>
  );
};

export default App;
