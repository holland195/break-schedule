// ═══════════════════════════════════════════════
//  FIREBASE AUTH WRAPPER
//
//  All Firebase SDK calls are isolated here.
//  auth.js calls these functions — never calls
//  Firebase SDK directly.
//
//  SETUP (one-time, admin):
//  1. Go to console.firebase.google.com
//  2. Your project → Authentication → Get started
//  3. Enable "Email/Password" sign-in method
//  4. Go to Project Settings → General → Your apps
//     → Add app (Web) → copy the firebaseConfig object
//  5. Paste your config values below (replace placeholders)
//  6. Run the migration script (migrate-users.html) once
//     to create Firebase Auth accounts for all staff
//     Email format: username@discoveryloft.com
// ═══════════════════════════════════════════════

// ── Your Firebase project config ──
// Get this from: Firebase Console → Project Settings → General → Your apps → SDK setup
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDpkSsDS2HMvDl8EXoD5J23VXLyligTkFk",
  authDomain: "break-schedule-pave.firebaseapp.com",
  databaseURL: "https://break-schedule-pave-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "break-schedule-pave",
  storageBucket: "break-schedule-pave.firebasestorage.app",
  messagingSenderId: "1080497083744",
  appId: "1:1080497083744:web:72915f7d298d039bfe3a05",
  measurementId: "G-LQYK6LRZXP"
};

// ── Firebase SDK (loaded via CDN in index.html) ──
let _fbAuth = null;

function _initFirebase() {
  if (_fbAuth) return _fbAuth;
  try {
    // firebase/app and firebase/auth are loaded as compat CDN scripts in index.html
    const app  = firebase.initializeApp(FIREBASE_CONFIG);
    _fbAuth    = firebase.auth();
    console.log('[firebase-auth] initialized, project:', FIREBASE_CONFIG.projectId);
    return _fbAuth;
  } catch (e) {
    // Already initialized (hot reload / double-include)
    _fbAuth = firebase.auth();
    return _fbAuth;
  }
}

// ── Exported helpers called by auth.js ──

async function firebaseSignIn(email, password) {
  const auth = _initFirebase();
  return auth.signInWithEmailAndPassword(email, password);
}

async function firebaseSignOut() {
  const auth = _initFirebase();
  return auth.signOut();
}

async function firebaseUpdatePassword(newPassword) {
  const auth = _initFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user.');
  return user.updatePassword(newPassword);
}

async function firebaseSendPasswordReset(email) {
  const auth = _initFirebase();
  return auth.sendPasswordResetEmail(email);
}

// ── onAuthStateChanged: called once at boot in index.html ──
// Fires on every page load. If Firebase has a valid session token,
// it auto-logs the user in without showing the login screen.
function firebaseOnAuthStateChanged(callback) {
  const auth = _initFirebase();
  auth.onAuthStateChanged(callback);
}

// ── Get current Firebase UID (for linking to DB records) ──
function firebaseCurrentUid() {
  if (!_fbAuth) return null;
  return _fbAuth.currentUser?.uid || null;
}