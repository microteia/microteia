import type { DevicePushStatus } from '../../entities/InboxNotification';
import type { IDevicePushService } from '../../repositories/INotificationRepositories';

export type ManageDevicePushUseCase = {
  status: (userId: string) => Promise<DevicePushStatus>;
  enable: (userId: string) => Promise<DevicePushStatus>;
  disable: (userId: string) => Promise<DevicePushStatus>;
};

export const makeManageDevicePushUseCase = (service: IDevicePushService): ManageDevicePushUseCase => ({
  status: (userId) => service.status(userId),
  enable: (userId) => service.enable(userId),
  disable: (userId) => service.disable(userId),
});
