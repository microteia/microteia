import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { IHttpRequestTester } from '../../domain/repositories/IHttpRequestTester';
import { HTTP_TEST_TIMEOUT_SECONDS, type HttpRequestSpec, type HttpTestResult } from '../../domain/schema/httpRequestSpec';

export class FirebaseHttpRequestTester implements IHttpRequestTester {
  async test(tenantId: string, request: HttpRequestSpec): Promise<HttpTestResult> {
    const call = httpsCallable<{ tenantId: string; request: HttpRequestSpec }, HttpTestResult>(
      functions,
      'testHttpRequest',
      { timeout: (HTTP_TEST_TIMEOUT_SECONDS + 20) * 1000 },
    );
    return (await call({ tenantId, request })).data;
  }
}
