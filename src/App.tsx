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
import { AuditLogStoreProvider } from './stores/AuditLogStore';
import { AuditLogAlertStoreProvider } from './stores/AuditLogAlertStore';
import { WorkspaceStoreProvider } from './stores/WorkspaceStore';
import { NotificationProvider } from './stores/NotificationContext';
import { CommandPaletteProvider } from './stores/CommandPaletteContext';
import { TextAnnotationStoreProvider } from './stores/TextAnnotationStore';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginView } from './presentation/pages/Login/Login.view';
import { WorkspaceShell } from './presentation/components/layout/WorkspaceShell';
import { AppErrorBoundary } from './presentation/components/layout/AppErrorBoundary';

const App: React.FC = () => {
  return (
    <DIProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginView />} />
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
        </AuthProvider>
      </ThemeProvider>
    </DIProvider>
  );
};

export default App;
