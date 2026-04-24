import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';

/**
 * Verify Firebase ID token and extract user information
 * @param {string} token - Firebase ID token from client
 * @returns {Promise<{userId: string, email: string} | null>} User info or null if invalid
 */
export async function verifyAuth(token) {
  try {
    if (!token) return null;

    // Ensure Firebase Admin is initialized
    if (!getApps().length) {
      throw new Error('Firebase Admin not initialized');
    }

    const auth = auth;
    const decodedToken = await auth.verifyIdToken(token);
    
    return {
      userId: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
}
