import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IRegistrationPolicyRepository } from '../../domain/repositories/IRegistrationPolicyRepository';
import { REGISTRATION_POLICY_PATH, registrationPolicyOf, type RegistrationPolicy } from '../../domain/schema/registration';

export class FirebaseRegistrationPolicyRepository implements IRegistrationPolicyRepository {
  async getPolicy(): Promise<RegistrationPolicy> {
    const snap = await getDoc(doc(db, REGISTRATION_POLICY_PATH));
    return registrationPolicyOf(snap.exists() ? snap.data() : undefined);
  }

  async updatePolicy(change: Partial<RegistrationPolicy>, updatedBy: string): Promise<void> {
    await setDoc(doc(db, REGISTRATION_POLICY_PATH), { ...change, updatedBy, updatedAt: serverTimestamp() }, { merge: true });
  }
}
