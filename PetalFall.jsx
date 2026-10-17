import { useEffect, useRef } from "react";

const TONES = ["#ffd6e6", "#ffc2d9", "#ffb3cf", "#ffe4ee", "#f9a8c9", "#fbb9d3"];
const rand = (a, b) => a + Math.random() * (b - a);

// ===== PETAL AMOUNT: change these two =====
const DENSITY = 4000;     // smaller = more petals (screen area per petal)
const MAX_PETALS = 450;   // hard limit, so slow devices don't struggle
const MIN_PETALS = 150;   // phones always get at least this many
// ==========================================

// Set to true if you want petals to float OVER the cards/text instead of behind them.
const IN_FRONT = false;

export default function PetalFall() {
  const ref = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext("2d");
    let w = 0, h = 0, raf = 0, petals = [];
    let last = performance.now();
    let t = 0;

    const make = (initial) => ({
      x: initial ? rand(-0.2 * w, 1.1 * w) : rand(-0.4 * w, 1.0 * w),
      y: initial ? rand(0, h) : rand(-60, -10),
      size: rand(4, 9),
      vy: rand(35, 80),
      swayAmp: rand(15, 45),
      swayFreq: rand(0.6, 1.6),
      phase: rand(0, Math.PI * 2),
      rot: rand(0, Math.PI * 2),
      rotSpeed: rand(-1.8, 1.8),
      tumble: rand(0, Math.PI * 2),
      tumbleSpeed: rand(1.5, 4),
      tone: TONES[Math.floor(Math.random() * TONES.length)],
      alpha: rand(0.6, 0.95),
    });

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(MAX_PETALS, Math.max(MIN_PETALS, Math.round((w * h) / DENSITY)));
      if (petals.length > count) petals.length = count;
      while (petals.length < count) petals.push(make(true));
    };

    const drawPetal = (p) => {
      const s = p.size;
      const flip = Math.cos(p.tumble);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(Math.max(0.15, Math.abs(flip)), 1);
      ctx.globalAlpha = p.alpha * (0.7 + 0.3 * Math.abs(flip));
      ctx.fillStyle = p.tone;
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.bezierCurveTo(s * 1.1, s * 0.4, s * 0.9, -s * 0.9, s * 0.15, -s);
      ctx.lineTo(0, -s * 0.72);
      ctx.lineTo(-s * 0.15, -s);
      ctx.bezierCurveTo(-s * 0.9, -s * 0.9, -s * 1.1, s * 0.4, 0, s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      const wind = 30 + Math.sin(t * 0.3) * 22 + Math.sin(t * 0.9) * 10;

      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < petals.length; i++) {
        const p = petals[i];
        p.y += p.vy * dt;
        p.x += (wind + Math.cos(p.phase + t * p.swayFreq) * p.swayAmp) * dt;
        p.rot += p.rotSpeed * dt;
        p.tumble += p.tumbleSpeed * dt;
        if (p.y > h + 20 || p.x > w + 40 || p.x < -80) petals[i] = make(false);
        else drawPetal(p);
      }
      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: IN_FRONT ? 2 : 0,
      }}
    />
  );
}