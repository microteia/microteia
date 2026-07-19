import type { IActionRepository, RunActionInput, RunActionResult } from '../../repositories/IActionRepository';

export type RunActionUseCase = {
  execute: (input: RunActionInput) => Promise<RunActionResult>;
};

export const makeRunActionUseCase = (repo: IActionRepository): RunActionUseCase => ({
  execute: (input) => repo.runAction(input),
});
