import admin from 'firebase-admin';

let initialized = false;

if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    try {
      const serviceAccount = JSON.parse(raw);
      if (serviceAccount?.project_id) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        initialized = true;
      } else {
        console.warn('[Firebase Admin] Service account is missing "project_id". Firebase not initialized.');
      }
    } catch (e) {
      console.warn('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', e.message);
    }
  } else {
    console.warn('[Firebase Admin] FIREBASE_SERVICE_ACCOUNT_KEY env variable is missing. Firebase not initialized.');
  }
} else {
  initialized = true;
}

export { initialized as firebaseInitialized };
export default admin;
