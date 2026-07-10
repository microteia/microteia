import { getQuickJS, shouldInterruptAfterDeadline } from 'quickjs-emscripten';
import type { QuickJSWASMModule, QuickJSContext, QuickJSHandle } from 'quickjs-emscripten';
import { expressionFunctions } from '../../../domain/engine/expression/ExpressionEngine';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';

const VM_DEADLINE_MS = 3000;
const VM_MEMORY_LIMIT_BYTES = 32 * 1024 * 1024;
const VM_STACK_SIZE_BYTES = 512 * 1024;

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

export async function runScriptSandbox(
  compiledJs: string,
  input: Record<string, unknown>,
  context: WorkflowContext,
): Promise<Record<string, unknown>> {
  const quickJS = await getModule();
  const vm: QuickJSContext = quickJS.newContext();
  const owned: QuickJSHandle[] = [];

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
    vm.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + VM_DEADLINE_MS));

    evalStatement(VM_HELPERS);
    serHandle = vm.getProp(vm.global, '__ser');
    deHandle = vm.getProp(vm.global, '__de');
    wrapHandle = vm.getProp(vm.global, '__wrap');
    owned.push(serHandle, deHandle, wrapHandle);
    evalStatement('delete globalThis.__ser; delete globalThis.__de; delete globalThis.__wrap;');

    const inputHandle = hostValueToVm(input);
    vm.setProp(vm.global, 'input', inputHandle);
    inputHandle.dispose();

    const logHandle = vm.newFunction('log', (...args) => {
      const parts = args.map((h) => {
        const value = vmValueToHost(h);
        return typeof value === 'string' ? value : hostStringify(value);
      });
      context.logger.info(parts.join(' '));
    });
    vm.setProp(vm.global, 'log', logHandle);
    logHandle.dispose();

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

    const settled = vm.resolvePromise(wrapped.value);
    wrapped.value.dispose();

    let executed = vm.unwrapResult(vm.runtime.executePendingJobs());
    while (executed > 0) {
      executed = vm.unwrapResult(vm.runtime.executePendingJobs());
    }

    const resolved = await settled;
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
    for (const handle of owned) {
      if (handle.alive) handle.dispose();
    }
    if (vm.alive) vm.dispose();
  }
}
