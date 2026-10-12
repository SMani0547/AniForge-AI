import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, onAuthStateChanged, signInAnonymously, signInWithPopup, signOut, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Object.values(config).every((value) => Boolean(value?.trim()));
export const anonymousEnabled = import.meta.env.VITE_ENABLE_ANONYMOUS_AUTH === 'true';
export const auth = firebaseConfigured ? getAuth(initializeApp(config)) : null;

if (auth && import.meta.env.DEV && import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
  connectAuthEmulator(auth, String(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL), { disableWarnings: false });
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(auth));
  const [error, setError] = useState('');
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    }, () => {
      setError('Your sign-in session could not be restored. Reload to try again.');
      setLoading(false);
    });
  }, []);
  return { user, loading, error };
}

export async function authenticate(anonymous = false) {
  if (!auth) throw new Error('Firebase is not configured. Follow the setup guide to enable sign-in.');
  if (anonymous && !anonymousEnabled) throw new Error('Anonymous sign-in is not enabled.');
  try {
    if (anonymous) await signInAnonymously(auth);
    else await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const messages: Record<string, string> = {
      'auth/popup-closed-by-user': 'Sign-in was cancelled. You can try again whenever you are ready.',
      'auth/popup-blocked': 'Allow pop-ups for this site, then try signing in again.',
      'auth/unauthorized-domain': 'This domain is not authorized in Firebase Authentication. Add it in the Firebase console.',
      'auth/operation-not-allowed': 'This sign-in provider is not enabled in Firebase Authentication.',
      'auth/network-request-failed': 'Could not connect to Firebase. Check your connection and retry.',
    };
    throw new Error(messages[code] ?? 'Sign-in failed. Check the Firebase configuration and try again.');
  }
}

export async function logOut() {
  if (auth) await signOut(auth);
}
