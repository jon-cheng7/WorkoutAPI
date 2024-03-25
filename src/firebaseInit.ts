import * as admin from 'firebase-admin';
import serviceAccount from './key.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  databaseURL: "https://workout-api-29a2e-default-rtdb.firebaseio.com/"
});

export const db = admin.database();