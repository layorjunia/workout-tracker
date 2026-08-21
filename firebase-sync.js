// Firebase cloud sync — ES module SOURCE. Bundled by esbuild into
// vendor/firebase-sync.bundle.js (see `npm run build:vendor`) so the app has no
// runtime dependency on a CDN and works fully offline. Exposes window.WorkoutSync
// for app.js (a plain script).
//
// Storage model: one document per user at /users/{uid}:
//   { state: <full app state>, updatedAt: serverTimestamp, deviceId, clientTime }
//
// Sync policy:
//   • Local-first. localStorage is always written first (app.js); the cloud push
//     is debounced 2s behind it. Firestore's persistent cache queues writes made
//     while offline and flushes them on reconnect — even across app relaunches.
//   • Auth state is persisted, so an offline launch still comes up signed in.
//   • Every inbound cloud state (sign-in pull, live snapshot from another device,
//     reconnect catch-up) goes through app.js's merge (window.__onCloudMerge /
//     __onCloudUpdated) — never a blind replace — so offline edits on this
//     device and edits made elsewhere both survive.
//   • Own writes echo back through onSnapshot; they're filtered by deviceId.

import { initializeApp } from "firebase/app";
import {
  initializeAuth, signOut, onAuthStateChanged,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, browserPopupRedirectResolver,
  indexedDBLocalPersistence, browserLocalPersistence,
} from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  doc, setDoc, getDoc, getDocFromServer, onSnapshot, serverTimestamp,
  waitForPendingWrites, enableNetwork,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCgy28dqL2agj0_ns92a9GagW-nipVhxsQ",
  authDomain: "workout-tracker-9f206.firebaseapp.com",
  projectId: "workout-tracker-9f206",
  storageBucket: "workout-tracker-9f206.firebasestorage.app",
  messagingSenderId: "41963517206",
  appId: "1:41963517206:web:c06128f25e3d6234e10c37",
};

const app = initializeApp(firebaseConfig);
// initializeAuth WITHOUT a popupRedirectResolver. getAuth() would attach
// browserPopupRedirectResolver, which on an iPhone user-agent proactively loads
// the auth iframe from authDomain and awaits a handshake that never completes
// under Capacitor's capacitor://localhost origin — so signInWithEmailAndPassword
// hangs forever in the native app. Email/PIN doesn't need the resolver at all.
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});

// Persistent local cache: queued writes + cached reads survive offline periods
// and relaunches. Single-tab manager is fine (native app / one PWA tab).
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() }),
    ignoreUndefinedProperties: true,
  });
} catch (e) {
  console.warn("[sync] persistent cache unavailable, using memory cache:", e?.message || e);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
}

// Stable device ID so we can recognise our own echoes.
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
let pendingPush = false;       // a push is queued or in flight
let online = typeof navigator === "undefined" ? true : navigator.onLine !== false;
const PUSH_DEBOUNCE_MS = 2000;

function userDoc() { return doc(db, "users", currentUser.uid); }

function notifyStatus() {
  window.__onSyncStatus?.({ online, pendingPush, lastPushAt, signedIn: !!currentUser });
}

// ───────── Push ─────────
function scheduleCloudPush() {
  if (!currentUser) return;
  pendingPush = true;
  notifyStatus();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { pushTimer = null; doCloudPush(); }, PUSH_DEBOUNCE_MS);
}

async function doCloudPush() {
  if (!currentUser) return;
  const state = window.__getState?.();
  if (!state) return;
  const payload = { state, updatedAt: serverTimestamp(), deviceId, clientTime: Date.now() };
  try {
    // setDoc resolves when the write is in the local persistent queue if we're
    // offline, and when the server acks if we're online. Either way the data
    // is safe; we report "synced" only once the server has it.
    const p = setDoc(userDoc(), payload);
    if (online) {
      await p;
      lastPushAt = Date.now();
      pendingPush = false;
      window.__onCloudPushed?.();
    } else {
      p.catch(() => {});
      // Stays pendingPush=true until the reconnect flush confirms.
    }
  } catch (e) {
    console.error("[sync] push failed:", e);
    window.__onCloudError?.(e.message || String(e));
  }
  notifyStatus();
}

// After a reconnect: wait for Firestore to flush queued writes, then confirm.
async function flushAfterReconnect() {
  if (!currentUser) return;
  try {
    await enableNetwork(db).catch(() => {});
    await waitForPendingWrites(db);
    // Make sure our latest local state is what's on the server (covers the
    // case where a queued write was lost with a killed app).
    await doCloudPush();
    // And pick up anything another device wrote while we were away.
    const snap = await getDocFromServer(userDoc()).catch(() => null);
    if (snap?.exists()) {
      const data = snap.data();
      if (data.state && data.deviceId !== deviceId) window.__onCloudUpdated?.(data.state);
    }
  } catch (e) {
    console.warn("[sync] reconnect flush:", e?.message || e);
  }
}

// ───────── Pull / subscribe ─────────
async function pullFromCloud() {
  if (!currentUser) return null;
  // Try the server; fall back to the local cache when offline.
  let snap;
  try { snap = await getDocFromServer(userDoc()); }
  catch { snap = await getDoc(userDoc()).catch(() => null); }
  if (!snap || !snap.exists()) return null;
  return snap.data();
}

function subscribeSnapshot() {
  if (unsubscribeSnapshot) unsubscribeSnapshot();
  if (!currentUser) return;
  unsubscribeSnapshot = onSnapshot(userDoc(), { includeMetadataChanges: false }, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (!data.state) return;
    if (data.deviceId === deviceId) return;          // our own echo
    if (snap.metadata.hasPendingWrites) return;       // local-only, not from the server
    window.__onCloudUpdated?.(data.state);           // app.js merges, pushes only if changed
  });
}

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  window.__onAuthChanged?.(user
    ? { uid: user.uid, email: user.email, name: user.displayName, photoURL: user.photoURL }
    : null);
  notifyStatus();
  if (!user) {
    if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    return;
  }
  try {
    const remote = await pullFromCloud();
    if (!remote || !remote.state) {
      window.__onCloudMerge?.({ direction: "push", local: window.__getState?.() });
      await doCloudPush();
    } else {
      // app.js merges remote into local and pushes if the merge changed anything
      window.__onCloudMerge?.({ direction: "pull", remote: remote.state, updatedAt: remote.clientTime });
    }
    subscribeSnapshot();
  } catch (e) {
    console.error("[sync] sign-in merge failed:", e);
    window.__onCloudError?.(e.message || String(e));
  }
});

// ───────── Online / offline ─────────
window.addEventListener("online", () => { online = true; notifyStatus(); flushAfterReconnect(); });
window.addEventListener("offline", () => { online = false; notifyStatus(); });

// ───────── Auth helpers ─────────
function toAuthEmail(identifier) {
  const s = String(identifier || "").trim();
  if (s.includes("@")) return s.toLowerCase();
  const clean = s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!clean) throw new Error("Enter a name or email");
  return `${clean}@workout-tracker.local`;
}

// Firebase requires ≥6-char passwords; the user only ever types 4 digits.
const PIN_SUFFIX = ".wtapp2026";

async function signInWithPIN(identifier, pin) {
  const email = toAuthEmail(identifier);
  const rawPin = String(pin || "");
  if (!/^\d{4}$/.test(rawPin)) throw new Error("PIN must be exactly 4 digits");
  if (!online) throw new Error("You're offline — sign in needs a connection (your workouts are still saved locally).");
  const password = rawPin + PIN_SUFFIX;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return { created: false, email };
  } catch (e) {
    if (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential") {
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        return { created: true, email };
      } catch (e2) {
        if (e2.code === "auth/email-already-in-use") throw new Error("Wrong PIN for that name");
        throw e2;
      }
    }
    if (e.code === "auth/wrong-password") throw new Error("Wrong PIN");
    if (e.code === "auth/network-request-failed") throw new Error("No connection — try again when you have signal");
    throw e;
  }
}

async function signInGoogle() {
  // Web only — needs the popup resolver we deliberately don't install globally.
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider, browserPopupRedirectResolver);
}

async function signOutOfApp() {
  await signOut(auth);
  if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
}

window.WorkoutSync = {
  signInWithPIN,
  signInGoogle,
  signOut: signOutOfApp,
  scheduleCloudPush,
  forcePush: doCloudPush,
  flushAfterReconnect,
  isReady: true,
  isOnline: () => online,
  hasPendingPush: () => pendingPush,
  getLastPushAt: () => lastPushAt,
  getDeviceId: () => deviceId,
};

window.__onSyncReady?.();
notifyStatus();
