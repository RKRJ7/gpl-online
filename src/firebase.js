// ============================================================
//  GPL Online — Firebase Module
// ============================================================

import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, set, push, onValue, off,
  serverTimestamp, onDisconnect, get, update, remove, query,
  orderByChild, limitToLast,
} from 'firebase/database';
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL,
} from 'firebase/storage';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
let db  = null;
let storage = null;

export function isFirebaseConfigured() {
  return !!(
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_API_KEY !== 'your_api_key_here' &&
    import.meta.env.VITE_FIREBASE_DATABASE_URL
  );
}

export function initFirebase() {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase not configured. Set .env variables.');
    return false;
  }
  try {
    app     = initializeApp(firebaseConfig);
    db      = getDatabase(app);
    storage = getStorage(app);
    return true;
  } catch (err) {
    console.error('Firebase init error:', err);
    return false;
  }
}

// ─── Room Operations ────────────────────────────────────────

export async function createRoom(roomData) {
  if (!db) throw new Error('Firebase not initialized');
  const roomRef = ref(db, `rooms/${roomData.id}`);
  await set(roomRef, {
    id:          roomData.id,
    name:        roomData.name,
    createdAt:   serverTimestamp(),
    creatorName: roomData.creatorName,
    celebrants:  roomData.celebrants,
    totalHits:   0,
    settings:    { maxHitsPerSec: 10 },
  });
}

export async function getRoomData(roomId) {
  if (!db) throw new Error('Firebase not initialized');
  const snap = await get(ref(db, `rooms/${roomId}`));
  if (!snap.exists()) throw new Error('Room not found');
  return snap.val();
}

export function onRoomData(roomId, callback) {
  if (!db) return () => {};
  const roomRef = ref(db, `rooms/${roomId}`);
  onValue(roomRef, (snap) => {
    if (snap.exists()) callback(snap.val());
  });
  return () => off(roomRef);
}

// ─── User Presence ──────────────────────────────────────────

export async function joinRoom(roomId, userId, userName) {
  if (!db) return;
  const userRef = ref(db, `rooms/${roomId}/users/${userId}`);
  await set(userRef, {
    name:     userName,
    joinedAt: serverTimestamp(),
    hits:     0,
  });
  // Auto-remove on disconnect
  onDisconnect(userRef).remove();
}

export async function leaveRoom(roomId, userId) {
  if (!db) return;
  await remove(ref(db, `rooms/${roomId}/users/${userId}`));
}

export function onUsersChange(roomId, callback) {
  if (!db) return () => {};
  const usersRef = ref(db, `rooms/${roomId}/users`);
  onValue(usersRef, (snap) => {
    const users = {};
    snap.forEach((child) => {
      users[child.key] = child.val();
    });
    callback(users);
  });
  return () => off(usersRef);
}

// ─── Hits ────────────────────────────────────────────────────

export async function sendHit(roomId, hitData) {
  if (!db) return null;
  const hitsRef = ref(db, `rooms/${roomId}/hits`);
  const hitRef  = push(hitsRef);
  await set(hitRef, {
    ...hitData,
    timestamp: serverTimestamp(),
  });

  // Increment user hit count
  if (hitData.hitterId) {
    const userHitsRef = ref(db, `rooms/${roomId}/users/${hitData.hitterId}/hits`);
    const snap = await get(userHitsRef);
    await set(userHitsRef, (snap.val() || 0) + 1);
  }

  // Increment room total
  const totalRef = ref(db, `rooms/${roomId}/totalHits`);
  const totalSnap = await get(totalRef);
  const newTotal  = (totalSnap.val() || 0) + 1;
  await set(totalRef, newTotal);

  return hitRef.key;
}

export function onNewHits(roomId, callback) {
  if (!db) return () => {};

  // Listen to last 100 hits; only new ones trigger animation
  const hitsRef = query(
    ref(db, `rooms/${roomId}/hits`),
    orderByChild('timestamp'),
    limitToLast(100),
  );

  let initialized = false;
  let lastTimestamp = Date.now();

  onValue(hitsRef, (snap) => {
    if (!initialized) {
      initialized = true;
      // Record latest existing timestamp to ignore old hits
      snap.forEach((child) => {
        const ts = child.val().timestamp || 0;
        if (ts > lastTimestamp) lastTimestamp = ts;
      });
      return;
    }
    snap.forEach((child) => {
      const hit = child.val();
      const ts  = hit.timestamp || 0;
      if (ts > lastTimestamp) {
        lastTimestamp = ts;
        callback({ id: child.key, ...hit });
      }
    });
  });

  return () => off(hitsRef);
}

// ─── Storage ────────────────────────────────────────────────

export async function uploadPhoto(roomId, celebrantId, file) {
  if (!storage) throw new Error('Firebase Storage not initialized');
  const path  = `rooms/${roomId}/celebrants/${celebrantId}/${file.name}`;
  const sRef  = storageRef(storage, path);
  const snap  = await uploadBytes(sRef, file);
  return getDownloadURL(snap.ref);
}

// ─── Global Stats (optional, best-effort) ───────────────────

export async function incrementGlobalStats() {
  if (!db) return;
  try {
    const statsRef = ref(db, 'globalStats');
    const snap = await get(statsRef);
    const current = snap.val() || { totalSessions: 0, totalHits: 0 };
    await update(statsRef, {
      totalSessions: current.totalSessions + 1,
    });
  } catch (_) { /* Non-critical */ }
}

export async function getGlobalStats() {
  if (!db) return { totalSessions: 0, totalHits: 0 };
  try {
    const snap = await get(ref(db, 'globalStats'));
    return snap.val() || { totalSessions: 0, totalHits: 0 };
  } catch (_) {
    return { totalSessions: 0, totalHits: 0 };
  }
}
