import type { IHttpRequestTester } from '../../repositories/IHttpRequestTester';
import type { HttpRequestSpec, HttpTestResult } from '../../schema/httpRequestSpec';

export type TestHttpRequestUseCase = {
  execute: (tenantId: string, request: HttpRequestSpec) => Promise<HttpTestResult>;
};

export const makeTestHttpRequestUseCase = (tester: IHttpRequestTester): TestHttpRequestUseCase => ({
  execute: (tenantId, request) => tester.test(tenantId, request),
});
