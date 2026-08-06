import { auth, secondaryAuth, db } from '@/lib/firebase';
import { env } from '@/lib/env';
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

function isEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

export async function loginAdmin(identifier: string, password: string, remember = true): Promise<void> {
  let email = identifier;

  if (identifier === env.hrLoginShortcut) {
    email = env.hrMasterEmail;
  } else if (!isEmail(identifier)) {
    // Worker ID lookup (e.g. "RZ01") — allowed by public list rule on employees, limit(1) only
    const snap = await getDocs(
      query(collection(db, 'employees'), where('workerId', '==', identifier), limit(1))
    );
    if (snap.empty) throw new Error('Worker ID not found.');
    email = snap.docs[0].data().email;
  }

  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logoutAdmin(): Promise<void> {
  await signOut(auth);
}

export async function createSystemUserAuth(email: string, password: string): Promise<string> {
  // Use secondary auth instance so primary auth (HR) stays signed in
  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const uid = credential.user.uid;
  // Sign out of secondary instance immediately — we only needed the UID
  await signOut(secondaryAuth);
  return uid;
}

// Firebase Storage requires the paid Blaze plan, so files are kept on the free
// Spark plan by inlining them as base64 data URLs directly in Firestore.
// Firestore caps a document at 1 MiB, so callers must enforce a byte limit
// before calling this (base64 inflates size by ~33%).
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
