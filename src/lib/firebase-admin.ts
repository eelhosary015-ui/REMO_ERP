import admin from 'firebase-admin';
import firebaseConfig from '../../firebase-applet-config.json';

const adminApp = admin as any;

if (adminApp && adminApp.apps && !adminApp.apps.length) {
  try {
    adminApp.initializeApp({
      projectId: firebaseConfig.projectId,
    });
  } catch (e) {
    console.warn("Firebase admin initialization failed or already initialized", e);
  }
}

export const adminAuth = (adminApp && typeof adminApp.auth === 'function') ? adminApp.auth() : null;
export default admin;
