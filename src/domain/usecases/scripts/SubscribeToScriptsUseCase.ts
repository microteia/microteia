import type { Script } from '../../entities/Script';
import type { IScriptRepository } from '../../repositories/IScriptRepository';

export type SubscribeToScriptsUseCase = {
  execute: (tenantId: string, onUpdate: (scripts: Script[]) => void) => () => void;
};

export const makeSubscribeToScriptsUseCase = (repo: IScriptRepository): SubscribeToScriptsUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribeToScripts(tenantId, onUpdate),
});
