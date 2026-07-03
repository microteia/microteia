import * as functionsV1 from 'firebase-functions/v1';
import { getDI } from '../di/container';

// Auth triggers (onCreate/onDelete) ainda são exclusivos da API v1 do
// firebase-functions — não há equivalente em v2 até o momento.
export const onUserCreated = functionsV1
  .region('us-central1')
  .auth.user()
  .onCreate(async (user) => {
    const di = getDI();
    const useCase = di.getBootstrapUserUseCase();

    try {
      await useCase.execute({
        userId: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? user.email ?? 'Usuário',
        photoURL: user.photoURL ?? null,
      });
    } catch (err) {
      console.error('[onUserCreated] Falha ao provisionar novo usuário:', user.uid, err);
      throw err;
    }
  });
