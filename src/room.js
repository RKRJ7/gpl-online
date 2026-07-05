// ============================================================
//  GPL Online — GPL Arena (Room Page) — Supabase Edition
// ============================================================

import confetti from 'canvas-confetti';
import {
  initSupabase, isSupabaseConfigured, getRoomData,
  subscribeToRoom, trackPresence, broadcastHit,
  leaveRoom as supabaseLeaveRoom, setCurrentUserId,
  incrementGlobalSessions, getRoomLeaderboard, saveUserHits
} from './supabase.js';
import { Character } from './character.js';
import { SoundSystem } from './sounds.js';
import { WEAPONS, getWeapon, getImpactText } from './weapons.js';
import {
  generateUserId, getRoomIdFromUrl, initParticlesBg,
  showFloatingText, animateWeaponHit, generateQRCode,
  copyToClipboard, avatarColor, avatarInitials, shakeScreen,
  throttle,
} from './utils.js';
import { loadFaceModels, loadImage, cropCenterFace, detectAndCropFace } from './faceProcessor.js';

// ─── Init ───────────────────────────────────────────────────

initParticlesBg();

const roomId = getRoomIdFromUrl();
if (!roomId) { window.location.href = '/'; }

let myUserId  = generateUserId();
let myName    = '';
let roomData  = null;
let channel   = null;   // Supabase realtime channel

// Character state
let characters = {};   // celebrantId → Character instance
let canvases   = {};   // celebrantId → HTMLCanvasElement
let selectedCelebrantId = null;
let currentWeaponId     = 'chapaat';

// Counters / state
let soundEnabled = true;
let rageMeter    = 0;
let hitCounts    = {};  // celebrantId → number
let userHits     = {};  // userId → { name, hits }
let myHits       = 0;
let comboTimer   = null;
let comboCount   = 0;
let isMounted    = true;

const sound = new SoundSystem();
const sendHitThrottled = throttle(sendHitBroadcast, 120);
const dbSaveHitsThrottled = throttle((userId, name, hits) => {
  if (supabaseOk) saveUserHits(roomId, userId, name, hits);
}, 2000);

// ─── Supabase init ──────────────────────────────────────────

const supabaseOk = isSupabaseConfigured() ? initSupabase() : false;
setCurrentUserId(myUserId);

// ─── Name Modal ──────────────────────────────────────────────

const nameModal = document.getElementById('name-modal');
const nameInput = document.getElementById('user-name-input');
const joinBtn   = document.getElementById('join-party-btn');

joinBtn.addEventListener('click', startJoining);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') startJoining(); });

const savedName = sessionStorage.getItem('gpl_user_name');
if (savedName) nameInput.value = savedName;

function startJoining() {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.style.animation = 'none';
    void nameInput.offsetWidth;
    nameInput.style.animation = 'shake 0.4s ease';
    return;
  }
  myName = name;
  sessionStorage.setItem('gpl_user_name', name);
  nameModal.style.display = 'none';
  initArena();
}

// ─── Mobile Sidebar Toggle ───────────────────────────────────
const sidebar        = document.querySelector('.arena-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const statsToggleBtn = document.getElementById('stats-toggle-btn');

function toggleSidebar() {
  const isOpen = sidebar.classList.contains('open');
  if (isOpen) {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  } else {
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
  }
}
statsToggleBtn?.addEventListener('click', toggleSidebar);
sidebarOverlay?.addEventListener('click', toggleSidebar);

// ─── Arena Init ──────────────────────────────────────────────

async function initArena() {
  showLoading('Loading GPL Party... 🥿', 10);

  try {
    // Load room data
    roomData = await loadRoomData();
    if (!roomData) { showError('Room not found! The link may have expired.'); return; }

    showLoading('Setting up the arena... 🎯', 35);
    document.getElementById('arena-room-name').textContent  = roomData.name;
    document.getElementById('room-name-display').textContent = `Party: ${roomData.name}`;

    showLoading('Loading face magic... 😶', 55);
    await loadFaceApiScript();
    await loadFaceModels();

    showLoading('Building characters... 🏗️', 75);
    for (let i = 0; i < roomData.celebrants.length; i++) {
      await initCharacter(roomData.celebrants[i], i);
    }

    showLoading('Loading leaderboard... 📊', 85);
    if (supabaseOk) {
      const historicHits = await getRoomLeaderboard(roomId);
      historicHits.forEach(row => {
        userHits[row.user_id] = { name: row.name, hits: row.hits };
      });
      updateLeaderboard();
    }

    showLoading('Connecting to party... 🔌', 90);

    // Supabase realtime channel
    if (supabaseOk) {
      channel = subscribeToRoom(roomId, {
        onHit(hitData) {
          // This is called for hits from OTHER users only (self: false)
          handleIncomingHit(hitData);
        },
        onUsersChange(users) {
          handleUsersUpdate(users);
        },
        onSubscribed() {
          // Track own presence once subscribed
          trackPresence(myUserId, myName);
        },
      });
    }

    showLoading('Ready! 🚀', 100);
    setTimeout(() => {
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('arena').style.display = 'block';

      // Init audio context on first interaction
      document.addEventListener('click', () => sound.init(), { once: true });
      document.addEventListener('touchstart', () => sound.init(), { once: true });

      if (roomData.celebrants.length > 0) selectCelebrant(roomData.celebrants[0].id);
      if (supabaseOk) incrementGlobalSessions().catch(() => {});
    }, 300);

  } catch (err) {
    console.error('Arena init error:', err);
    showError(`Failed to load party: ${err.message}`);
  }
}

async function loadRoomData() {
  if (supabaseOk) {
    try { return await getRoomData(roomId); } catch (_) {}
  }
  const stored = localStorage.getItem(`gpl_room_${roomId}`);
  return stored ? JSON.parse(stored) : null;
}

// ─── Character Init ──────────────────────────────────────────

async function initCharacter(celebrant, index) {
  const container = document.getElementById('characters-container');

  const slot    = document.createElement('div');
  slot.className = 'character-slot';
  slot.dataset.celebrantId = celebrant.id;
  slot.setAttribute('role', 'button');
  slot.setAttribute('tabindex', '0');
  slot.setAttribute('aria-label', `Select ${celebrant.name} as target`);

  const wrapper = document.createElement('div');
  wrapper.className = 'character-canvas-wrapper';

  const badge = document.createElement('div');
  badge.className = 'target-badge';
  badge.textContent = '🎯 TARGET LOCKED';
  wrapper.appendChild(badge);

  const canvas = document.createElement('canvas');
  canvas.className = 'character-canvas';
  canvas.width = 300; canvas.height = 260;
  wrapper.appendChild(canvas);

  const nameEl = document.createElement('div');
  nameEl.className = 'character-name';
  nameEl.textContent = celebrant.name;

  const hitEl = document.createElement('div');
  hitEl.className = 'character-hit-count';
  hitEl.id = `hit-count-${celebrant.id}`;
  hitEl.innerHTML = `<span>0</span> hits`;

  slot.appendChild(wrapper);
  slot.appendChild(nameEl);
  slot.appendChild(hitEl);
  container.appendChild(slot);

  canvases[celebrant.id]  = canvas;
  hitCounts[celebrant.id] = 0;

  // Load face
  let faceCanvas = null;
  if (celebrant.photoUrl) {
    try {
      const img = await loadImage(celebrant.photoUrl);
      faceCanvas = await detectAndCropFace(img) || cropCenterFace(img);
    } catch (_) { console.warn('Could not load face for', celebrant.name); }
  }

  characters[celebrant.id] = new Character(canvas, faceCanvas, index);

  slot.addEventListener('click', () => selectCelebrant(celebrant.id));
  slot.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') selectCelebrant(celebrant.id);
  });
}

function selectCelebrant(celebrantId) {
  selectedCelebrantId = celebrantId;
  document.querySelectorAll('.character-slot').forEach((s) => {
    s.classList.toggle('selected', s.dataset.celebrantId === celebrantId);
  });
}

// ─── Weapon Selection ────────────────────────────────────────

document.querySelectorAll('.weapon-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    currentWeaponId = btn.dataset.weapon;
    document.querySelectorAll('.weapon-btn').forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
  });
});

// ─── GPL Hit Button ──────────────────────────────────────────

const gplHitBtn = document.getElementById('gpl-hit-btn');
gplHitBtn.addEventListener('click', triggerHit);
gplHitBtn.addEventListener('touchstart', (e) => { e.preventDefault(); triggerHit(); }, { passive: false });

document.addEventListener('keydown', (e) => {
  if ((e.code === 'Space' || e.code === 'Enter') && e.target === document.body) {
    e.preventDefault();
    triggerHit();
  }
});

function triggerHit() {
  if (!selectedCelebrantId) return;

  const hitData = {
    celebrantId: selectedCelebrantId,
    weapon:      currentWeaponId,
    hitterName:  myName,
    hitterId:    myUserId,
    ts:          Date.now(),
  };

  // 1. Play locally immediately (optimistic)
  animateHit(hitData);

  // 2. Broadcast to everyone else (throttled to prevent flooding)
  sendHitThrottled(hitData);
}

async function sendHitBroadcast(hitData) {
  if (!supabaseOk || !channel) return;
  try {
    await broadcastHit(hitData);
  } catch (err) {
    console.warn('Broadcast failed:', err);
  }
}

// ─── Hit Animation ───────────────────────────────────────────

// Rate-limit per character so animation queue doesn't pile up
const lastAnimTime = {};
const MIN_ANIM_GAP = 160; // ms

function handleIncomingHit(hitData) {
  // Called only for OTHER users' hits (self already handled via animateHit)
  animateHit(hitData);
}

function animateHit(hit) {
  if (!isMounted) return;

  const charId = hit.celebrantId;
  const now    = Date.now();

  if (!lastAnimTime[charId]) lastAnimTime[charId] = 0;
  const delay = Math.max(0, lastAnimTime[charId] + MIN_ANIM_GAP - now);
  lastAnimTime[charId] = now + delay + MIN_ANIM_GAP;

  setTimeout(() => {
    if (!isMounted) return;

    const char   = characters[charId];
    const canvas = canvases[charId];
    if (!char || !canvas) return;

    const weapon = getWeapon(hit.weapon);

    // 1. Character canvas reaction
    char.hit(hit.weapon);

    // 2. Sound
    if (soundEnabled) {
      sound.init();
      sound.play(hit.weapon);
    }

    // 3. Weapon projectile animation
    const rect = canvas.getBoundingClientRect();
    const bumRect = {
      left:   rect.left + rect.width  * 0.72,
      top:    rect.top  + rect.height * 0.48,
      width:  rect.width  * 0.2,
      height: rect.height * 0.3,
    };
    animateWeaponHit(bumRect, hit.weapon, weapon.emoji, () => {
      triggerHitFlash();
      shakeScreen(weapon.power * 0.3);
    });

    // 4. Scream + impact text bubbles
    showFloatingText(canvas, getRandomScream());
    setTimeout(() => showFloatingText(canvas, getImpactText(hit.weapon)), 80);

    // 5. Counters
    updateCounters(hit);

    // 6. Hit feed
    addFeedEntry(hit, weapon);

    // 7. Combo
    handleCombo();

    // 8. Rage meter
    updateRageMeter();

  }, delay);
}

function updateCounters(hit) {
  hitCounts[hit.celebrantId] = (hitCounts[hit.celebrantId] || 0) + 1;

  const el = document.getElementById(`hit-count-${hit.celebrantId}`);
  if (el) el.innerHTML = `<span>${hitCounts[hit.celebrantId]}</span> hits`;

  if (hit.hitterName) {
    if (!userHits[hit.hitterId]) userHits[hit.hitterId] = { name: hit.hitterName, hits: 0 };
    userHits[hit.hitterId].hits++;
    if (hit.hitterId === myUserId) {
      myHits++;
      dbSaveHitsThrottled(myUserId, myName, myHits);
    }
    updateLeaderboard();
  }
}

// ─── Rage Meter ──────────────────────────────────────────────

function updateRageMeter() {
  rageMeter = Math.min(100, rageMeter + 2);
  const fill = document.getElementById('rage-meter-fill');
  const pct  = document.getElementById('rage-percent');
  if (fill) fill.style.width  = `${rageMeter}%`;
  if (pct)  pct.textContent   = `${Math.round(rageMeter)}%`;
  document.getElementById('rage-meter-container')?.setAttribute('aria-valuenow', rageMeter);

  if (rageMeter >= 100) {
    triggerRageExplosion();
    rageMeter = 0;
    setTimeout(() => {
      if (fill) fill.style.width = '0%';
      if (pct)  pct.textContent  = '0%';
    }, 2200);
  }
}

function triggerRageExplosion() {
  const rageEl = document.getElementById('rage-explosion');
  rageEl?.classList.add('exploding');
  setTimeout(() => rageEl?.classList.remove('exploding'), 2000);

  confetti({ particleCount: 220, spread: 110, origin: { y: 0.5 }, colors: ['#FF6B00','#EC4899','#7C3AED','#F59E0B','#22C55E'] });
  if (soundEnabled) sound.playCelebration();
  showComboText('🔥 GPL OVERDRIVE!! 🔥', 'rage');
}

// ─── Combo ───────────────────────────────────────────────────

function handleCombo() {
  comboCount++;
  clearTimeout(comboTimer);
  if (comboCount >= 5) {
    const tier = Math.floor(comboCount / 5);
    const msgs = ['COMBO x5! 🔥','MEGA GPL! 💥','ULTRA GPL! ⚡','GODLIKE GPL! 🌟','GPL DESTROYER!! 💫'];
    showComboText(msgs[Math.min(tier - 1, msgs.length - 1)], 'combo');
    if (soundEnabled) sound.playCombo(tier);
  }
  comboTimer = setTimeout(() => { comboCount = 0; }, 1500);
}

function showComboText(text, type) {
  const el = document.getElementById('combo-overlay');
  if (!el) return;
  el.textContent = text;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  el.style.color    = type === 'rage' ? '#FF6B00' : '#FFD700';
  el.style.fontSize = type === 'rage' ? 'clamp(2rem,7vw,5rem)' : 'clamp(1.8rem,5vw,3.5rem)';
  setTimeout(() => el.classList.remove('show'), 900);
}

// ─── Hit Flash ───────────────────────────────────────────────

function triggerHitFlash() {
  const el = document.getElementById('hit-flash');
  if (!el) return;
  el.classList.remove('active');
  void el.offsetWidth;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 350);
}

// ─── Users / Presence ────────────────────────────────────────

function handleUsersUpdate(users) {
  const list    = document.getElementById('users-list');
  const countEl = document.getElementById('online-count');
  if (!list) return;

  // Always include self (may not be in presence yet)
  if (!users[myUserId]) users[myUserId] = { name: myName, hits: 0 };

  const entries = Object.entries(users);
  if (countEl) countEl.textContent = `${entries.length} online`;

  list.innerHTML = entries.map(([uid, u]) => `
    <div class="user-item">
      <div class="user-avatar" style="background:${avatarColor(u.name)}">${avatarInitials(u.name)}</div>
      <span>${u.name}${uid === myUserId ? ' (you)' : ''}</span>
    </div>
  `).join('');

  // Sync local hit counts from presence
  entries.forEach(([uid, u]) => {
    if (!userHits[uid]) userHits[uid] = { name: u.name, hits: u.hits || 0 };
  });
  updateLeaderboard();
}

function updateLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  if (!list) return;

  const sorted  = Object.entries(userHits).sort((a, b) => b[1].hits - a[1].hits).slice(0, 5);
  const medals  = ['🥇','🥈','🥉','4️⃣','5️⃣'];

  list.innerHTML = sorted.length
    ? sorted.map(([uid, u], i) => `
        <div class="leaderboard-item">
          <span class="lb-rank">${medals[i]}</span>
          <span class="lb-name">${u.name}${uid === myUserId ? ' ★' : ''}</span>
          <span class="lb-hits">${u.hits}</span>
        </div>
      `).join('')
    : '<p style="font-size:.75rem;color:var(--color-text-muted)">No hits yet... start GPL!</p>';
}

// ─── Hit Feed ────────────────────────────────────────────────

function addFeedEntry(hit, weapon) {
  const feed = document.getElementById('hit-feed');
  if (!feed) return;

  const targetName = roomData?.celebrants.find((c) => c.id === hit.celebrantId)?.name || '?';
  const el = document.createElement('div');
  el.className = 'feed-item';
  el.innerHTML = `
    <span class="hitter">${hit.hitterName || 'Someone'}</span>
    hit <span class="target">${targetName}</span>
    with <span class="weapon">${weapon.emoji} ${weapon.name}</span>!
  `;
  feed.insertBefore(el, feed.firstChild);
  while (feed.children.length > 30) feed.removeChild(feed.lastChild);
}

// ─── Screams ─────────────────────────────────────────────────

const SCREAMS = [
  'HAI MERI MAA! 😭','BACHAO! 🙏','NAHI NAHI NAHI!','AAAAAH! 😱',
  'CHHODO MUJHE! 🥺','YE KYA HAI!','DARD! 😭','MAAFI! 🙏',
  'BAS KAR! 😤','OUCH OUCH!','PLEEEEASE! 😭','KASAM SE!',
];
const getRandomScream = () => SCREAMS[Math.floor(Math.random() * SCREAMS.length)];

// ─── Sound Toggle ────────────────────────────────────────────

document.getElementById('sound-toggle-btn')?.addEventListener('click', () => {
  soundEnabled = sound.toggle();
  document.getElementById('sound-toggle-btn').textContent = soundEnabled ? '🔊' : '🔇';
});

// ─── Share Modal ─────────────────────────────────────────────

const shareModal        = document.getElementById('share-modal');
const closeShareModal   = document.getElementById('close-share-modal');
const shareModalCopyBtn = document.getElementById('share-modal-copy-btn');
const shareModalLink    = document.getElementById('share-modal-link');
const shareQrCode       = document.getElementById('share-qr-code');

document.getElementById('share-btn')?.addEventListener('click', () => {
  const url = window.location.href;
  shareModalLink.value = url;
  shareModal.style.display = 'flex';
  generateQRCode(shareQrCode, url);
});
closeShareModal?.addEventListener('click', () => shareModal.style.display = 'none');
shareModal?.addEventListener('click', (e) => { if (e.target === shareModal) shareModal.style.display = 'none'; });
shareModalCopyBtn?.addEventListener('click', () => copyToClipboard(shareModalLink.value, shareModalCopyBtn));

// ─── Loading / Error ─────────────────────────────────────────

function showLoading(text, progress) {
  document.getElementById('loading-screen').style.display = 'flex';
  const t = document.getElementById('loading-text');
  const b = document.getElementById('loading-bar-fill');
  if (t) t.textContent = text;
  if (b) b.style.width = `${progress}%`;
}

function showError(message) {
  document.getElementById('loading-screen').style.display = 'none';
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem;gap:1rem;background:var(--color-bg)';
  d.innerHTML = `<div style="font-size:4rem">😕</div><h2 style="font-family:'Fredoka One',sans-serif;font-size:1.8rem">${message}</h2><a href="/" class="btn btn-primary" style="margin-top:1rem">Go Home →</a>`;
  document.body.appendChild(d);
}

// ─── Cleanup ─────────────────────────────────────────────────

window.addEventListener('beforeunload', () => {
  isMounted = false;
  supabaseLeaveRoom();
});

// ─── face-api.js Loader ──────────────────────────────────────

function loadFaceApiScript() {
  return new Promise((resolve) => {
    if (typeof faceapi !== 'undefined') { resolve(); return; }
    const s = document.createElement('script');
    s.src     = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    s.onload  = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
}

// ─── Extra styles ────────────────────────────────────────────

const s = document.createElement('style');
s.textContent = `
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
  @keyframes screenShake { 0%,100%{transform:translate(0,0)} 20%{transform:translate(var(--shake-intensity,5px),-3px)} 40%{transform:translate(calc(-1*var(--shake-intensity,5px)),3px)} 60%{transform:translate(3px,var(--shake-intensity,5px))} 80%{transform:translate(-3px,-2px)} }
`;
document.head.appendChild(s);
