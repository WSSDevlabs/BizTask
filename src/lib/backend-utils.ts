import { auth, secondaryAuth, storage, db } from '@/lib/firebase';
import { env } from '@/lib/env';
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

function isEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

export async function loginAdmin(identifier: string, password: string): Promise<void> {
  let email = identifier;

  if (identifier === env.hrLoginShortcut) {
    email = env.hrMasterEmail;
  } else if (!isEmail(identifier)) {
    // Worker ID lookup — allowed by public read rule on employees
    const snap = await getDocs(
      query(collection(db, 'employees'), where('workerId', '==', identifier), limit(1))
    );
    if (snap.empty) throw new Error('Worker ID not found.');
    email = snap.docs[0].data().email;
  }

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

export async function uploadExpenseReceipt(file: File, expenseId: string): Promise<string> {
  const storageRef = ref(storage, `receipts/${expenseId}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// Generic uploader — used for assets, employee documents, etc.
export async function uploadFile(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
