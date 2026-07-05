// ============================================================
//  GPL Online — Utility Functions
// ============================================================

import { nanoid } from 'nanoid';

// ─── Room ID ────────────────────────────────────────────────

export function generateRoomId() {
  return nanoid(10);
}

export function generateUserId() {
  // Try to persist across page reloads
  let id = sessionStorage.getItem('gpl_user_id');
  if (!id) {
    id = nanoid(12);
    sessionStorage.setItem('gpl_user_id', id);
  }
  return id;
}

export function generateCelebrantId() {
  return nanoid(8);
}

// ─── URL Helpers ────────────────────────────────────────────

export function getRoomUrl(roomId) {
  const base = window.location.origin;
  return `${base}/room.html?id=${roomId}`;
}

export function getRoomIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

// ─── Floating Text Bubble ───────────────────────────────────

const COLORS = ['#FF6B00', '#EC4899', '#F59E0B', '#22C55E', '#7C3AED', '#3B82F6'];

/**
 * Shows a floating text bubble near an element.
 * @param {HTMLElement} anchorEl - element to anchor near
 * @param {string} text
 */
export function showFloatingText(anchorEl, text) {
  const rect  = anchorEl.getBoundingClientRect();
  const el    = document.createElement('div');
  el.className = 'floating-text';
  el.textContent = text;

  const x = rect.left + rect.width  / 2 + (Math.random() - 0.5) * 60;
  const y = rect.top  + rect.height * 0.3 + (Math.random() - 0.5) * 30;

  el.style.left  = `${x}px`;
  el.style.top   = `${y}px`;
  el.style.color = COLORS[Math.floor(Math.random() * COLORS.length)];
  el.style.fontSize = `${1.2 + Math.random() * 0.6}rem`;
  el.style.transform = `rotate(${(Math.random() - 0.5) * 20}deg)`;
  el.style.position  = 'fixed';
  el.style.zIndex    = '500';
  el.style.pointerEvents = 'none';
  el.style.fontFamily    = "'Fredoka One', sans-serif";
  el.style.fontWeight    = '900';
  el.style.textShadow    = '0 2px 8px rgba(0,0,0,0.6), 0 0 20px currentColor';
  el.style.animation     = 'floatUp 1.5s ease-out forwards';

  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

// ─── Impact Effect ──────────────────────────────────────────

const IMPACT_EMOJIS_BY_WEAPON = {
  chapaat: ['💥', '✋', '😤'],
  chappal: ['⭐', '🌟', '💫'],
  belt:    ['⚡', '💥', '🔥'],
  bat:     ['💥', '🏏', '🌟'],
  hammer:  ['💫', '💥', '🔥'],
  boot:    ['💢', '👟', '💥'],
};

export function spawnImpactEffect(x, y, weaponId) {
  const emojis = IMPACT_EMOJIS_BY_WEAPON[weaponId] || ['💥'];
  const emoji  = emojis[Math.floor(Math.random() * emojis.length)];
  const el     = document.createElement('div');
  el.className    = 'impact-effect';
  el.textContent  = emoji;
  el.style.left   = `${x - 16}px`;
  el.style.top    = `${y - 16}px`;
  el.style.fontSize = '2rem';
  el.style.position = 'fixed';
  el.style.zIndex   = '400';
  el.style.pointerEvents = 'none';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 600);
}

// ─── Weapon Projectile Animation ────────────────────────────

const ANIM_MAP = {
  chapaat: { anim: 'weapon-slap',  dur: 350 },
  chappal: { anim: 'weapon-flip',  dur: 450 },
  belt:    { anim: 'weapon-whip',  dur: 300 },
  bat:     { anim: 'weapon-swing', dur: 400 },
  hammer:  { anim: 'weapon-slam',  dur: 500 },
  boot:    { anim: 'weapon-kick',  dur: 380 },
};

/**
 * Animates weapon flying toward bum area of character.
 * @param {DOMRect} bumRect - bounding rect of bum target area
 * @param {string} weaponId
 * @param {string} weaponEmoji
 * @param {Function} onImpact - called at impact moment
 */
export function animateWeaponHit(bumRect, weaponId, weaponEmoji, onImpact) {
  const layer  = document.getElementById('weapon-anim-layer');
  if (!layer) return;

  const info = ANIM_MAP[weaponId] || ANIM_MAP.chapaat;
  const el   = document.createElement('div');
  el.className   = `weapon-projectile`;
  el.textContent = weaponEmoji;

  // Position near bum target
  el.style.left = `${bumRect.left + bumRect.width / 2 - 20}px`;
  el.style.top  = `${bumRect.top  + bumRect.height / 2 - 20}px`;

  layer.appendChild(el);

  // Apply animation
  el.style.animation = `${info.anim} ${info.dur}ms ease-out forwards`;

  // Impact callback at ~55% of duration
  const impactTime = info.dur * 0.52;
  setTimeout(() => {
    if (onImpact) onImpact();
    spawnImpactEffect(bumRect.left + bumRect.width / 2, bumRect.top + bumRect.height / 2, weaponId);
  }, impactTime);

  // Remove after animation
  setTimeout(() => el.remove(), info.dur + 50);
}

// ─── Screen Shake ───────────────────────────────────────────

export function shakeScreen(intensity = 1) {
  const el = document.getElementById('arena');
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetWidth; // reflow
  el.style.setProperty('--shake-intensity', `${6 * intensity}px`);
  el.style.animation = `screenShake 0.35s ease`;
}

// ─── QR Code ────────────────────────────────────────────────

export async function generateQRCode(containerEl, url) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.1/qrcode.min.js');
  
  // Wait up to 1 second for QRCode to be attached to window
  for (let i = 0; i < 10; i++) {
    if (typeof QRCode !== 'undefined') break;
    await new Promise(r => setTimeout(r, 100));
  }
  
  if (typeof QRCode === 'undefined') {
    console.error('QRCode failed to load');
    return;
  }

  containerEl.innerHTML = '';

  // toDataURL is more reliable cross-browser than toCanvas
  QRCode.toDataURL(
    url,
    { width: 148, margin: 1, color: { dark: '#000000', light: '#ffffff' } },
    (err, dataUrl) => {
      if (err) { console.warn('QR generation error:', err); return; }
      const img       = document.createElement('img');
      img.src         = dataUrl;
      img.width       = 148;
      img.height      = 148;
      img.alt         = 'QR Code for room link';
      img.style.cssText = 'border-radius:8px;display:block;';
      containerEl.appendChild(img);
    },
  );
}

const scriptPromises = {};
function loadScript(src) {
  if (scriptPromises[src]) return scriptPromises[src];
  const promise = new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      // Already injected (maybe manually in HTML)
      resolve(); return;
    }
    const s   = document.createElement('script');
    s.src     = src;
    s.onload  = resolve;
    s.onerror = resolve;
    document.head.appendChild(s);
  });
  scriptPromises[src] = promise;
  return promise;
}

// ─── Copy to Clipboard ──────────────────────────────────────

export async function copyToClipboard(text, btnEl) {
  try {
    await navigator.clipboard.writeText(text);
    if (btnEl) {
      const original = btnEl.textContent;
      btnEl.textContent = '✅ Copied!';
      setTimeout(() => { btnEl.textContent = original; }, 2000);
    }
    return true;
  } catch (_) {
    return false;
  }
}

// ─── Particle Background ────────────────────────────────────

export function initParticlesBg(containerId = 'particles-bg') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const EMOJIS = ['🎉', '🎊', '🥳', '⭐', '🌟', '✨', '🎈', '🎂', '🥿', '🏏', '💥'];
  const COUNT  = 18;

  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('span');
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    el.style.cssText = `
      position: absolute;
      font-size: ${Math.random() * 1.5 + 0.8}rem;
      opacity: ${Math.random() * 0.08 + 0.03};
      left: ${Math.random() * 100}%;
      top:  ${Math.random() * 100}%;
      animation: floatParticle ${6 + Math.random() * 10}s ease-in-out infinite;
      animation-delay: ${-Math.random() * 10}s;
      user-select: none;
      pointer-events: none;
    `;
    container.appendChild(el);
  }

  // Add CSS if not present
  if (!document.getElementById('particle-style')) {
    const style = document.createElement('style');
    style.id    = 'particle-style';
    style.textContent = `
      @keyframes floatParticle {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        33%  { transform: translateY(-30px) rotate(10deg); }
        66%  { transform: translateY(20px) rotate(-5deg); }
      }
      @keyframes screenShake {
        0%, 100% { transform: translate(0, 0); }
        20%  { transform: translate(var(--shake-intensity, 5px), -3px); }
        40%  { transform: translate(-var(--shake-intensity, 5px), 3px); }
        60%  { transform: translate(3px, var(--shake-intensity, 5px)); }
        80%  { transform: translate(-3px, -2px); }
      }
    `;
    document.head.appendChild(style);
  }
}

// ─── Avatar Color from Name ─────────────────────────────────

const AVATAR_COLORS = ['#7C3AED','#EC4899','#F59E0B','#22C55E','#3B82F6','#EF4444','#0891B2'];

export function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function avatarInitials(name) {
  return name.trim().substring(0, 2).toUpperCase();
}

// ─── Debounce ───────────────────────────────────────────────

export function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ─── Throttle ───────────────────────────────────────────────

export function throttle(fn, ms) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall < ms) return;
    lastCall = now;
    return fn(...args);
  };
}
