import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DIProvider } from './infrastructure/di/DIContainer';
import { KernelProvider } from './stores/KernelContext';
import { TenantKernelProvider } from './stores/TenantKernelProvider';
import { BOOT_PLUGINS } from './plugins/bootPlugins';
import { ThemeProvider } from './stores/ThemeContext';
import { LocaleProvider, PortalLocaleProvider, TenantLocaleProvider, UrlLocaleProvider } from './stores/LocaleContext';
import { TenantThemeBridge } from './stores/TenantThemeBridge';
import { PortalThemeBridge } from './stores/PortalThemeBridge';
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
import { DocumentTemplateStoreProvider } from './stores/DocumentTemplateStore';
import { RecordDialogProvider } from './stores/RecordDialogContext';
import { RecordStoreProvider } from './stores/RecordStore';
import { WorkflowStoreProvider } from './stores/WorkflowStore';
import { ScriptStoreProvider } from './stores/ScriptStore';
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
import { SecondFactorFlowHost, TenantEntryGate } from './presentation/components/layout/TenantEntryGate';
import { LoginView } from './presentation/pages/Login/Login.view';
import { LicenseView } from './presentation/pages/License/License.view';
import { WorkspaceShell } from './presentation/components/layout/WorkspaceShell';
import { ExtensionStartupHost } from './presentation/shared/extensions/ExtensionStartupHost';
import { FieldRulePresetBridge } from './presentation/shared/FieldRulePresetBridge';
import { BusinessCalendarBridge } from './presentation/shared/BusinessCalendarBridge';
import { AppErrorBoundary } from './presentation/components/layout/AppErrorBoundary';
import { OAuthConsentView } from './presentation/pages/OAuthConsent';
import { OAUTH_CONSENT_PATH } from './domain/schema/agent/agentOAuth';
import { PortalStoreProvider } from './stores/PortalStore';
import { PortalNavigationProvider } from './stores/PortalNavigationContext';
import { PortalView } from './presentation/pages/Portal';
import { PortalSignInView } from './presentation/pages/PortalSignIn';
import { PortalSignInCallbackView } from './presentation/pages/PortalSignInCallback';
import { PORTAL_PATH, PORTAL_SIGN_IN_CALLBACK_PATH, PORTAL_SIGN_IN_PATH } from './presentation/pages/Portal/portalPaths';
import { NotificationOptOutView } from './presentation/pages/NotificationOptOut';
import { NOTIFICATION_OPT_OUT_PATH } from './domain/schema/notificationContacts';

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
              {/*
                O portal é a casca de quem é de FORA do escritório, e fica fora da pilha de stores do
                espaço de trabalho de propósito: o convidado não lê telas, perfis nem extensões, e
                cada uma daquelas assinaturas seria uma leitura recusada.
              */}
              <Route path={PORTAL_SIGN_IN_PATH} element={<UrlLocaleProvider><PortalSignInView /></UrlLocaleProvider>} />
              <Route path={PORTAL_SIGN_IN_CALLBACK_PATH} element={<UrlLocaleProvider><PortalSignInCallbackView /></UrlLocaleProvider>} />
              {/*
                O descadastro de quem recebe avisos num endereço: não tem conta, e por isso a página fica
                fora de toda sessão. O idioma vem do link, que o servidor monta com o do escritório.
              */}
              <Route
                path={`${NOTIFICATION_OPT_OUT_PATH}/:tenantId/:ticket`}
                element={<UrlLocaleProvider><NotificationOptOutView /></UrlLocaleProvider>}
              />
              {/*
                Uma rota-mãe para o portal inteiro: o store fica montado entre a escolha do escritório
                e o escritório. Duas rotas irmãs remontavam o store a cada passo — e cada remontagem
                recarregava convites e contexto, com o spinner de volta.
              */}
              <Route
                path={PORTAL_PATH}
                element={
                  <ProtectedRoute loginPath={PORTAL_SIGN_IN_PATH}>
                    <PortalStoreProvider>
                      <PortalThemeBridge />
                      <PortalNavigationProvider>
                        <PortalLocaleProvider>
                          <Outlet />
                        </PortalLocaleProvider>
                      </PortalNavigationProvider>
                    </PortalStoreProvider>
                  </ProtectedRoute>
                }
              >
                <Route index element={<PortalView />} />
                <Route path=":tenantId" element={<PortalView />} />
                <Route path=":tenantId/:entryId" element={<PortalView />} />
              </Route>
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <TenantStoreProvider>
                      <TenantEntryGate>
                        <ScreenDefinitionStoreProvider>
                        <RoleStoreProvider>
                        <TagStoreProvider>
                        <LookupStoreProvider>
                                        <SettingsStoreProvider>
                                        <SavedFilterStoreProvider>
                                          <RecordStoreProvider>
                                          <WorkflowStoreProvider>
                                          <ScriptStoreProvider>
                                          <TenantExtensionStoreProvider>
                                          <InstalledExtensionStoreProvider>
                                          <PublicExtensionStoreProvider>
                                          <ActionStoreProvider>
                                          <ReportDefinitionStoreProvider>
                                          <DocumentTemplateStoreProvider>
                                          <RecordDialogProvider>
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
                                                        <BusinessCalendarBridge />
                                                        <ExtensionStartupHost />
                                                        <SecondFactorFlowHost />
                                                        <Routes>
                                                          {/*
                                                            O consentimento de OAuth é uma rota, e
                                                            ela mora AQUI DENTRO de propósito: ela
                                                            precisa do escritório corrente, do
                                                            catálogo de permissões e das extensões
                                                            instaladas — a mesma pilha que a aba de
                                                            Agentes de IA consome. Montá-la ao lado
                                                            do `/login` exigiria uma segunda pilha
                                                            de providers, que divergiria desta.
                                                          */}
                                                          <Route
                                                            path={OAUTH_CONSENT_PATH}
                                                            element={<OAuthConsentView />}
                                                          />
                                                          <Route path="*" element={<WorkspaceShell />} />
                                                        </Routes>
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
                                          </RecordDialogProvider>
                                          </DocumentTemplateStoreProvider>
                                          </ReportDefinitionStoreProvider>
                                          </ActionStoreProvider>
                                          </PublicExtensionStoreProvider>
                                          </InstalledExtensionStoreProvider>
                                          </TenantExtensionStoreProvider>
                                          </ScriptStoreProvider>
                                          </WorkflowStoreProvider>
                                          </RecordStoreProvider>
                                        </SavedFilterStoreProvider>
                                        </SettingsStoreProvider>
                        </LookupStoreProvider>
                        </TagStoreProvider>
                        </RoleStoreProvider>
                        </ScreenDefinitionStoreProvider>
                      </TenantEntryGate>
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
