// ============================================================
//  GPL Online — Character Renderer (Canvas 2D) — v2
//  GPL Pose: Side profile, person bent 90° at waist.
//  Anatomy: Head left (hanging), torso horizontal, BUM sticking UP, legs down.
// ============================================================

export const EXPR = {
  NEUTRAL: 'neutral',
  SHOCKED: 'shocked',
  PAIN:    'pain',
  CRYING:  'crying',
};

// Per-celebrant shirt colours
const SHIRT_COLORS  = ['#4F46E5','#0891B2','#D97706','#9333EA','#DC2626','#0D9488','#EA580C','#0284C7'];
const PANTS_COLORS  = ['#1E293B','#1F2937','#111827','#27272A'];
const SKIN_COLOR    = '#FDBCB4';

export class Character {
  constructor(canvas, faceCanvas, colorIndex = 0) {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext('2d');
    this.faceCanvas = faceCanvas;
    this.shirtColor = SHIRT_COLORS[colorIndex % SHIRT_COLORS.length];
    this.pantsColor = PANTS_COLORS[colorIndex % PANTS_COLORS.length];

    this.state = {
      // Spring jolt (body sways from hit)
      springX: 0, springVx: 0,
      springY: 0, springVy: 0,
      // Head shake
      headAngle: 0, headAngleV: 0,
      // Expression
      expression:  EXPR.NEUTRAL,
      exprQueue:   [],
      // Hit effects
      bumFlash:    0,
      stars:       [],
      particles:   [],
      tears:       [],
    };

    this._raf      = null;
    this._lastTime = 0;
    this._startLoop();
  }

  setFaceCanvas(fc) { this.faceCanvas = fc; }

  // ── Public: trigger a hit ──────────────────────────────────

  hit(weaponId) {
    const power = { chapaat:1, chappal:2, belt:3, bat:4, hammer:5, boot:3 }[weaponId] ?? 1;

    // Jolt away from bum side (to the left and slightly down)
    this.state.springX  = -12 * power;
    this.state.springVx = -6  * power;
    this.state.springY  = 4  * power;
    this.state.springVy = 2  * power;

    // Head shake
    this.state.headAngle  = 18 * power;
    this.state.headAngleV = 0;

    // Bum flash
    this.state.bumFlash = 1;

    // Stars bursting from the bum area
    const COUNT = 4 + power * 2;
    for (let i = 0; i < COUNT; i++) {
      const ang = (Math.PI * 2 / COUNT) * i + (Math.random() - 0.5) * 0.5;
      this.state.stars.push({
        x: 0, y: 0,
        vx: Math.cos(ang) * (2.5 + Math.random() * 2.5 * power * 0.4),
        vy: Math.sin(ang) * (2.5 + Math.random() * 2.5 * power * 0.4) - 2,
        life: 1,
        size: 5 + Math.random() * 7 * power * 0.3,
        color: ['#FFD700','#FF6B00','#FF44AA','#00FFFF','#FFFFFF'][Math.floor(Math.random() * 5)],
      });
    }

    // Particles at bum
    for (let i = 0; i < 5 + power * 2; i++) {
      const ang = (Math.random() - 0.5) * Math.PI;
      this.state.particles.push({
        x: 0, y: 0,
        vx: Math.cos(ang) * (3 + Math.random() * 4),
        vy: Math.sin(ang) * (3 + Math.random() * 4) - 2.5,
        life: 1, size: 4 + Math.random() * 6,
        color: this.shirtColor,
      });
    }

    // Tears (sad drops)
    this.state.tears.push({ x: -10, y: 0, vy: 2.5, life: 1 });
    this.state.tears.push({ x:  12, y: 0, vy: 2.5, life: 1 });

    // Expression sequence
    this.state.exprQueue = [
      { expr: EXPR.SHOCKED, ms: 450 },
      { expr: EXPR.PAIN,    ms: 700 + power * 80 },
      { expr: EXPR.CRYING,  ms: 850 },
      { expr: EXPR.NEUTRAL, ms: Infinity },
    ];
    this._nextExpr();
  }

  _nextExpr() {
    if (!this.state.exprQueue.length) return;
    const { expr, ms } = this.state.exprQueue.shift();
    this.state.expression = expr;
    if (ms < Infinity) setTimeout(() => this._nextExpr(), ms);
  }

  // ── Animation loop ─────────────────────────────────────────

  _startLoop() {
    const tick = (now) => {
      const dt = Math.min((now - this._lastTime) / 1000, 0.05);
      this._lastTime = now;
      this._update(dt);
      this._render();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame((t) => { this._lastTime = t; tick(t); });
  }

  destroy() { if (this._raf) cancelAnimationFrame(this._raf); }

  // ── Physics update ─────────────────────────────────────────

  _update(dt) {
    const s = this.state;
    const f = dt * 60;

    // Spring X
    s.springVx += (-0.35 * s.springX) * f;
    s.springVx *= Math.pow(0.72, f);
    s.springX  += s.springVx * f;
    if (Math.abs(s.springX) < 0.1) { s.springX = 0; s.springVx = 0; }

    // Spring Y
    s.springVy += (-0.28 * s.springY) * f;
    s.springVy *= Math.pow(0.70, f);
    s.springY  += s.springVy * f;
    if (Math.abs(s.springY) < 0.1) { s.springY = 0; s.springVy = 0; }

    // Head shake
    s.headAngleV += (-0.30 * s.headAngle) * f;
    s.headAngleV *= Math.pow(0.65, f);
    s.headAngle  += s.headAngleV * f;
    if (Math.abs(s.headAngle) < 0.1) { s.headAngle = 0; s.headAngleV = 0; }

    // Bum flash
    s.bumFlash = Math.max(0, s.bumFlash - dt * 3.5);

    // Stars
    s.stars = s.stars.filter((st) => {
      st.x += st.vx * f; st.y += st.vy * f; st.vy += 0.06 * f; st.life -= dt * 1.6;
      return st.life > 0;
    });

    // Particles
    s.particles = s.particles.filter((p) => {
      p.x += p.vx * f; p.y += p.vy * f; p.vy += 0.1 * f; p.life -= dt * 2.2;
      return p.life > 0;
    });

    // Tears
    s.tears = s.tears.filter((t) => {
      t.y += t.vy * f; t.life -= dt * 1.4;
      return t.life > 0;
    });
  }

  // ── Render ─────────────────────────────────────────────────

  _render() {
    const ctx = this.ctx;
    const W   = this.canvas.width;   // 300
    const H   = this.canvas.height;  // 260
    const { springX: jx, springY: jy } = this.state;

    ctx.clearRect(0, 0, W, H);

    ctx.save();
    ctx.translate(jx, jy);

    // Draw order (back to front)
    this._drawShoes(ctx);
    this._drawLegs(ctx);
    this._drawTorso(ctx);
    this._drawBum(ctx);
    this._drawArms(ctx);
    this._drawNeck(ctx);
    this._drawHead(ctx);

    ctx.restore();

    // Effects (in world space — no jolt offset so they fly off naturally)
    const BUM_X = 224 + jx;
    const BUM_Y = 125 + jy;
    const HEAD_X = 48 + jx;
    const HEAD_Y = 105 + jy;

    this._drawParticles(ctx, BUM_X, BUM_Y);
    this._drawStars(ctx, BUM_X, BUM_Y);
    this._drawTears(ctx, HEAD_X, HEAD_Y);
  }

  // ── Body parts ─────────────────────────────────────────────

  /*
   *  LAYOUT (canvas 300×260):
   *
   *       HEAD(48,105)
   *         \
   *     NECK \
   *           SHOULDER(78,148)——TORSO——HIP(195,148)
   *                |                       |
   *               ARM                    LEGS (down to 252)
   *                \                    /
   *               HAND(188,248)        SHOES
   *
   *                    Above HIP: BUM dome rise
   */

  _drawShoes(ctx) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur  = 6;
    ctx.shadowOffsetY = 3;

    // Front shoe
    ctx.beginPath();
    ctx.ellipse(190, 252, 18, 7, -0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#1A1A1A';
    ctx.fill();

    // Back shoe
    ctx.beginPath();
    ctx.ellipse(220, 250, 16, 6, -0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#222';
    ctx.fill();

    ctx.restore();
  }

  _drawLegs(ctx) {
    const p  = this.pantsColor;
    const p2 = this._darken(p, 0.08);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Back Leg
    ctx.beginPath();
    ctx.moveTo(220, 155);
    ctx.lineTo(220, 245);
    ctx.lineWidth = 24;
    ctx.strokeStyle = p2;
    ctx.stroke();

    // Front Leg
    ctx.beginPath();
    ctx.moveTo(195, 160);
    ctx.lineTo(192, 245);
    ctx.lineWidth = 28;
    ctx.strokeStyle = p;
    ctx.stroke();

    ctx.restore();
  }

  _drawTorso(ctx) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const grad = ctx.createLinearGradient(90, 118, 90, 162);
    grad.addColorStop(0, this._lighten(this.shirtColor, 0.15));
    grad.addColorStop(1, this.shirtColor);

    ctx.shadowColor   = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.moveTo(90, 140);
    ctx.lineTo(175, 140);
    ctx.lineWidth = 44;
    ctx.strokeStyle = grad;
    ctx.stroke();

    // Subtle folds/stripes
    ctx.strokeStyle = this._darken(this.shirtColor, 0.15);
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(105, 152); ctx.lineTo(155, 152);
    ctx.moveTo(95, 130); ctx.lineTo(165, 130);
    ctx.stroke();

    ctx.restore();
  }

  _drawBum(ctx) {
    // === THE BUM ===
    const cx = 212, cy = 138, rx = 44, ry = 40;

    ctx.save();
    
    // Gradient: lighter at top, darker at bottom
    const grad = ctx.createRadialGradient(cx - 10, cy - 10, 0, cx, cy, rx + 5);
    grad.addColorStop(0, this._lighten(this.pantsColor, 0.15));
    grad.addColorStop(1, this.pantsColor);

    ctx.shadowColor   = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur    = 10;
    ctx.shadowOffsetY = 4;

    // Bum shape
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Belt / Waistband (covers the seam where torso meets bum)
    ctx.beginPath();
    ctx.moveTo(176, 114);
    ctx.lineTo(172, 163);
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#222';
    ctx.stroke();
    // Belt buckle
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(170, 155, 6, 8);

    // ── Hit flash overlay ──────────────────────────────────
    if (this.state.bumFlash > 0) {
      ctx.globalAlpha = this.state.bumFlash * 0.7;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FF4400';
      ctx.fill();

      // Impact glow
      const g = ctx.createRadialGradient(cx + 10, cy, 0, cx + 10, cy, 60 * this.state.bumFlash);
      g.addColorStop(0, 'rgba(255,200,0,0.9)');
      g.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.beginPath();
      ctx.arc(cx + 10, cy, 60, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // Target crosshair
    ctx.globalAlpha = 0.25 + this.state.bumFlash * 0.5;
    ctx.strokeStyle = '#FF3333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + 8, cy, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy); ctx.lineTo(cx + 28, cy);
    ctx.moveTo(cx + 8, cy - 20); ctx.lineTo(cx + 8, cy + 20);
    ctx.stroke();

    ctx.restore();
  }

  _drawArms(ctx) {
    ctx.save();
    ctx.lineCap = 'round';

    // Back Arm
    ctx.beginPath();
    ctx.moveTo(110, 140);
    ctx.bezierCurveTo(115, 195, 140, 240, 220, 245);
    ctx.strokeStyle = this._darken(SKIN_COLOR, 0.08);
    ctx.lineWidth = 12;
    ctx.stroke();

    // Front Arm
    ctx.beginPath();
    ctx.moveTo(95, 140);
    ctx.bezierCurveTo(100, 195, 130, 240, 190, 245);
    ctx.strokeStyle = SKIN_COLOR;
    ctx.lineWidth = 14;
    ctx.stroke();

    // Hands
    this._ellipse(ctx, 190, 246, 10, 7, SKIN_COLOR);
    this._ellipse(ctx, 220, 246, 9, 6, this._darken(SKIN_COLOR, 0.08));

    ctx.restore();
  }

  _drawNeck(ctx) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(52, 133);
    ctx.bezierCurveTo(50, 140, 62, 146, 80, 148);
    ctx.strokeStyle = SKIN_COLOR;
    ctx.lineWidth   = 15;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();
  }

  _drawHead(ctx) {
    const hx = 48, hy = 105, hr = 33;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate((this.state.headAngle * Math.PI) / 180);

    // Drop shadow
    ctx.shadowColor   = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur    = 14;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 5;

    // Skin base
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, Math.PI * 2);
    ctx.fillStyle = SKIN_COLOR;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Face photo clipped inside head circle
    if (this.faceCanvas) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, hr - 1, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.faceCanvas, -hr, -hr, hr * 2, hr * 2);
      ctx.restore();
    }

    // Expression overlay
    this._drawExpression(ctx, hr);

    // Outline ring
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.restore();
  }

  // ── Expressions ────────────────────────────────────────────

  _drawExpression(ctx, hr) {
    switch (this.state.expression) {

      case EXPR.NEUTRAL:
        if (!this.faceCanvas) this._faceNeutral(ctx);
        break;

      case EXPR.SHOCKED:
        // Yellow tint
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, hr - 1, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(255,220,0,0.3)'; ctx.fill();
        ctx.restore();
        this._faceShocked(ctx);
        // Sweat drop
        ctx.fillStyle = '#4FC3F7';
        ctx.beginPath(); ctx.arc(hr * 0.7, -hr * 0.3, 5, 0, Math.PI * 2); ctx.fill();
        break;

      case EXPR.PAIN:
        // Red tint
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, hr - 1, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(255,40,0,0.28)'; ctx.fill();
        ctx.restore();
        this._facePain(ctx, hr);
        break;

      case EXPR.CRYING:
        // Blue tint
        ctx.save();
        ctx.beginPath(); ctx.arc(0, 0, hr - 1, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(80,140,255,0.22)'; ctx.fill();
        ctx.restore();
        this._faceCrying(ctx);
        break;
    }
  }

  _faceNeutral(ctx) {
    // Simple cartoon face
    ctx.fillStyle = '#2D2D2D';
    ctx.beginPath(); ctx.arc(-11, -6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 11, -6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2D2D2D'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 6, 9, 0.3, Math.PI - 0.3); ctx.stroke();
  }

  _faceShocked(ctx) {
    // Bug-eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-11, -8, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 11, -8, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-11, -8, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 11, -8, 4, 0, Math.PI * 2); ctx.fill();
    // Highlights
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-9, -10, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13, -10, 2, 0, Math.PI * 2); ctx.fill();
    // Open mouth
    this._openMouth(ctx, 0, 14, 13, 9, '#CC0000');
  }

  _facePain(ctx, hr) {
    // X eyes
    ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    [-11, 11].forEach((ex) => {
      ctx.beginPath(); ctx.moveTo(ex - 6, -13); ctx.lineTo(ex + 6, -4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex + 6, -13); ctx.lineTo(ex - 6, -4); ctx.stroke();
    });
    // Pain open mouth
    this._openMouth(ctx, 0, 14, 11, 8, '#990000');
    // Manga pain lines
    ctx.save(); ctx.strokeStyle = '#FF4444'; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.65;
    [[-hr*0.7,-hr*0.6,-hr*0.95,-hr*0.35],[hr*0.65,-hr*0.6,hr*0.95,-hr*0.35]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1+4,y1); ctx.lineTo(x2+4,y2); ctx.stroke();
    });
    ctx.restore();
  }

  _faceCrying(ctx) {
    // Droopy arched eyes
    ctx.strokeStyle = '#1A1A1A'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-12, -6, 7, 0, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc( 12, -6, 7, 0, Math.PI); ctx.stroke();
    // Sad mouth
    ctx.beginPath(); ctx.arc(0, 24, 11, Math.PI + 0.4, Math.PI * 2 - 0.4); ctx.stroke();
  }

  _openMouth(ctx, x, y, w, h, color) {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    // Teeth
    ctx.fillStyle = '#fff';
    ctx.fillRect(x - w + 3, y - h / 2, (w - 3) * 2, h * 0.45);
    // Tongue
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.25, w * 0.55, h * 0.38, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FF6B8A';
    ctx.fill();
  }

  // ── Stars / particles ─────────────────────────────────────

  _drawStars(ctx, bx, by) {
    this.state.stars.forEach((s) => {
      ctx.save();
      ctx.globalAlpha = s.life;
      ctx.translate(bx + s.x, by + s.y);
      // 5-pointed star
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const oa = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const ia = oa + Math.PI / 5;
        if (i === 0) ctx.moveTo(Math.cos(oa) * s.size, Math.sin(oa) * s.size);
        else         ctx.lineTo(Math.cos(oa) * s.size, Math.sin(oa) * s.size);
        ctx.lineTo(Math.cos(ia) * s.size * 0.38, Math.sin(ia) * s.size * 0.38);
      }
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.restore();
    });
  }

  _drawParticles(ctx, bx, by) {
    this.state.particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle   = p.color;
      ctx.beginPath();
      ctx.arc(bx + p.x, by + p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  _drawTears(ctx, hx, hy) {
    this.state.tears.forEach((t) => {
      ctx.save();
      ctx.globalAlpha = t.life;
      ctx.fillStyle   = '#4FC3F7';
      const tx = hx + t.x, ty = hy + 28 + t.y;
      ctx.beginPath(); ctx.arc(tx, ty, 3.5, 0, Math.PI * 2); ctx.fill();
      // Trail
      ctx.beginPath();
      ctx.moveTo(tx, ty - 3);
      ctx.bezierCurveTo(tx - 3, ty - 12, tx + 3, ty - 12, tx, ty - 14);
      ctx.fillStyle = 'rgba(79,195,247,0.45)';
      ctx.fill();
      ctx.restore();
    });
  }

  // ── Helpers ───────────────────────────────────────────────

  _rRect(ctx, x, y, w, h, r, color) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = color;
    ctx.fill();
  }

  _ellipse(ctx, cx, cy, rx, ry, color) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  _darken(hex, amt) {
    if (!hex?.startsWith?.('#')) return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (n >> 16) - Math.round(255 * amt));
    const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(255 * amt));
    const b = Math.max(0, (n & 0xff) - Math.round(255 * amt));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  _lighten(hex, amt) {
    if (!hex?.startsWith?.('#')) return hex;
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) + Math.round(255 * amt));
    const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(255 * amt));
    const b = Math.min(255, (n & 0xff) + Math.round(255 * amt));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}
