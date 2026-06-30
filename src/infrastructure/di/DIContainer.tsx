import React, { useMemo } from 'react';
import { FirebaseAuthRepository } from '../../data/repositories/FirebaseAuthRepository';
import { FirebaseUserRepository } from '../../data/repositories/FirebaseUserRepository';
import { FirebaseUserProfileRepository } from '../../data/repositories/FirebaseUserProfileRepository';
import { FirebaseAIConnectionRepository } from '../../data/repositories/FirebaseAIConnectionRepository';
import { FirebaseGmailConnectionRepository } from '../../data/repositories/FirebaseGmailConnectionRepository';
import { FirebaseNewsRepository } from '../../data/repositories/FirebaseNewsRepository';
import { FirebaseNewsInteractionRepository } from '../../data/repositories/FirebaseNewsInteractionRepository';
import { FirebaseNewsTagRepository } from '../../data/repositories/FirebaseNewsTagRepository';
import { FirebaseNewsTagLinkRepository } from '../../data/repositories/FirebaseNewsTagLinkRepository';
import { FirebaseNewsCommentRepository } from '../../data/repositories/FirebaseNewsCommentRepository';
import { FirebaseNewsCategoryRepository } from '../../data/repositories/FirebaseNewsCategoryRepository';
import { FirebaseSavedFilterRepository } from '../../data/repositories/FirebaseSavedFilterRepository';
import { FirebaseTenantRepository } from '../../data/repositories/FirebaseTenantRepository';
import { FirebasePersonRepository } from '../../data/repositories/FirebasePersonRepository';
import { FirebaseCaseRepository } from '../../data/repositories/FirebaseCaseRepository';
import { FirebaseDeadlineRepository } from '../../data/repositories/FirebaseDeadlineRepository';
import { FirebaseFinancialRepository } from '../../data/repositories/FirebaseFinancialRepository';
import { FirebaseTextAnnotationRepository } from '../../data/repositories/FirebaseTextAnnotationRepository';
import { FirebasePersonTagRepository } from '../../data/repositories/FirebasePersonTagRepository';
import { FirebasePersonNoteRepository } from '../../data/repositories/FirebasePersonNoteRepository';
import { FirebasePersonDocumentRepository } from '../../data/repositories/FirebasePersonDocumentRepository';
import { FirebaseCaseTagRepository } from '../../data/repositories/FirebaseCaseTagRepository';
import { FirebaseCaseNoteRepository } from '../../data/repositories/FirebaseCaseNoteRepository';
import { FirebaseCaseDocumentRepository } from '../../data/repositories/FirebaseCaseDocumentRepository';
import { FirebaseCaseLookupRepository } from '../../data/repositories/FirebaseCaseLookupRepository';
import { FirebaseCaseAreaRepository } from '../../data/repositories/FirebaseCaseAreaRepository';
import { FirebaseCasePhaseRepository } from '../../data/repositories/FirebaseCasePhaseRepository';
import { FirebaseCaseStatusRepository } from '../../data/repositories/FirebaseCaseStatusRepository';
import { FirebaseCaseInstanceRepository } from '../../data/repositories/FirebaseCaseInstanceRepository';
import { FirebaseCaseActionTypeRepository } from '../../data/repositories/FirebaseCaseActionTypeRepository';
import { FirebaseCaseCourtRepository } from '../../data/repositories/FirebaseCaseCourtRepository';
import { FirebaseCaseDistrictRepository } from '../../data/repositories/FirebaseCaseDistrictRepository';
import { FirebaseCaseJudgeRepository } from '../../data/repositories/FirebaseCaseJudgeRepository';
import { FirebasePersonLookupRepository } from '../../data/repositories/FirebasePersonLookupRepository';
import { FirebaseDeadlineTypeRepository } from '../../data/repositories/FirebaseDeadlineTypeRepository';
import { DIContext } from './useDI';
import type { DIContainer } from './useDI';

export const DIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const container = useMemo<DIContainer>(() => ({
    authRepository:           new FirebaseAuthRepository(),
    userRepository:           new FirebaseUserRepository(),
    userProfileRepository:    new FirebaseUserProfileRepository(),
    aiConnectionRepository:   new FirebaseAIConnectionRepository(),
    gmailConnectionRepository: new FirebaseGmailConnectionRepository(),
    newsRepository:           new FirebaseNewsRepository(),
    newsInteractionRepository: new FirebaseNewsInteractionRepository(),
    newsTagRepository:        new FirebaseNewsTagRepository(),
    newsTagLinkRepository:    new FirebaseNewsTagLinkRepository(),
    newsCommentRepository:    new FirebaseNewsCommentRepository(),
    newsCategoryRepository:   new FirebaseNewsCategoryRepository(),
    savedFilterRepository:    new FirebaseSavedFilterRepository(),
    tenantRepository:         new FirebaseTenantRepository(),
    personRepository:         new FirebasePersonRepository(),
    personTagRepository:      new FirebasePersonTagRepository(),
    personNoteRepository:     new FirebasePersonNoteRepository(),
    personDocumentRepository: new FirebasePersonDocumentRepository(),
    personLookupRepository:   new FirebasePersonLookupRepository(),
    caseRepository:           new FirebaseCaseRepository(),
    caseTagRepository:        new FirebaseCaseTagRepository(),
    caseNoteRepository:       new FirebaseCaseNoteRepository(),
    caseDocumentRepository:   new FirebaseCaseDocumentRepository(),
    caseLookupRepository:     new FirebaseCaseLookupRepository(),
    caseAreaRepository:       new FirebaseCaseAreaRepository(),
    casePhaseRepository:      new FirebaseCasePhaseRepository(),
    caseStatusRepository:     new FirebaseCaseStatusRepository(),
    caseInstanceRepository:   new FirebaseCaseInstanceRepository(),
    caseActionTypeRepository: new FirebaseCaseActionTypeRepository(),
    caseCourtRepository:      new FirebaseCaseCourtRepository(),
    caseDistrictRepository:   new FirebaseCaseDistrictRepository(),
    caseJudgeRepository:      new FirebaseCaseJudgeRepository(),
    deadlineRepository:       new FirebaseDeadlineRepository(),
    deadlineTypeRepository:   new FirebaseDeadlineTypeRepository(),
    financialRepository:      new FirebaseFinancialRepository(),
    textAnnotationRepository: new FirebaseTextAnnotationRepository(),
    pushRepository:           new FirebasePushRepository(),
    pushInteractionRepository: new FirebasePushInteractionRepository(),
  }), []);

  return <DIContext.Provider value={container}>{children}</DIContext.Provider>;
};
