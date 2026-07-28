// Firebase cloud sync — module. Exposes globals on window.WorkoutSync so app.js
// (loaded as a regular script) can call in.
//
// Storage model: one document per user at /users/{uid}, containing:
//   { state: <full app state JSON>, updatedAt: serverTimestamp, deviceId }
//
// Sync policy:
//   • On sign-in: fetch cloud doc. If newer than local, replace state.
//   • On any local saveState(): debounced (2s) push to cloud.
//   • Realtime onSnapshot listens for writes from OTHER devices.
//     Own writes are filtered by comparing deviceId.
//
// If the user isn't signed in, everything falls back to localStorage — the app
// continues to work fully offline.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, serverTimestamp,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCgy28dqL2agj0_ns92a9GagW-nipVhxsQ",
  authDomain: "workout-tracker-9f206.firebaseapp.com",
  projectId: "workout-tracker-9f206",
  storageBucket: "workout-tracker-9f206.firebasestorage.app",
  messagingSenderId: "41963517206",
  appId: "1:41963517206:web:c06128f25e3d6234e10c37",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(() => { /* multi-tab or unsupported */ });

// Stable device ID persisted so we can filter our own snapshots.
const DEVICE_ID_KEY = "workout-tracker:deviceId";
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = "d-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
const deviceId = getDeviceId();

let currentUser = null;
let unsubscribeSnapshot = null;
let pushTimer = null;
let lastPushAt = 0;
const PUSH_DEBOUNCE_MS = 2000;

// Called by app.js after every saveState() to schedule a cloud upload.
function scheduleCloudPush() {
  if (!currentUser) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    doCloudPush();
  }, PUSH_DEBOUNCE_MS);
}

async function doCloudPush() {
  if (!currentUser) return;
  const state = window.__getState?.();
  if (!state) return;
  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      state,
      updatedAt: serverTimestamp(),
      deviceId,
      clientTime: Date.now(),
    });
    lastPushAt = Date.now();
    window.__onCloudPushed?.();
  } catch (e) {
    console.error("Cloud push failed:", e);
    window.__onCloudError?.(e.message || String(e));
  }
}

async function pullFromCloud() {
  if (!currentUser) return null;
  const snap = await getDoc(doc(db, "users", currentUser.uid));
  if (!snap.exists()) return null;
  return snap.data();
}

function subscribeSnapshot() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  if (!currentUser) return;
  unsubscribeSnapshot = onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (!data.state) return;
    // Skip snapshots we produced ourselves
    if (data.deviceId === deviceId) return;
    // Skip if it arrived while we still have an unflushed local push
    if (pushTimer) return;
    window.__onCloudUpdated?.(data.state);
  });
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  window.__onAuthChanged?.(user
    ? { uid: user.uid, email: user.email, name: user.displayName, photoURL: user.photoURL }
    : null);
  if (!user) {
    if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    return;
  }
  // Merge on sign-in: pull, decide, then subscribe
  try {
    const remote = await pullFromCloud();
    if (!remote || !remote.state) {
      // Fresh cloud — seed with local
      window.__onCloudMerge?.({ direction: "push", local: window.__getState?.() });
      await doCloudPush();
    } else {
      // Cloud has data — replace local
      window.__onCloudMerge?.({ direction: "pull", remote: remote.state, updatedAt: remote.clientTime });
    }
    subscribeSnapshot();
  } catch (e) {
    console.error("Sign-in merge failed:", e);
    window.__onCloudError?.(e.message || String(e));
  }
});

async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}

async function signOutOfApp() {
  await signOut(auth);
  if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
}

// Public API
window.WorkoutSync = {
  signInGoogle,
  signOut: signOutOfApp,
  scheduleCloudPush,
  forcePush: doCloudPush,
  isReady: true,
  getLastPushAt: () => lastPushAt,
  getDeviceId: () => deviceId,
};

// Let app.js know sync is available (in case it loaded first)
window.__onSyncReady?.();
