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
import { DeadlineStoreProvider } from './stores/DeadlineStore';
import { DeadlineLookupStoreProvider } from './stores/DeadlineLookupStore';
import { FinancialStoreProvider } from './stores/FinancialStore';
import { PushStoreProvider } from './stores/PushStore';
import { PushInteractionStoreProvider } from './stores/PushInteractionStore';
import { NewsStoreProvider } from './stores/NewsStore';
import { NewsTagStoreProvider } from './stores/NewsTagStore';
import { NewsInteractionStoreProvider } from './stores/NewsInteractionStore';
import { SavedFilterStoreProvider } from './stores/SavedFilterStore';
import { WorkspaceStoreProvider } from './stores/WorkspaceStore';
import { NotificationProvider } from './stores/NotificationContext';
import { CommandPaletteProvider } from './stores/CommandPaletteContext';
import { TextAnnotationStoreProvider } from './stores/TextAnnotationStore';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { LoginView } from './presentation/pages/Login/Login.view';
import { WorkspaceShell } from './presentation/components/layout/WorkspaceShell';

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
                          <DeadlineStoreProvider>
                            <DeadlineLookupStoreProvider>
                            <FinancialStoreProvider>
                              <PushStoreProvider>
                                <PushInteractionStoreProvider>
                                  <NewsStoreProvider>
                                    <NewsTagStoreProvider>
                                      <NewsInteractionStoreProvider>
                                        <SavedFilterStoreProvider>
                                          <WorkspaceStoreProvider>
                                            <NotificationProvider>
                                              <CommandPaletteProvider>
                                                <TextAnnotationStoreProvider>
                                                  <WorkspaceShell />
                                                </TextAnnotationStoreProvider>
                                              </CommandPaletteProvider>
                                            </NotificationProvider>
                                          </WorkspaceStoreProvider>
                                        </SavedFilterStoreProvider>
                                      </NewsInteractionStoreProvider>
                                    </NewsTagStoreProvider>
                                  </NewsStoreProvider>
                                </PushInteractionStoreProvider>
                              </PushStoreProvider>
                            </FinancialStoreProvider>
                            </DeadlineLookupStoreProvider>
                          </DeadlineStoreProvider>
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
