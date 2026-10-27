import type { INotificationOptOutService, NotificationOptOutState } from '../../repositories/INotificationRepositories';

export type GetNotificationOptOutUseCase = {
  execute: (tenantId: string, ticket: string) => Promise<NotificationOptOutState>;
};

export type ChangeNotificationOptOutUseCase = {
  execute: (tenantId: string, ticket: string, optedOut: boolean) => Promise<NotificationOptOutState>;
};

export const makeGetNotificationOptOutUseCase = (service: INotificationOptOutService): GetNotificationOptOutUseCase => ({
  execute: (tenantId, ticket) => service.run(tenantId, ticket, 'get'),
});

export const makeChangeNotificationOptOutUseCase = (service: INotificationOptOutService): ChangeNotificationOptOutUseCase => ({
  execute: (tenantId, ticket, optedOut) => service.run(tenantId, ticket, optedOut ? 'opt-out' : 'opt-in'),
});
