import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDocFromServer,
  enableMultiTabIndexedDbPersistence,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { handleFirestoreError, OperationType } from './firestore-errors';

// standard initialization
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

// Enable offline persistence for field usage
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db)
    .then(() => {
      console.log('✅ Firestore offline persistence enabled successfully');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time.
        enableIndexedDbPersistence(db)
          .then(() => {
            console.log('✅ Firestore offline persistence enabled (single tab fallback)');
          })
          .catch((singleErr) => {
            console.warn('⚠️ Firestore persistence fallback failed:', singleErr);
          });
      } else if (err.code === 'unimplemented') {
        console.warn('⚠️ Firestore persistence is unimplemented in this browser');
      } else {
        console.warn('⚠️ Firestore persistence error:', err);
      }
    });
}

// Verify Connection to Firestore
async function testConnection() {
  // Only run in production/hosted environment to avoid spamming during local dev if needed
  // But here we want to catch it in the preview
  try {
    await getDocFromServer(doc(db, '_connection_test_', 'check'));
    console.log('✅ Firestore connected successfully');
  } catch (error) {
    if (error instanceof Error && (error.message.includes('unavailable') || error.message.includes('offline'))) {
      console.warn('⚠️ Firestore is offline or unreachable. Check your network or Firebase rules/quota.');
    } else {
      try {
        handleFirestoreError(error, OperationType.GET, '_connection_test_', auth);
      } catch (e) {
        // Error already logged by handleFirestoreError
      }
    }
  }
}

testConnection();

export default app;
