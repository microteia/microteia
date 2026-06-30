import { getDb } from '../firebase/initFirebase';
import { FirebaseAIConnectionRepository } from '../../data/repositories/FirebaseAIConnectionRepository';
import { FirebaseTenantMemberRepository } from '../../data/repositories/FirebaseTenantMemberRepository';
import { FirebaseUserRepository } from '../../data/repositories/FirebaseUserRepository';
import { FirebaseNicknameRepository } from '../../data/repositories/FirebaseNicknameRepository';
import { FirebaseGmailConnectionRepository } from '../../data/repositories/FirebaseGmailConnectionRepository';
import { FirebasePushRepository } from '../../data/repositories/FirebasePushRepository';
import { OpenAIService } from '../../data/services/OpenAIService';
import { AnthropicService } from '../../data/services/AnthropicService';
import { GoogleAIService } from '../../data/services/GoogleAIService';
import { MistralService } from '../../data/services/MistralService';
import { CohereService } from '../../data/services/CohereService';
import { GoogleAuthService } from '../../data/services/GoogleAuthService';
import { GmailWatchService } from '../../data/services/GmailWatchService';
import { GmailService } from '../../data/services/GmailService';
import { EmailParserService } from '../../data/services/EmailParserService';
import { makeGetDefaultAICredentialsUseCase } from '../../domain/usecases/GetDefaultAICredentialsUseCase';
import { makeCallAIAnalysisUseCase } from '../../domain/usecases/CallAIAnalysisUseCase';
import { makeGetUserInfoUseCase } from '../../domain/usecases/GetUserInfoUseCase';
import { makeCheckNicknameAvailabilityUseCase } from '../../domain/usecases/CheckNicknameAvailabilityUseCase';
import { makeClaimNicknameUseCase } from '../../domain/usecases/ClaimNicknameUseCase';
import { makeExchangeGmailCodeUseCase } from '../../domain/usecases/ExchangeGmailCodeUseCase';
import { makeCreatePushUseCase } from '../../domain/usecases/CreatePushUseCase';
import type { GetDefaultAICredentialsUseCase } from '../../domain/usecases/GetDefaultAICredentialsUseCase';
import type { CallAIAnalysisUseCase } from '../../domain/usecases/CallAIAnalysisUseCase';
import type { GetUserInfoUseCase } from '../../domain/usecases/GetUserInfoUseCase';
import type { CheckNicknameAvailabilityUseCase } from '../../domain/usecases/CheckNicknameAvailabilityUseCase';
import type { ClaimNicknameUseCase } from '../../domain/usecases/ClaimNicknameUseCase';
import type { ExchangeGmailCodeUseCase } from '../../domain/usecases/ExchangeGmailCodeUseCase';
import type { CreatePushUseCase } from '../../domain/usecases/CreatePushUseCase';
import type { IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { IGmailConnectionRepository } from '../../domain/repositories/IGmailConnectionRepository';
import type { IPushRepository } from '../../domain/repositories/IPushRepository';
import type { IGmailService } from '../../data/services/GmailService';
import type { IEmailParserService } from '../../data/services/EmailParserService';

class DIContainer {
  private static instance: DIContainer;

  private aiProviders: IAIProviderService[];
  private gmailConnectionRepo?: IGmailConnectionRepository;
  private pushRepo?: IPushRepository;
  private gmailService?: IGmailService;
  private emailParserService?: IEmailParserService;
  private getDefaultAICredentialsUC?: GetDefaultAICredentialsUseCase;
  private callAIAnalysisUC?: CallAIAnalysisUseCase;
  private getUserInfoUC?: GetUserInfoUseCase;
  private checkNicknameAvailabilityUC?: CheckNicknameAvailabilityUseCase;
  private claimNicknameUC?: ClaimNicknameUseCase;
  private exchangeGmailCodeUC?: ExchangeGmailCodeUseCase;
  private createPushUC?: CreatePushUseCase;

  private constructor() {
    this.aiProviders = [
      new OpenAIService(),
      new AnthropicService(),
      new GoogleAIService(),
      new MistralService(),
      new CohereService(),
    ];
  }

  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  getDefaultAICredentialsUseCase(): GetDefaultAICredentialsUseCase {
    if (!this.getDefaultAICredentialsUC) {
      const db = getDb();
      const aiConnectionRepo = new FirebaseAIConnectionRepository(db);
      const tenantMemberRepo = new FirebaseTenantMemberRepository(db);
      this.getDefaultAICredentialsUC = makeGetDefaultAICredentialsUseCase(aiConnectionRepo, tenantMemberRepo);
    }
    return this.getDefaultAICredentialsUC;
  }

  getCallAIAnalysisUseCase(): CallAIAnalysisUseCase {
    if (!this.callAIAnalysisUC) {
      this.callAIAnalysisUC = makeCallAIAnalysisUseCase(this.aiProviders);
    }
    return this.callAIAnalysisUC;
  }

  getUserInfoUseCase(): GetUserInfoUseCase {
    if (!this.getUserInfoUC) {
      const db = getDb();
      const userRepo = new FirebaseUserRepository(db);
      this.getUserInfoUC = makeGetUserInfoUseCase(userRepo);
    }
    return this.getUserInfoUC;
  }

  getCheckNicknameAvailabilityUseCase(): CheckNicknameAvailabilityUseCase {
    if (!this.checkNicknameAvailabilityUC) {
      const db = getDb();
      const nicknameRepo = new FirebaseNicknameRepository(db);
      this.checkNicknameAvailabilityUC = makeCheckNicknameAvailabilityUseCase(nicknameRepo);
    }
    return this.checkNicknameAvailabilityUC;
  }

  getClaimNicknameUseCase(): ClaimNicknameUseCase {
    if (!this.claimNicknameUC) {
      const db = getDb();
      const nicknameRepo = new FirebaseNicknameRepository(db);
      this.claimNicknameUC = makeClaimNicknameUseCase(nicknameRepo);
    }
    return this.claimNicknameUC;
  }

  getExchangeGmailCodeUseCase(): ExchangeGmailCodeUseCase {
    if (!this.exchangeGmailCodeUC) {
      const db = getDb();
      const gmailAuthService = new GoogleAuthService();
      const gmailWatchService = new GmailWatchService();
      const tenantMemberRepo = new FirebaseTenantMemberRepository(db);
      this.exchangeGmailCodeUC = makeExchangeGmailCodeUseCase(gmailAuthService, gmailWatchService, tenantMemberRepo);
    }
    return this.exchangeGmailCodeUC;
  }

  getGmailConnectionRepository(): IGmailConnectionRepository {
    if (!this.gmailConnectionRepo) {
      this.gmailConnectionRepo = new FirebaseGmailConnectionRepository();
    }
    return this.gmailConnectionRepo;
  }

  getPushRepository(): IPushRepository {
    if (!this.pushRepo) {
      this.pushRepo = new FirebasePushRepository();
    }
    return this.pushRepo;
  }

  getGmailService(): IGmailService {
    if (!this.gmailService) {
      this.gmailService = new GmailService();
    }
    return this.gmailService;
  }

  getEmailParserService(): IEmailParserService {
    if (!this.emailParserService) {
      this.emailParserService = new EmailParserService(this.aiProviders);
    }
    return this.emailParserService;
  }

  getCreatePushUseCase(): CreatePushUseCase {
    if (!this.createPushUC) {
      const pushRepo = this.getPushRepository();
      this.createPushUC = makeCreatePushUseCase(pushRepo);
    }
    return this.createPushUC;
  }
}

export const getDI = (): DIContainer => DIContainer.getInstance();
