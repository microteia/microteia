import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DIProvider } from './infrastructure/di/DIContainer';
import { KernelProvider } from './stores/KernelContext';
import { TenantKernelProvider } from './stores/TenantKernelProvider';
import { CORE_PLUGINS } from './plugins';
import { ThemeProvider } from './stores/ThemeContext';
import { AuthProvider } from './stores/AuthContext';
import { TenantStoreProvider } from './stores/TenantStore';
import { TagStoreProvider } from './stores/TagStore';
import { LookupStoreProvider } from './stores/LookupStore';
import { SavedFilterStoreProvider } from './stores/SavedFilterStore';
import { ScreenDefinitionStoreProvider } from './stores/ScreenDefinitionStore';
import { ActionStoreProvider } from './stores/ActionStore';
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
import { HomeView } from './presentation/pages/Home/Home.view';
import { FeaturesView } from './presentation/pages/Features/Features.view';
import { PricingView } from './presentation/pages/Pricing/Pricing.view';
import { ContactView } from './presentation/pages/Contact/Contact.view';
import { LoginView } from './presentation/pages/Login/Login.view';
import { LicenseView } from './presentation/pages/License/License.view';
import { WorkspaceShell } from './presentation/components/layout/WorkspaceShell';
import { ExtensionStartupHost } from './presentation/shared/extensions/ExtensionStartupHost';
import { FieldRulePresetBridge } from './presentation/shared/FieldRulePresetBridge';
import { AppErrorBoundary } from './presentation/components/layout/AppErrorBoundary';

const App: React.FC = () => {
  return (
    <KernelProvider records={CORE_PLUGINS}>
    <DIProvider>
      <ThemeProvider>
        <AuthProvider>
          <ExpressionFunctionStoreProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<HomeView />} />
              <Route path="/funcionalidades" element={<FeaturesView />} />
              <Route path="/precos" element={<PricingView />} />
              <Route path="/contato" element={<ContactView />} />
              <Route path="/login" element={<LoginView />} />
              <Route path="/license" element={<LicenseView />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <TenantStoreProvider>
                        <ScreenDefinitionStoreProvider>
                        <TagStoreProvider>
                        <LookupStoreProvider>
                                        <SavedFilterStoreProvider>
                                          <RecordStoreProvider>
                                          <WorkflowStoreProvider>
                                          <ScriptStoreProvider>
                                          <PluginStoreProvider>
                                          <TenantExtensionStoreProvider>
                                          <InstalledExtensionStoreProvider>
                                          <PublicExtensionStoreProvider>
                                          <ActionStoreProvider>
                                          <AuditLogStoreProvider>
                                          <AuditLogAlertStoreProvider>
                                          <WorkspaceStoreProvider>
                                            <NotificationProvider>
                                              <StepCatalogProvider>
                                              <CommandPaletteProvider>
                                                <TextAnnotationStoreProvider>
                                                  <AppErrorBoundary>
                                                    <TenantKernelProvider>
                                                      <FieldRulePresetBridge />
                                                      <ExtensionStartupHost />
                                                      <WorkspaceShell />
                                                    </TenantKernelProvider>
                                                  </AppErrorBoundary>
                                                </TextAnnotationStoreProvider>
                                              </CommandPaletteProvider>
                                              </StepCatalogProvider>
                                            </NotificationProvider>
                                          </WorkspaceStoreProvider>
                                          </AuditLogAlertStoreProvider>
                                          </AuditLogStoreProvider>
                                          </ActionStoreProvider>
                                          </PublicExtensionStoreProvider>
                                          </InstalledExtensionStoreProvider>
                                          </TenantExtensionStoreProvider>
                                          </PluginStoreProvider>
                                          </ScriptStoreProvider>
                                          </WorkflowStoreProvider>
                                          </RecordStoreProvider>
                                        </SavedFilterStoreProvider>
                        </LookupStoreProvider>
                        </TagStoreProvider>
                        </ScreenDefinitionStoreProvider>
                    </TenantStoreProvider>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
          </ExpressionFunctionStoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </DIProvider>
    </KernelProvider>
  );
};

export default App;
