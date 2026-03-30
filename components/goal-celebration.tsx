'use client';

import { useEffect, useRef, useState } from 'react';

interface GoalCelebrationProps {
  open: boolean;
  onClose: () => void;
  goalName: string;
  emoji: string;
  message: string;
}

export function GoalCelebration({ open, onClose, goalName, emoji, message }: GoalCelebrationProps) {
  const canvasBackRef  = useRef<HTMLCanvasElement>(null);
  const canvasFrontRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed');

  // Open / close lifecycle
  useEffect(() => {
    if (open) {
      setPhase('open');
      const t = setTimeout(() => onClose(), 7000);
      return () => clearTimeout(t);
    } else if (phase === 'open') {
      setPhase('closing');
      const t = setTimeout(() => setPhase('closed'), 600);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Canvas animation — only runs while phase === 'open'
  useEffect(() => {
    if (phase !== 'open') return;
    if (!canvasBackRef.current || !canvasFrontRef.current) return;

    const canvasBack  = canvasBackRef.current;
    const canvasFront = canvasFrontRef.current;
    const ctxBack  = canvasBack.getContext('2d')!;
    const ctxFront = canvasFront.getContext('2d')!;
    let animId: number;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      [canvasBack, canvasFront].forEach(c => {
        c.width  = window.innerWidth  * dpr;
        c.height = window.innerHeight * dpr;
        c.style.width  = `${window.innerWidth}px`;
        c.style.height = `${window.innerHeight}px`;
      });
      ctxBack.scale(dpr, dpr);
      ctxFront.scale(dpr, dpr);
    };
    resize();

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const COLORS = [
      '#1754cf','#F59E0B','#10B981','#EC4899','#8B5CF6',
      '#FFFFFF','#3B82F6','#60A5FA','#FFD700','#FF6B6B',
      '#4ECDC4','#A78BFA',
    ];
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

    // ── Particle ──────────────────────────────────────────────────────────────
    class Particle {
      x: number; y: number; vx: number; vy: number;
      alpha: number; color: string; size: number;
      gravity: number; friction: number; decay: number;
      isConfetti: boolean; rotation: number; rotationSpeed: number; shape: number;

      constructor(x: number, y: number, color: string, isConfetti = false) {
        this.x = x; this.y = y; this.color = color; this.isConfetti = isConfetti;
        this.alpha = 1;
        this.size       = isConfetti ? Math.random() * 8 + 5 : Math.random() * 4 + 2;
        this.gravity    = isConfetti ? 0.015 : 0.035;
        this.friction   = 0.985;
        this.decay      = Math.random() * 0.004 + 0.002;
        this.rotation      = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.3;
        this.shape = Math.floor(Math.random() * 3);
        const angle    = Math.random() * Math.PI * 2;
        const velocity = Math.random() * (isConfetti ? 8 : 10) + 3;
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity - (isConfetti ? 2 : 0);
      }

      update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x  += this.vx;
        this.y  += this.vy;
        this.alpha    -= this.decay;
        this.rotation += this.rotationSpeed;
      }

      draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle   = this.color;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        if (this.isConfetti) {
          if (this.shape === 0) {
            ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
          } else if (this.shape === 1) {
            ctx.beginPath();
            ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
              const a  = (i * 4 * Math.PI) / 5 - Math.PI / 2;
              const a2 = a + (2 * Math.PI) / 10;
              ctx.lineTo(Math.cos(a)  * this.size * 0.5, Math.sin(a)  * this.size * 0.5);
              ctx.lineTo(Math.cos(a2) * this.size * 0.2, Math.sin(a2) * this.size * 0.2);
            }
            ctx.closePath();
            ctx.fill();
          }
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, this.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 10;
          ctx.shadowColor = this.color;
        }
        ctx.restore();
      }
    }

    // ── Sparkle ───────────────────────────────────────────────────────────────
    class Sparkle {
      x: number; y: number; alpha: number; size: number; decay: number; twinkle: number;
      constructor(x: number, y: number) {
        this.x = x; this.y = y; this.alpha = 1;
        this.size    = Math.random() * 3 + 1;
        this.decay   = Math.random() * 0.02 + 0.01;
        this.twinkle = Math.random() * 0.2;
      }
      update() { this.alpha -= this.decay; }
      draw(ctx: CanvasRenderingContext2D) {
        const flicker = Math.sin(Date.now() * this.twinkle) * 0.3 + 0.7;
        ctx.save();
        ctx.globalAlpha  = this.alpha * flicker;
        ctx.fillStyle    = '#FFFFFF';
        ctx.shadowBlur   = 15;
        ctx.shadowColor  = '#FFFFFF';
        ctx.strokeStyle  = '#FFFFFF';
        ctx.lineWidth    = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(this.x - this.size * 2, this.y);
        ctx.lineTo(this.x + this.size * 2, this.y);
        ctx.moveTo(this.x, this.y - this.size * 2);
        ctx.lineTo(this.x, this.y + this.size * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ── Firework ──────────────────────────────────────────────────────────────
    class Firework {
      x: number; y: number; targetY: number; vy: number;
      color: string; exploded: boolean;
      trail: { x: number; y: number; alpha: number }[];

      constructor() {
        this.x       = Math.random() * W();
        this.y       = H();
        this.targetY = Math.random() * (H() * 0.5) + 50;
        this.vy      = -(Math.random() * 4 + 8);
        this.color   = pick(COLORS);
        this.exploded = false;
        this.trail    = [];
      }

      update() {
        this.trail.push({ x: this.x, y: this.y, alpha: 1 });
        if (this.trail.length > 8) this.trail.shift();
        this.trail.forEach(t => (t.alpha *= 0.8));
        this.y  += this.vy;
        this.vy *= 0.985;

        if (this.y <= this.targetY || Math.abs(this.vy) < 0.5) {
          this.exploded = true;
          // Explosion sparks — almost all behind the card
          for (let i = 0; i < 80; i++) {
            const p = new Particle(this.x, this.y, this.color);
            (Math.random() < 0.92 ? particlesBack : particlesFront).push(p);
          }
          // Confetti from explosion — mostly behind, small sprinkle in front
          for (let i = 0; i < 30; i++) {
            const p = new Particle(this.x, this.y, pick(COLORS), true);
            (Math.random() < 0.85 ? particlesBack : particlesFront).push(p);
          }
          for (let i = 0; i < 15; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * 50;
            sparkles.push(new Sparkle(this.x + Math.cos(a) * d, this.y + Math.sin(a) * d));
          }
        }
      }

      draw(ctx: CanvasRenderingContext2D) {
        this.trail.forEach((t, i) => {
          ctx.save();
          ctx.globalAlpha = t.alpha * 0.5;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 2 - i * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.fill();
          ctx.restore();
        });
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fillStyle   = this.color;
        ctx.shadowBlur  = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
      }
    }

    const particlesBack:  Particle[]  = [];
    const particlesFront: Particle[]  = [];
    const fireworks:      Firework[]  = [];
    const sparkles:       Sparkle[]   = [];

    // Initial burst from center — mostly behind
    for (let i = 0; i < 150; i++) {
      const p = new Particle(W() / 2, H() / 2, pick(COLORS), true);
      (Math.random() < 0.88 ? particlesBack : particlesFront).push(p);
    }
    for (let i = 0; i < 30; i++) {
      sparkles.push(new Sparkle(Math.random() * W(), Math.random() * H() * 0.6));
    }
    fireworks.push(new Firework());
    setTimeout(() => fireworks.push(new Firework()), 200);

    // Side confetti waves — mostly behind, light sprinkle in front
    const launchSide = () => {
      for (let i = 0; i < 40; i++) {
        const left = Math.random() > 0.5;
        const p    = new Particle(left ? 0 : W(), H() * 0.7, pick(COLORS), true);
        p.vx = left ? Math.random() * 8 + 4 : -(Math.random() * 8 + 4);
        p.vy = -(Math.random() * 10 + 5);
        (Math.random() < 0.8 ? particlesBack : particlesFront).push(p);
      }
    };
    setTimeout(launchSide, 500);
    setTimeout(launchSide, 1500);
    setTimeout(launchSide, 3000);

    const animate = () => {
      // Back: motion-blur trail
      ctxBack.fillStyle = 'rgba(15, 17, 21, 0.15)';
      ctxBack.fillRect(0, 0, W(), H());
      // Front: fully clear
      ctxFront.clearRect(0, 0, W(), H());

      if (Math.random() < 0.06)  fireworks.push(new Firework());
      if (Math.random() < 0.15)  sparkles.push(new Sparkle(Math.random() * W(), Math.random() * H() * 0.7));

      for (let i = fireworks.length - 1; i >= 0; i--) {
        fireworks[i].update();
        if (fireworks[i].exploded) fireworks.splice(i, 1);
        else fireworks[i].draw(ctxBack);
      }
      for (let i = particlesBack.length - 1; i >= 0; i--) {
        particlesBack[i].update();
        if (particlesBack[i].alpha <= 0) particlesBack.splice(i, 1);
        else particlesBack[i].draw(ctxBack);
      }
      for (let i = particlesFront.length - 1; i >= 0; i--) {
        particlesFront[i].update();
        if (particlesFront[i].alpha <= 0) particlesFront.splice(i, 1);
        else particlesFront[i].draw(ctxFront);
      }
      for (let i = sparkles.length - 1; i >= 0; i--) {
        sparkles[i].update();
        if (sparkles[i].alpha <= 0) sparkles.splice(i, 1);
        else sparkles[i].draw(ctxBack);
      }

      animId = requestAnimationFrame(animate);
    };
    animate();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [phase]);

  if (phase === 'closed') return null;
  const isOpen = phase === 'open';

  return (
    <>
      <style>{`
        @keyframes cel-in  { from{opacity:0;transform:scale(.75) translateY(32px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes cel-out { from{opacity:1;transform:scale(1)} to{opacity:0;transform:scale(.88) translateY(20px)} }
        @keyframes cel-bob { 0%,100%{transform:scale(1)} 50%{transform:scale(1.18)} }
        @keyframes cel-glow-pulse { 0%,100%{box-shadow:0 0 60px rgba(23,84,207,.55),0 0 120px rgba(139,92,246,.3)} 50%{box-shadow:0 0 90px rgba(23,84,207,.8),0 0 160px rgba(139,92,246,.5)} }
        @keyframes cel-btn-pulse  { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.6)} 50%{box-shadow:0 0 0 10px rgba(16,185,129,0)} }
        .cel-card-in  { animation: cel-in  .5s cubic-bezier(.16,1,.3,1) forwards }
        .cel-card-out { animation: cel-out .5s ease forwards }
        .cel-bob      { animation: cel-bob 1.1s ease-in-out infinite }
        .cel-glow     { animation: cel-glow-pulse 2s ease-in-out infinite }
        .cel-btn      { animation: cel-btn-pulse  1.8s ease infinite }
      `}</style>

      {/* Back canvas — fireworks + sparkles + half confetti */}
      <canvas ref={canvasBackRef} className="fixed inset-0 z-[60] pointer-events-none" />

      {/* Card */}
      <div className="fixed inset-0 z-[61] flex items-center justify-center p-6 pointer-events-none">
        <div className={`pointer-events-auto w-full max-w-[300px] ${isOpen ? 'cel-card-in' : 'cel-card-out'}`}>
          <div className="cel-glow bg-gradient-to-br from-primary/30 to-purple-600/20 backdrop-blur-xl border border-white/20 rounded-[40px] p-8 text-center">

            {/* Emoji */}
            <div className="flex items-center justify-center mb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400/30 to-emerald-500/20 flex items-center justify-center ring-4 ring-white/20 shadow-[0_0_40px_rgba(16,185,129,0.45)]">
                <span className="cel-bob text-5xl leading-none select-none">{emoji}</span>
              </div>
            </div>

            {/* Text */}
            <h2 className="text-4xl font-black text-white uppercase italic tracking-tight mb-2 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
              Goal Reached!
            </h2>
            <p className="text-white/80 font-bold text-base mb-1">{goalName}</p>
            <p className="text-white/55 text-sm leading-relaxed mb-6 px-2">{message}</p>

            {/* CTA */}
            <button
              onClick={onClose}
              className="cel-btn w-full h-12 rounded-2xl text-white text-sm font-bold tracking-wide transition-transform active:scale-95"
              style={{ background: 'linear-gradient(135deg,#22c55e,#14b8a6)' }}
            >
              Keep it up! 🚀
            </button>
            <button onClick={onClose} className="mt-3 text-xs text-white/40 hover:text-white/70 transition-colors">
              dismiss
            </button>
          </div>
        </div>
      </div>

      {/* Front canvas — confetti that falls over card */}
      <canvas ref={canvasFrontRef} className="fixed inset-0 z-[62] pointer-events-none" />
    </>
  );
}
