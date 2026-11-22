import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

// Firebase web configuration identifies the project; it is not an admin credential.
const app = initializeApp({
  apiKey: 'AIzaSyBm2S3Ie_8CFJfT4T38M4sni0nSOSMoPX0',
  authDomain: 'm-v-ml.firebaseapp.com',
  databaseURL: 'https://m-v-ml-default-rtdb.firebaseio.com',
  projectId: 'm-v-ml',
  storageBucket: 'm-v-ml.firebasestorage.app',
  messagingSenderId: '1009717513653',
  appId: '1:1009717513653:web:3bc1bc1b890e234bad5dfc',
});

const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY;
export const appCheckConfigured = Boolean(siteKey);
if (siteKey) initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'asia-south1');
