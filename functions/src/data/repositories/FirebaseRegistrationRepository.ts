import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type { IRegistrationRepository, RefusedAccount } from '../../domain/repositories/IRegistrationRepository';
import {
  REGISTRATION_POLICY_PATH,
  REGISTRATION_REFUSALS_COLLECTION,
  REGISTRATION_REFUSAL_TTL_MS,
  registrationPolicyOf,
  type RegistrationPolicy,
} from '../../domain/schema/registration';

export class FirebaseRegistrationRepository implements IRegistrationRepository {
  constructor(
    private readonly db: Firestore,
    private readonly auth: Auth,
    private readonly now: () => number = Date.now,
  ) {}

  async getPolicy(): Promise<RegistrationPolicy> {
    const snap = await this.db.doc(REGISTRATION_POLICY_PATH).get();
    return registrationPolicyOf(snap.exists ? snap.data() : undefined);
  }

  async refuse({ userId, email }: RefusedAccount): Promise<void> {
    await this.db.collection(REGISTRATION_REFUSALS_COLLECTION).doc(userId).set({
      email,
      refusedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(this.now() + REGISTRATION_REFUSAL_TTL_MS),
    });
    try {
      await this.auth.deleteUser(userId);
    } catch (err) {
      // A conta que já não existe é o resultado pedido — o gatilho entregue duas vezes chega aqui.
      if ((err as { code?: string }).code !== 'auth/user-not-found') throw err;
    }
  }
}
