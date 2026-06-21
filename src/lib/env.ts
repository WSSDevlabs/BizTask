// Validates all required environment variables at module load time.
// Fails fast with a clear error during development or CI rather than
// a cryptic Firebase "invalid API key" at runtime.

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_HR_MASTER_EMAIL',
  'VITE_HR_LOGIN_SHORTCUT',
] as const;

const missing = required.filter((key) => !import.meta.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables:\n${missing.map((k) => `  • ${k}`).join('\n')}\n\nCopy .env.example to .env.local and fill in the values.`
  );
}

export const env = {
  firebase: {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY as string,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID as string,
  },
  hrMasterEmail:    import.meta.env.VITE_HR_MASTER_EMAIL as string,
  hrLoginShortcut:  import.meta.env.VITE_HR_LOGIN_SHORTCUT as string,
} as const;
