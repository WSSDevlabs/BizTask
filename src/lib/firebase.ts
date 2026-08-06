import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { env } from '@/lib/env';

const app = getApps().length === 0
  ? initializeApp(env.firebase)
  : getApp();

// Secondary app instance is used exclusively for creating new user accounts
// without signing out the current HR/Executive user.
const secondaryApp =
  getApps().find((a) => a.name === 'secondary') ??
  initializeApp(env.firebase, 'secondary');

export const db            = getFirestore(app);
export const auth          = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
