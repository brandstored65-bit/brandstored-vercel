// lib/firebase-admin.js
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth as adminGetAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse and validate service account
let keyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

// Fallback: Try to read from credentials file if env var not set
if (!keyEnv) {
  try {
    const credentialPath = join(__dirname, '..', 'credentials', 'firebase-credentials.json');
    const credentialData = readFileSync(credentialPath, 'utf-8');
    keyEnv = credentialData;
    console.log('📁 Loaded Firebase credentials from credentials/firebase-credentials.json');
  } catch (err) {
    // File doesn't exist or can't be read - that's OK, will try env var
  }
}

let serviceAccount;
try {
  if (!keyEnv) {
    // During build time, Firebase may not be initialized yet
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT_KEY env variable is missing and credentials/firebase-credentials.json not found - Firebase features will not be available at runtime');
  } else {
    serviceAccount = JSON.parse(keyEnv);
    console.log('✅ Service account parsed successfully');
    console.log('📋 Project ID:', serviceAccount.project_id);
    console.log('📋 Client Email:', serviceAccount.client_email);
    
    // Validate required fields
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('Service account is missing required fields (project_id, private_key, or client_email)');
    }
  }
} catch (e) {
  console.error('❌ Firebase service account parsing error:', e.message);
}

// Initialize Firebase Admin only if credentials exist
if (serviceAccount && !getApps().length) {
  console.log('🔥 Initializing Firebase Admin SDK...');
  try {
    // Ensure project id is visible to underlying Google auth libs BEFORE init
    if (!process.env.GOOGLE_CLOUD_PROJECT) {
      process.env.GOOGLE_CLOUD_PROJECT = serviceAccount.project_id;
    }
    if (!process.env.GCLOUD_PROJECT) {
      process.env.GCLOUD_PROJECT = serviceAccount.project_id;
    }
    if (!process.env.FIREBASE_CONFIG) {
      process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: serviceAccount.project_id });
    }
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    console.log('✅ Firebase Admin initialized successfully for project:', serviceAccount.project_id);
  } catch (e) {
    console.error('❌ Firebase Admin initialization failed:', e.message);
    if (process.env.NODE_ENV === 'development') {
      throw e;
    }
  }
} else if (getApps().length) {
  console.log('ℹ️  Firebase Admin already initialized');
} else {
  console.warn('⚠️  Firebase Admin not initialized - service account credentials not available');
}

// Safe getter that throws a clear error if admin is not initialized
export const getAuth = () => {
  try {
    // Ensure project env vars are always available at call-time
    // (some server runtimes may not preserve module init ordering)
    if ((!process.env.GCLOUD_PROJECT || !process.env.GOOGLE_CLOUD_PROJECT) && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        if (sa?.project_id) {
          if (!process.env.GCLOUD_PROJECT) process.env.GCLOUD_PROJECT = sa.project_id;
          if (!process.env.GOOGLE_CLOUD_PROJECT) process.env.GOOGLE_CLOUD_PROJECT = sa.project_id;
          if (!process.env.FIREBASE_CONFIG) {
            process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: sa.project_id });
          }
        }
      } catch {
        // ignore parse errors here; detailed parsing errors are logged during module init
      }
    }
    return adminGetAuth();
  } catch (e) {
    throw new Error('Firebase Admin not initialized. Set FIREBASE_SERVICE_ACCOUNT_KEY.');
  }
};

// Preferred backend auth instance export
export const auth = {
  verifyIdToken: (...args) => getAuth().verifyIdToken(...args),
  createUser: (...args) => getAuth().createUser(...args),
  deleteUser: (...args) => getAuth().deleteUser(...args),
  getUser: (...args) => getAuth().getUser(...args),
  setCustomUserClaims: (...args) => getAuth().setCustomUserClaims(...args),
};