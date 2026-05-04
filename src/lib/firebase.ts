import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { handleFirestoreError, OperationType } from './firestore-errors';

// standard initialization
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);

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
