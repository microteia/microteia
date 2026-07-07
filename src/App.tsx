import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DIProvider } from './infrastructure/di/DIContainer';
import { ThemeProvider } from './stores/ThemeContext';
import { AuthProvider } from './stores/AuthContext';
import { TenantStoreProvider } from './stores/TenantStore';
import { PersonStoreProvider } from './stores/PersonStore';
import { PersonTagStoreProvider } from './stores/PersonTagStore';
import { PersonLookupStoreProvider } from './stores/PersonLookupStore';
import { CaseStoreProvider } from './stores/CaseStore';
import { CaseTagStoreProvider } from './stores/CaseTagStore';
import { CaseLookupStoreProvider } from './stores/CaseLookupStore';
import { DocumentTypeLookupStoreProvider } from './stores/DocumentTypeLookupStore';
import { ContractStoreProvider } from './stores/ContractStore';
import { ContractLookupStoreProvider } from './stores/ContractLookupStore';
import { ContractTagStoreProvider } from './stores/ContractTagStore';
import { DeadlineStoreProvider } from './stores/DeadlineStore';
import { DeadlineLookupStoreProvider } from './stores/DeadlineLookupStore';
import { FinancialStoreProvider } from './stores/FinancialStore';
import { FinancialTagStoreProvider } from './stores/FinancialTagStore';
import { FinancialLookupStoreProvider } from './stores/FinancialLookupStore';
import { PushStoreProvider } from './stores/PushStore';
import { PushInteractionStoreProvider } from './stores/PushInteractionStore';
import { NewsStoreProvider } from './stores/NewsStore';
import { NewsCategoryLookupStoreProvider } from './stores/NewsCategoryLookupStore';
import { NewsTagStoreProvider } from './stores/NewsTagStore';
import { NewsInteractionStoreProvider } from './stores/NewsInteractionStore';
import { SavedFilterStoreProvider } from './stores/SavedFilterStore';
import { ScreenDefinitionStoreProvider } from './stores/ScreenDefinitionStore';
import { CustomRecordStoreProvider } from './stores/CustomRecordStore';
import { WorkflowStoreProvider } from './stores/WorkflowStore';
import { AuditLogStoreProvider } from './stores/AuditLogStore';
import { AuditLogAlertStoreProvider } from './stores/AuditLogAlertStore';
import { WorkspaceStoreProvider } from './stores/WorkspaceStore';
import { NotificationProvider } from './stores/NotificationContext';
import { CommandPaletteProvider } from './stores/CommandPaletteContext';
import { TextAnnotationStoreProvider } from './stores/TextAnnotationStore';
import { ExpressionFunctionStoreProvider } from './stores/ExpressionFunctionStore';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { HomeView } from './presentation/pages/Home/Home.view';
import { FeaturesView } from './presentation/pages/Features/Features.view';
import { PricingView } from './presentation/pages/Pricing/Pricing.view';
import { ContactView } from './presentation/pages/Contact/Contact.view';
import { LoginView } from './presentation/pages/Login/Login.view';
import { LicenseView } from './presentation/pages/License/License.view';
import { WorkspaceShell } from './presentation/components/layout/WorkspaceShell';
import { AppErrorBoundary } from './presentation/components/layout/AppErrorBoundary';

const App: React.FC = () => {
  return (
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
                      <PersonStoreProvider>
                        <PersonTagStoreProvider>
                        <PersonLookupStoreProvider>
                        <CaseStoreProvider>
                          <CaseLookupStoreProvider>
                          <DocumentTypeLookupStoreProvider>
                          <CaseTagStoreProvider>
                          <ContractStoreProvider>
                          <ContractLookupStoreProvider>
                          <ContractTagStoreProvider>
                          <DeadlineStoreProvider>
                            <DeadlineLookupStoreProvider>
                            <FinancialStoreProvider>
                            <FinancialTagStoreProvider>
                            <FinancialLookupStoreProvider>
                              <PushStoreProvider>
                                <PushInteractionStoreProvider>
                                  <NewsStoreProvider>
                                    <NewsCategoryLookupStoreProvider>
                                    <NewsTagStoreProvider>
                                      <NewsInteractionStoreProvider>
                                        <SavedFilterStoreProvider>
                                          <ScreenDefinitionStoreProvider>
                                          <CustomRecordStoreProvider>
                                          <WorkflowStoreProvider>
                                          <AuditLogStoreProvider>
                                          <AuditLogAlertStoreProvider>
                                          <WorkspaceStoreProvider>
                                            <NotificationProvider>
                                              <CommandPaletteProvider>
                                                <TextAnnotationStoreProvider>
                                                  <AppErrorBoundary>
                                                    <WorkspaceShell />
                                                  </AppErrorBoundary>
                                                </TextAnnotationStoreProvider>
                                              </CommandPaletteProvider>
                                            </NotificationProvider>
                                          </WorkspaceStoreProvider>
                                          </AuditLogAlertStoreProvider>
                                          </AuditLogStoreProvider>
                                          </WorkflowStoreProvider>
                                          </CustomRecordStoreProvider>
                                          </ScreenDefinitionStoreProvider>
                                        </SavedFilterStoreProvider>
                                      </NewsInteractionStoreProvider>
                                    </NewsTagStoreProvider>
                                    </NewsCategoryLookupStoreProvider>
                                  </NewsStoreProvider>
                                </PushInteractionStoreProvider>
                              </PushStoreProvider>
                            </FinancialLookupStoreProvider>
                            </FinancialTagStoreProvider>
                            </FinancialStoreProvider>
                            </DeadlineLookupStoreProvider>
                          </DeadlineStoreProvider>
                          </ContractTagStoreProvider>
                          </ContractLookupStoreProvider>
                          </ContractStoreProvider>
                          </CaseTagStoreProvider>
                          </DocumentTypeLookupStoreProvider>
                          </CaseLookupStoreProvider>
                        </CaseStoreProvider>
                        </PersonLookupStoreProvider>
                        </PersonTagStoreProvider>
                      </PersonStoreProvider>
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
  );
};

export default App;
