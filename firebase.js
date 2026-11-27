import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js';
import { firebaseConfig, firebaseConfigured } from './firebase-config.js';

// Reuse the default app if another page module initialized it first.
export const app = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

export const firebaseReady = Boolean(app);
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const realtimeDb = app ? getDatabase(app) : null;

// Short alias for game modules that prefer `rtdb`.
export const rtdb = realtimeDb;
