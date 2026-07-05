// ============================================================
//  GPL Online — Supabase Module
//  Replaces firebase.js — same API surface where possible
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

// ─── Config Check ───────────────────────────────────────────

export function isSupabaseConfigured() {
  return !!(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'your_supabase_url_here'
  );
}

export function initSupabase() {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
    return false;
  }
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: { eventsPerSecond: 20 }, // allow rapid hits
      },
    });
    return true;
  } catch (err) {
    console.error('Supabase init error:', err);
    return false;
  }
}

export function getClient() {
  return supabase;
}

// ─── Room Operations ────────────────────────────────────────

export async function createRoom(roomData) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase.from('rooms').insert({
    id:           roomData.id,
    name:         roomData.name,
    creator_name: roomData.creatorName,
    celebrants:   roomData.celebrants,
  });

  if (error) throw new Error(error.message);
}

// ─── Persistent Leaderboard ─────────────────────────────────

export async function getRoomLeaderboard(roomId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('room_hits')
    .select('user_id, name, hits')
    .eq('room_id', roomId)
    .order('hits', { ascending: false });
  if (error) { console.warn('Leaderboard fetch error:', error); return []; }
  return data || [];
}

export async function saveUserHits(roomId, userId, name, hits) {
  if (!supabase) return;
  // Upsert the new hit count for this user in this room
  const { error } = await supabase
    .from('room_hits')
    .upsert({
      room_id: roomId,
      user_id: userId,
      name: name,
      hits: hits,
      updated_at: new Date().toISOString()
    }, { onConflict: 'room_id, user_id' });
  if (error) console.warn('Failed to save hits:', error);
}

export async function getRoomData(roomId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error || !data) throw new Error('Room not found');

  return {
    id:          data.id,
    name:        data.name,
    creatorName: data.creator_name,
    celebrants:  data.celebrants,
    createdAt:   data.created_at,
  };
}

// ─── Photo Storage ──────────────────────────────────────────

export async function uploadPhoto(roomId, celebrantId, file) {
  if (!supabase) throw new Error('Supabase not initialized');

  const ext  = file.name.split('.').pop().toLowerCase() || 'jpg';
  const path = `rooms/${roomId}/${celebrantId}.${ext}`;

  const { error } = await supabase.storage
    .from('celebrant-photos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from('celebrant-photos')
    .getPublicUrl(path);

  return data.publicUrl;
}

// ─── Realtime Channel ────────────────────────────────────────
//
//  Supabase Realtime has two powerful primitives we use:
//  1. Broadcast  — fire-and-forget messages (hits). NOT stored in DB.
//                  Ultra-low latency, perfect for rapid hits.
//  2. Presence   — tracks who is currently online in the channel.
//
// ─────────────────────────────────────────────────────────────

let _channel = null;

/**
 * Creates and subscribes to the room's realtime channel.
 * @param {string} roomId
 * @param {object} handlers
 *   - onHit(hitData)         — called when any OTHER user sends a hit
 *   - onUsersChange(users)   — called when presence changes
 *   - onSubscribed()         — called when channel is ready
 * @returns {RealtimeChannel}
 */
export function subscribeToRoom(roomId, { onHit, onUsersChange, onSubscribed }) {
  if (!supabase) return null;

  // Clean up previous channel if any
  if (_channel) {
    supabase.removeChannel(_channel);
    _channel = null;
  }

  _channel = supabase.channel(`room:${roomId}`, {
    config: {
      broadcast: { self: false }, // don't echo back our own broadcasts
      presence:  { key: ''     },
    },
  });

  // Listen for incoming hits from OTHER users
  _channel.on('broadcast', { event: 'hit' }, ({ payload }) => {
    if (onHit && payload) onHit(payload);
  });

  // Listen for presence (online users) — syncs on any join/leave
  _channel.on('presence', { event: 'sync' }, () => {
    if (onUsersChange) {
      const raw   = _channel.presenceState();
      // Flatten: { key: [{userId, name, ...}] } → { userId: {name, ...} }
      const users = {};
      Object.values(raw).forEach((arr) => {
        arr.forEach((u) => {
          if (u.userId) users[u.userId] = { name: u.name, hits: u.hits || 0 };
        });
      });
      onUsersChange(users);
    }
  });

  // Subscribe
  _channel.subscribe((status) => {
    if (status === 'SUBSCRIBED' && onSubscribed) onSubscribed();
  });

  return _channel;
}

/**
 * Track this user's presence (shows them as "online").
 * Call after channel is subscribed.
 */
export async function trackPresence(userId, name) {
  if (!_channel) return;
  await _channel.track({ userId, name, hits: 0, joinedAt: Date.now() });
}

/**
 * Update this user's hit count in presence state.
 */
export async function updatePresenceHits(currentHits) {
  if (!_channel) return;
  // re-track updates presence payload
  const state = _channel.presenceState();
  const myKey = Object.keys(state).find((k) =>
    state[k].some((u) => u.userId === _currentUserId)
  );
  if (myKey) {
    const me = state[myKey][0];
    await _channel.track({ ...me, hits: currentHits });
  }
}

let _currentUserId = null;
export function setCurrentUserId(id) { _currentUserId = id; }

/**
 * Broadcast a hit to all other users in the room.
 */
export async function broadcastHit(hitData) {
  if (!_channel) return;
  await _channel.send({
    type:    'broadcast',
    event:   'hit',
    payload: hitData,
  });
}

/**
 * Leave the channel cleanly.
 */
export async function leaveRoom() {
  if (_channel && supabase) {
    await _channel.untrack();
    await supabase.removeChannel(_channel);
    _channel = null;
  }
}

// ─── Global Stats ────────────────────────────────────────────

export async function getGlobalStats() {
  if (!supabase) return { totalSessions: 0, totalHits: 0 };
  try {
    const { data } = await supabase
      .from('global_stats')
      .select('*')
      .eq('id', 1)
      .single();
    return data || { total_sessions: 0, total_hits: 0 };
  } catch (_) {
    return { total_sessions: 0, total_hits: 0 };
  }
}

export async function incrementGlobalSessions() {
  if (!supabase) return;
  try {
    await supabase.rpc('increment_sessions');
  } catch (_) { /* non-critical */ }
}
