// ============================================================
//  GPL Online — Landing Page
// ============================================================

import { initParticlesBg } from './utils.js';
import { initSupabase, isSupabaseConfigured, getGlobalStats, cleanupExpiredRooms } from './supabase.js';

initParticlesBg();

// Load optional global stats
document.addEventListener('DOMContentLoaded', async () => {
  if (isSupabaseConfigured()) {
    initSupabase();
    cleanupExpiredRooms();
    getGlobalStats().then((stats) => {
      const s = document.getElementById('live-sessions');
      const h = document.getElementById('total-hits');
      if (s) s.textContent = stats.total_sessions ?? '🔥';
      if (h) h.textContent = formatNumber(stats.total_hits ?? 0);
    }).catch(() => {});
  } else {
    const s = document.getElementById('live-sessions');
    const h = document.getElementById('total-hits');
    if (s) s.textContent = '🔥';
    if (h) h.textContent = '∞';
  }
});
// Smooth scroll to how-it-works
document.getElementById('btn-learn-more')?.addEventListener('click', () => {
  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
});

function formatNumber(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M+`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K+`;
  return String(n);
}

// Scroll-triggered animations
const observer = new IntersectionObserver(
  (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.style.animationPlayState = 'running'; observer.unobserve(e.target); } }),
  { threshold: 0.1 },
);
document.querySelectorAll('.step-card, .weapon-card').forEach((el) => {
  el.style.animationPlayState = 'paused';
  observer.observe(el);
});
