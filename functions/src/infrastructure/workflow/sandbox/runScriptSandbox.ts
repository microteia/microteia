import { getQuickJS, shouldInterruptAfterDeadline } from 'quickjs-emscripten';
import type { QuickJSWASMModule, QuickJSContext, QuickJSHandle, QuickJSDeferredPromise } from 'quickjs-emscripten';
import { expressionFunctions } from '../../../domain/engine/expression/ExpressionEngine';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { QueryOperator, QueryOrderBy, QueryPredicate, QuerySpec } from '../../../domain/schema/querySpec';
import { runWorkflowQuery } from '../query/runWorkflowQuery';
import type { WorkflowQueryDeps } from '../query/runWorkflowQuery';
import { runWorkflowRemove, runWorkflowUpsert } from '../mutation/runWorkflowMutation';
import type { WorkflowMutationDeps } from '../mutation/runWorkflowMutation';
import type { RemoveSpec, UpsertSpec } from '../../../domain/schema/mutationSpec';

const VM_SYNC_BURST_MS = 3000;
const VM_TOTAL_DEADLINE_MS = 10000;
const VM_POLL_TICK_MS = 15;
const VM_MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;
const VM_STACK_SIZE_BYTES = 512 * 1024;
const MAX_QUERIES = 25;
const MAX_MUTATIONS = 25;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let modulePromise: Promise<QuickJSWASMModule> | null = null;
const getModule = (): Promise<QuickJSWASMModule> => {
  if (!modulePromise) modulePromise = getQuickJS();
  return modulePromise;
};

const isDateSentinel = (value: unknown): value is { __date__: number } =>
  typeof value === 'object' && value !== null && typeof (value as { __date__?: unknown }).__date__ === 'number';

const dateReviver = (_key: string, value: unknown): unknown =>
  isDateSentinel(value) ? new Date(value.__date__) : value;

function hostStringify(value: unknown): string {
  const json = JSON.stringify(value, function (this: Record<string, unknown>, key: string, val: unknown) {
    const original = this[key];
    if (original instanceof Date) return { __date__: original.getTime() };
    return val;
  });
  return json ?? 'null';
}

function hostParse(json: string): unknown {
  return JSON.parse(json, dateReviver);
}

const VM_HELPERS = `(() => {
  const rep = function (key, val) { const o = this[key]; if (o instanceof Date) return { __date__: o.getTime() }; return val; };
  const rev = function (key, val) { if (val && typeof val === 'object' && typeof val.__date__ === 'number') return new Date(val.__date__); return val; };
  globalThis.__ser = (v) => JSON.stringify(v, rep);
  globalThis.__de = (s) => JSON.parse(s, rev);
  globalThis.__wrap = (v) => Promise.resolve(v);
})();`;

const friendlyError = (detail: unknown): string => {
  const message =
    typeof detail === 'object' && detail !== null && 'message' in detail
      ? String((detail as { message: unknown }).message)
      : String(detail);
  if (/interrupt/i.test(message)) return 'Tempo de execução do Script excedido.';
  if (/out of memory|memory/i.test(message)) return 'Limite de memória do Script excedido.';
  return `Erro de execução no Script: ${message}`;
};

const buildQuerySpec = (raw: unknown): QuerySpec => {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const whereRaw = Array.isArray(obj.where) ? obj.where : [];
  const where: QueryPredicate[] = whereRaw.map((entry) => {
    const pred = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>;
    const predicate: QueryPredicate = {
      path: typeof pred.path === 'string' ? pred.path : '',
      op: pred.op as QueryOperator,
    };
    if (pred.value !== undefined) predicate.value = { kind: 'Literal', value: pred.value };
    return predicate;
  });

  const orderByRaw = Array.isArray(obj.orderBy) ? obj.orderBy : undefined;
  const orderBy: QueryOrderBy[] | undefined = orderByRaw?.map((entry) => {
    const ord = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>;
    return { path: typeof ord.path === 'string' ? ord.path : '', dir: ord.dir === 'desc' ? 'desc' : 'asc' };
  });

  return {
    table: typeof obj.table === 'string' ? obj.table : '',
    where,
    orderBy,
    limit: typeof obj.limit === 'number' ? obj.limit : 50,
    projections: Array.isArray(obj.projections) ? obj.projections.filter((x): x is string => typeof x === 'string') : [],
  };
};

const buildUpsertSpec = (raw: unknown): UpsertSpec => {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const data =
    typeof obj.data === 'object' && obj.data !== null && !Array.isArray(obj.data)
      ? (obj.data as Record<string, unknown>)
      : {};
  const spec: UpsertSpec = { table: typeof obj.table === 'string' ? obj.table : '', data };
  if (typeof obj.id === 'string' && obj.id.trim() !== '') spec.id = obj.id;
  return spec;
};

const buildRemoveSpec = (raw: unknown): RemoveSpec => {
  const obj = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    table: typeof obj.table === 'string' ? obj.table : '',
    id: typeof obj.id === 'string' ? obj.id : '',
  };
};

export async function runScriptSandbox(
  compiledJs: string,
  input: Record<string, unknown>,
  context: WorkflowContext,
  deps: WorkflowQueryDeps,
  mutationDeps: WorkflowMutationDeps,
): Promise<Record<string, unknown>> {
  const quickJS = await getModule();
  const vm: QuickJSContext = quickJS.newContext();
  const owned: QuickJSHandle[] = [];
  const inflight = new Set<Promise<void>>();
  const pendingDeferreds = new Set<QuickJSDeferredPromise>();
  let queryCount = 0;
  let mutationCount = 0;

  const evalStatement = (code: string): void => {
    vm.unwrapResult(vm.evalCode(code)).dispose();
  };

  const vmValueToHost = (handle: QuickJSHandle): unknown => {
    const type = vm.typeof(handle);
    if (type === 'undefined' || type === 'function' || type === 'symbol') return undefined;
    if (type === 'string') return vm.getString(handle);
    if (type === 'number') return vm.getNumber(handle);
    const serialized = vm.callFunction(serHandle, vm.undefined, handle);
    if (serialized.error) {
      serialized.error.dispose();
      return undefined;
    }
    const json = vm.typeof(serialized.value) === 'string' ? vm.getString(serialized.value) : undefined;
    serialized.value.dispose();
    return json === undefined ? undefined : hostParse(json);
  };

  const hostValueToVm = (value: unknown): QuickJSHandle => {
    const strHandle = vm.newString(hostStringify(value));
    const result = vm.callFunction(deHandle, vm.undefined, strHandle);
    strHandle.dispose();
    return vm.unwrapResult(result);
  };

  let serHandle: QuickJSHandle;
  let deHandle: QuickJSHandle;
  let wrapHandle: QuickJSHandle;

  try {
    vm.runtime.setMemoryLimit(VM_MEMORY_LIMIT_BYTES);
    vm.runtime.setMaxStackSize(VM_STACK_SIZE_BYTES);
    vm.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + VM_SYNC_BURST_MS));

    evalStatement(VM_HELPERS);
    serHandle = vm.getProp(vm.global, '__ser');
    deHandle = vm.getProp(vm.global, '__de');
    wrapHandle = vm.getProp(vm.global, '__wrap');
    owned.push(serHandle, deHandle, wrapHandle);
    evalStatement('delete globalThis.__ser; delete globalThis.__de; delete globalThis.__wrap;');

    const inputHandle = hostValueToVm(input);
    vm.setProp(vm.global, 'input', inputHandle);
    inputHandle.dispose();

    const formatLogArgs = (args: QuickJSHandle[]): string =>
      args
        .map((h) => {
          const value = vmValueToHost(h);
          return typeof value === 'string' ? value : hostStringify(value);
        })
        .join(' ');

    const logHandle = vm.newFunction('log', (...args) => {
      context.logger.info(formatLogArgs(args));
    });
    vm.setProp(vm.global, 'log', logHandle);
    logHandle.dispose();

    const consoleObject = vm.newObject();
    const registerConsoleMethod = (name: string, sink: (message: string) => void): void => {
      const handle = vm.newFunction(name, (...args) => {
        sink(formatLogArgs(args));
      });
      vm.setProp(consoleObject, name, handle);
      handle.dispose();
    };
    registerConsoleMethod('log', (m) => context.logger.info(m));
    registerConsoleMethod('info', (m) => context.logger.info(m));
    registerConsoleMethod('warn', (m) => context.logger.warn(m));
    registerConsoleMethod('error', (m) => context.logger.error(m));
    vm.setProp(vm.global, 'console', consoleObject);
    consoleObject.dispose();

    const queryHandle = vm.newFunction('query', (specHandle) => {
      const deferred = vm.newPromise();
      pendingDeferreds.add(deferred);
      void deferred.settled.then(() => {
        pendingDeferreds.delete(deferred);
        if (vm.alive) vm.runtime.executePendingJobs();
      });

      queryCount += 1;
      if (queryCount > MAX_QUERIES) {
        const errHandle = vm.newString('Limite de consultas do Script excedido.');
        deferred.reject(errHandle);
        errHandle.dispose();
        return deferred.handle;
      }

      const spec = buildQuerySpec(vmValueToHost(specHandle));
      const work = runWorkflowQuery(spec, context, deps)
        .then((outcome) => {
          if (!vm.alive) return;
          if (outcome.ok) {
            const valueHandle = hostValueToVm(outcome.value);
            deferred.resolve(valueHandle);
            valueHandle.dispose();
          } else {
            const errHandle = vm.newString(outcome.error);
            deferred.reject(errHandle);
            errHandle.dispose();
          }
        })
        .catch((error: unknown) => {
          if (!vm.alive) return;
          const errHandle = vm.newString(error instanceof Error ? error.message : String(error));
          deferred.reject(errHandle);
          errHandle.dispose();
        })
        .finally(() => {
          inflight.delete(work);
        });
      inflight.add(work);

      return deferred.handle;
    });
    vm.setProp(vm.global, 'query', queryHandle);
    queryHandle.dispose();

    const registerAsyncBridge = (
      name: string,
      overLimit: () => boolean,
      limitMessage: string,
      run: (arg: unknown) => Promise<{ ok: true; value: unknown } | { ok: false; error: string }>,
    ): void => {
      const handle = vm.newFunction(name, (argHandle) => {
        const deferred = vm.newPromise();
        pendingDeferreds.add(deferred);
        void deferred.settled.then(() => {
          pendingDeferreds.delete(deferred);
          if (vm.alive) vm.runtime.executePendingJobs();
        });

        if (overLimit()) {
          const errHandle = vm.newString(limitMessage);
          deferred.reject(errHandle);
          errHandle.dispose();
          return deferred.handle;
        }

        const arg = vmValueToHost(argHandle);
        const work = run(arg)
          .then((outcome) => {
            if (!vm.alive) return;
            if (outcome.ok) {
              const valueHandle = hostValueToVm(outcome.value);
              deferred.resolve(valueHandle);
              valueHandle.dispose();
            } else {
              const errHandle = vm.newString(outcome.error);
              deferred.reject(errHandle);
              errHandle.dispose();
            }
          })
          .catch((error: unknown) => {
            if (!vm.alive) return;
            const errHandle = vm.newString(error instanceof Error ? error.message : String(error));
            deferred.reject(errHandle);
            errHandle.dispose();
          })
          .finally(() => {
            inflight.delete(work);
          });
        inflight.add(work);

        return deferred.handle;
      });
      vm.setProp(vm.global, name, handle);
      handle.dispose();
    };

    const overMutationLimit = (): boolean => {
      mutationCount += 1;
      return mutationCount > MAX_MUTATIONS;
    };
    const MUTATION_LIMIT_MESSAGE = 'Limite de gravações/exclusões do Script excedido.';
    registerAsyncBridge('upsert', overMutationLimit, MUTATION_LIMIT_MESSAGE, (arg) =>
      runWorkflowUpsert(buildUpsertSpec(arg), context, mutationDeps),
    );
    registerAsyncBridge('remove', overMutationLimit, MUTATION_LIMIT_MESSAGE, (arg) =>
      runWorkflowRemove(buildRemoveSpec(arg), context, mutationDeps),
    );

    const fnObject = vm.newObject();
    for (const definition of expressionFunctions.getAllDefinitions()) {
      const implementation = expressionFunctions.resolve(definition.name);
      if (!implementation) continue;
      const fnHandle = vm.newFunction(definition.name, (...argHandles) => {
        const args = argHandles.map(vmValueToHost);
        try {
          const result = implementation.call(args, context);
          return hostValueToVm(result);
        } catch (error) {
          return { error: vm.newError(error instanceof Error ? error.message : String(error)) };
        }
      });
      vm.setProp(fnObject, definition.name, fnHandle);
      fnHandle.dispose();
    }
    vm.setProp(vm.global, 'fn', fnObject);
    fnObject.dispose();

    const evalResult = vm.evalCode(compiledJs);
    if (evalResult.error) {
      const detail = vm.dump(evalResult.error);
      evalResult.error.dispose();
      throw new Error(friendlyError(detail));
    }

    const wrapped = vm.callFunction(wrapHandle, vm.undefined, evalResult.value);
    evalResult.value.dispose();
    if (wrapped.error) {
      const detail = vm.dump(wrapped.error);
      wrapped.error.dispose();
      throw new Error(friendlyError(detail));
    }

    const settledPromise = vm.resolvePromise(wrapped.value);
    wrapped.value.dispose();

    let finished = false;
    void settledPromise.finally(() => {
      finished = true;
    });

    const deadline = Date.now() + VM_TOTAL_DEADLINE_MS;
    while (!finished) {
      if (Date.now() > deadline) throw new Error('Tempo de execução do Script excedido.');

      vm.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + VM_SYNC_BURST_MS));
      const executed = vm.unwrapResult(vm.runtime.executePendingJobs());
      if (finished) break;

      if (inflight.size > 0) {
        // Aguarda uma consulta liquidar OU um tick de timer. O `delay` via setTimeout cede à
        // fase de I/O do event loop — sem ele, um `await` só de microtask deixaria o Node preso
        // na fila de microtasks e a resposta real do Firestore nunca seria processada (starvation).
        await Promise.race([...inflight, delay(VM_POLL_TICK_MS)]);
      } else if (executed === 0) {
        await Promise.resolve();
        if (!finished && inflight.size === 0) break;
      } else {
        await Promise.resolve();
      }
    }

    if (!finished) {
      throw new Error('O Script não concluiu: a função principal retornou uma promessa não resolvida.');
    }

    const resolved = await settledPromise;
    if (resolved.error) {
      const detail = vm.dump(resolved.error);
      resolved.error.dispose();
      throw new Error(friendlyError(detail));
    }

    const output = vmValueToHost(resolved.value);
    resolved.value.dispose();

    if (typeof output !== 'object' || output === null || Array.isArray(output)) {
      throw new Error('O Script deve retornar um objeto com os campos de saída.');
    }
    return output as Record<string, unknown>;
  } finally {
    // Rejeita deferreds de query em voo (ex.: deadline estourou com consulta pendente ou
    // query fire-and-forget) e bombeia jobs para desenrolar as async functions suspensas.
    // Sem isso, sobrariam objetos vivos na VM e o vm.dispose() aborta o processo QuickJS.
    if (vm.alive) {
      for (let round = 0; round < 5 && pendingDeferreds.size > 0; round++) {
        for (const deferred of [...pendingDeferreds]) {
          pendingDeferreds.delete(deferred);
          try {
            if (deferred.alive) {
              const errHandle = vm.newString('Script encerrado antes de concluir a consulta.');
              deferred.reject(errHandle);
              errHandle.dispose();
            }
          } catch {
            // ignora — estamos em cleanup
          }
        }
        try {
          vm.runtime.executePendingJobs();
        } catch {
          // ignora — estamos em cleanup
        }
      }
    }
    for (const handle of owned) {
      if (handle.alive) handle.dispose();
    }
    if (vm.alive) vm.dispose();
  }
}
