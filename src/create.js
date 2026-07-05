// ============================================================
//  GPL Online — Create Room Page
// ============================================================

import {
  initSupabase, isSupabaseConfigured, createRoom, uploadPhoto,
} from './supabase.js';
import { loadFaceModels, detectAndCropFace, cropCenterFace } from './faceProcessor.js';
import {
  generateRoomId, generateCelebrantId, getRoomUrl,
  initParticlesBg, generateQRCode, copyToClipboard,
} from './utils.js';

// ─── Init ───────────────────────────────────────────────────

initParticlesBg();

const supabaseOk = isSupabaseConfigured() ? initSupabase() : false;

if (!supabaseOk) {
  document.getElementById('firebase-warning').style.display = 'block';
}

// Load face-api.js CDN then models (non-blocking)
loadFaceApiScript().then(() => {
  loadFaceModels((msg) => console.log('[FaceAPI]', msg));
});

// ─── State ──────────────────────────────────────────────────

let celebrantCount = 0;

// ─── Add first celebrant card on load ───────────────────────

addCelebrant();

// ─── Buttons ────────────────────────────────────────────────

document.getElementById('add-celebrant-btn').addEventListener('click', () => {
  if (celebrantCount >= 4) { showToast('Maximum 4 celebrants per party!', 'warn'); return; }
  addCelebrant();
});

document.getElementById('create-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await handleCreate();
});

// ─── Celebrant Card Factory ──────────────────────────────────

function addCelebrant() {
  const template = document.getElementById('celebrant-template');
  const clone    = template.content.cloneNode(true);
  const card     = clone.querySelector('.celebrant-card');
  const id       = generateCelebrantId();

  card.dataset.celebrantId = id;
  document.getElementById('celebrants-list').appendChild(clone);
  celebrantCount++;

  const addedCard = document.querySelector(`[data-celebrant-id="${id}"]`);
  wireUpCelebrantCard(addedCard);
}

function wireUpCelebrantCard(card) {
  const uploadZone  = card.querySelector('.photo-upload-zone');
  const fileInput   = card.querySelector('.photo-file-input');
  const preview     = card.querySelector('.photo-preview');
  const placeholder = card.querySelector('.photo-placeholder');
  const statusEl    = card.querySelector('.face-detection-status');
  const removeBtn   = card.querySelector('.remove-celebrant-btn');

  removeBtn.addEventListener('click', () => {
    if (celebrantCount <= 1) { showToast('Need at least 1 celebrant!', 'warn'); return; }
    card.style.animation = 'fadeOut 0.2s ease forwards';
    setTimeout(() => { card.remove(); celebrantCount--; }, 200);
  });

  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });

  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFileSelect(file, card, preview, placeholder, statusEl);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFileSelect(file, card, preview, placeholder, statusEl);
  });
}

async function handleFileSelect(file, card, preview, placeholder, statusEl) {
  const objectUrl = URL.createObjectURL(file);
  preview.src = objectUrl;
  preview.style.display = 'block';
  placeholder.style.display = 'none';
  card.querySelector('.photo-upload-zone').classList.add('has-photo');
  card._file = file;

  statusEl.innerHTML = `<span class="face-status-detecting"><span class="face-status-icon"></span> Detecting face...</span>`;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = objectUrl;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

    const faceCropCanvas = await detectAndCropFace(img);
    if (faceCropCanvas) {
      statusEl.innerHTML = `<span class="face-status-found">✅ Face detected! Your face will appear on the character 😄</span>`;
      card._faceCanvas   = faceCropCanvas;
      showFaceOverlay(preview.parentElement, faceCropCanvas);
    } else {
      statusEl.innerHTML = `<span class="face-status-not-found">⚠️ Face not clearly detected. Using full image. Try a clear front-facing photo!</span>`;
      card._faceCanvas   = cropCenterFace(img);
    }
  } catch (_) {
    statusEl.innerHTML = `<span class="face-status-not-found">⚠️ Could not process image. Will use full photo.</span>`;
  }
}

function showFaceOverlay(parentEl, faceCanvas) {
  parentEl.querySelector('.face-mini-preview')?.remove();
  const mini = document.createElement('canvas');
  mini.width = 48; mini.height = 48;
  mini.className = 'face-mini-preview';
  mini.style.cssText = `
    position:absolute;bottom:6px;right:6px;width:48px;height:48px;
    border-radius:50%;border:2px solid #22C55E;box-shadow:0 2px 8px rgba(0,0,0,0.5);
  `;
  const ctx = mini.getContext('2d');
  ctx.save();
  ctx.beginPath();
  ctx.arc(24, 24, 24, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(faceCanvas, 0, 0, 48, 48);
  ctx.restore();
  parentEl.appendChild(mini);
}

// ─── Create Room ─────────────────────────────────────────────

async function handleCreate() {
  const roomName    = document.getElementById('room-name').value.trim();
  const creatorName = document.getElementById('creator-name').value.trim();

  if (!roomName)    { showToast('Please give your party a name!', 'error'); return; }
  if (!creatorName) { showToast('Please enter your name!', 'error'); return; }

  const cards = [...document.querySelectorAll('.celebrant-card')];
  const celebrants = [];

  for (const card of cards) {
    const name = card.querySelector('.celebrant-name-input').value.trim();
    if (!name) { showToast('Please enter a name for each person!', 'error'); return; }
    celebrants.push({ id: card.dataset.celebrantId, name, file: card._file || null, photoUrl: null });
  }

  if (!celebrants.length) { showToast('Add at least one celebrant!', 'error'); return; }

  // Spinner on
  const btn        = document.getElementById('create-btn');
  const btnText    = document.getElementById('create-btn-text');
  const btnSpinner = document.getElementById('create-btn-spinner');
  btn.disabled             = true;
  btnText.style.display    = 'none';
  btnSpinner.style.display = 'block';

  try {
    const roomId = generateRoomId();

    // Upload photos
    for (const c of celebrants) {
      if (c.file) {
        try {
          if (supabaseOk) {
            btnText.textContent   = `Uploading ${c.name}'s photo...`;
            btnText.style.display = 'block';
            c.photoUrl = await uploadPhoto(roomId, c.id, c.file);
          } else {
            c.photoUrl = await fileToDataUrl(c.file);
          }
        } catch (err) {
          console.warn('Photo upload failed, using base64:', err);
          c.photoUrl = await fileToDataUrl(c.file);
        }
      }
    }

    const roomData = {
      id:          roomId,
      name:        roomName,
      creatorName,
      celebrants:  celebrants.map((c) => ({ id: c.id, name: c.name, photoUrl: c.photoUrl || '' })),
    };

    if (supabaseOk) {
      await createRoom(roomData);
    } else {
      localStorage.setItem(`gpl_room_${roomId}`, JSON.stringify(roomData));
    }

    showSuccessModal(roomId);

  } catch (err) {
    console.error('Create room error:', err);
    showToast(`Failed to create room: ${err.message}`, 'error');
  } finally {
    btn.disabled             = false;
    btnText.textContent      = '🚀 Create GPL Party!';
    btnText.style.display    = 'block';
    btnSpinner.style.display = 'none';
  }
}

// ─── Success Modal ───────────────────────────────────────────

function showSuccessModal(roomId) {
  const modal         = document.getElementById('success-modal');
  const linkInput     = document.getElementById('share-link-input');
  const joinBtn       = document.getElementById('join-party-btn');
  const copyBtn       = document.getElementById('copy-link-btn');
  const qrContainer   = document.getElementById('qr-code');
  const url           = getRoomUrl(roomId);

  linkInput.value  = url;
  joinBtn.href     = url;
  modal.style.display = 'flex';

  generateQRCode(qrContainer, url);
  copyBtn.addEventListener('click', () => copyToClipboard(url, copyBtn));
  linkInput.addEventListener('click', () => linkInput.select());
}

// ─── Helpers ─────────────────────────────────────────────────

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

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

function showToast(message, type = 'info') {
  document.querySelector('.gpl-toast')?.remove();
  const colors = { info: '#7C3AED', error: '#EF4444', warn: '#F59E0B', success: '#22C55E' };
  const toast  = document.createElement('div');
  toast.className = 'gpl-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:${colors[type]};color:#fff;padding:12px 24px;
    border-radius:50px;font-weight:600;font-size:0.9rem;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:9999;
    animation:slideUp 0.3s ease;white-space:nowrap;font-family:'Poppins',sans-serif;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Styles for remove animation + drag-over
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeOut { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(0.95)} }
  .photo-upload-zone.drag-over { border-color:#7C3AED; background:rgba(124,58,237,0.1); }
`;
document.head.appendChild(style);
