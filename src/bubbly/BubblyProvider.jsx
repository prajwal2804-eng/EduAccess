import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { sfx, isSfxOn, setSfxOn, getVol, setVol, read, write } from "./sfx";
import "./bubbly.css";

const Ctx = createContext({ reward: () => {}, burst: () => {} });
export const useBubbly = () => useContext(Ctx);

const PRAISE = ["Nice!", "You got it!", "Blooming!", "Brain power!", "Petal-perfect!", "On a roll!"];
const SHAPES = ["✿", "❀", "✦", "♥", "🌸"];
const COLORS = ["#f7a1c4", "#ffb3cf", "#d9608f", "#ffd6e6", "#e2b95a"];
const PETAL_TONES = ["#ffd6e6", "#ffc2d9", "#ffb3cf", "#ffe4ee", "#f9a8c9"];
const BUBBLE_HUES = [335, 345, 350, 355, 5, 15, 300];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ---------- blossom branch (top corners) ---------- */
const Flower = ({ x, y, s = 1, r = 0 }) => (
  <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx="0" cy="-9" rx="6.5" ry="9.5" fill="#ffd0e1" stroke="#f08db3" strokeWidth=".8" transform={`rotate(${a})`} />
    ))}
    <circle r="3" fill="#ffe08a" />
    {[0, 60, 120, 180, 240, 300].map((a) => (
      <line key={a} x1="0" y1="0" x2="0" y2="-5.5" stroke="#e8a23d" strokeWidth=".8" transform={`rotate(${a})`} />
    ))}
  </g>
);

function Branch({ right }) {
  return (
    <div className={"bb-branch" + (right ? " r" : "")} aria-hidden="true">
      <svg viewBox="0 0 320 260" width="100%">
        <g stroke="#7b4a3b" fill="none" strokeLinecap="round">
          <path d="M-10 28 C 60 36, 115 78, 172 106 S 262 150, 306 176" strokeWidth="7" />
          <path d="M92 60 C 104 90, 118 112, 126 146" strokeWidth="4" />
          <path d="M172 106 C 192 80, 218 64, 250 58" strokeWidth="4" />
          <path d="M240 140 C 252 160, 258 182, 256 206" strokeWidth="3" />
        </g>
        <g fill="#9fd39a" stroke="#6fb27a" strokeWidth=".6">
          <ellipse cx="136" cy="158" rx="10" ry="4.5" transform="rotate(70 136 158)" />
          <ellipse cx="196" cy="74" rx="10" ry="4.5" transform="rotate(-35 196 74)" />
          <ellipse cx="262" cy="196" rx="9" ry="4" transform="rotate(80 262 196)" />
          <ellipse cx="112" cy="68" rx="9" ry="4" transform="rotate(40 112 68)" />
        </g>
        <Flower x={40} y={42} s={1.1} />
        <Flower x={78} y={60} s={0.9} r={20} />
        <Flower x={126} y={148} s={1} r={10} />
        <Flower x={152} y={92} s={1.2} r={35} />
        <Flower x={206} y={96} s={0.9} r={15} />
        <Flower x={250} y={58} s={1.1} r={50} />
        <Flower x={256} y={208} s={0.9} r={5} />
        <Flower x={300} y={174} s={1} r={30} />
        <circle cx="222" cy="132" r="4" fill="#f9a8c9" />
        <circle cx="106" cy="104" r="3.5" fill="#f9a8c9" />
      </svg>
    </div>
  );
}

/* ---------- falling petals and leaves ---------- */
function Petals() {
  const items = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => {
        const leaf = i % 7 === 0;
        return {
          id: i, leaf,
          size: leaf ? 16 + Math.random() * 10 : 10 + Math.random() * 12,
          left: Math.random() * 100,
          dur: 11 + Math.random() * 10,
          delay: -Math.random() * 20,
          sway: (Math.random() - 0.5) * 160,
          flutter: 2.6 + Math.random() * 2.4,
          tone: pick(PETAL_TONES),
        };
      }),
    []
  );
  return (
    <div className="bb-petals" aria-hidden="true">
      {items.map((p) => (
        <span key={p.id} className="bb-fall"
          style={{ left: p.left + "%", "--dur": p.dur + "s", "--delay": p.delay + "s", "--sway": p.sway + "px" }}>
          <span className={"bb-petal" + (p.leaf ? " leaf" : "")}
            style={{ width: p.size, height: p.size * 1.1, "--c": p.tone, "--fl": p.flutter + "s" }} />
        </span>
      ))}
    </div>
  );
}

/* ---------- interactive bubbles ---------- */
function makeBubble(id, first) {
  return {
    id, gen: 0, popped: false,
    size: 48 + Math.random() * 72,
    left: 3 + Math.random() * 90,
    dur: 16 + Math.random() * 14,
    delay: first ? -Math.random() * 24 : 0,
    sway: (Math.random() - 0.5) * 90,
    hue: pick(BUBBLE_HUES),
    face: Math.random() < 0.45,
  };
}

function FloatingBackground({ onPop }) {
  const [bubbles, setBubbles] = useState(() => Array.from({ length: 12 }, (_, i) => makeBubble(i, true)));
  const busy = useRef(new Set());

  const popOne = (b, el) => {
    if (busy.current.has(b.id)) return;
    busy.current.add(b.id);
    sfx.bubbleSqueak();
    el.classList.add("squish");
    const r = el.getBoundingClientRect();
    setTimeout(() => {
      sfx.bubblePop();
      onPop(r.left + r.width / 2, r.top + r.height / 2, r.width, b.hue);
      setBubbles((l) => l.map((x) => (x.id === b.id ? { ...x, popped: true } : x)));
      setTimeout(() => {
        busy.current.delete(b.id);
        setBubbles((l) => l.map((x) => (x.id === b.id ? { ...makeBubble(b.id, false), gen: x.gen + 1 } : x)));
      }, 1800);
    }, 110);
  };

  return (
    <div className="bb-bg" aria-hidden="true">
      {bubbles.map(
        (b) =>
          !b.popped && (
            <span key={b.id + "-" + b.gen} className="bb-fly"
              style={{ left: b.left + "%", "--dur": b.dur + "s", "--delay": b.delay + "s", "--sway": b.sway + "px" }}>
              <span className="bb-bub" style={{ width: b.size, height: b.size, "--h": b.hue }}
                onPointerEnter={() => sfx.bubbleHover()}
                onClick={(e) => popOne(b, e.currentTarget)}>
                <span className="bb-body">
                  <i className="bb-shine" />
                  <i className="bb-shine2" />
                  {b.face && (
                    <>
                      <i className="bb-eye l" /><i className="bb-eye r" />
                      <i className="bb-cheek l" /><i className="bb-cheek r" />
                      <i className="bb-mouth" />
                    </>
                  )}
                </span>
              </span>
            </span>
          )
      )}
    </div>
  );
}

export function BubblyProvider({ children }) {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [calm, setCalm] = useState(() => read("bb-calm", !!reduce));
  const [sound, setSound] = useState(isSfxOn());
  const [vol, setVolState] = useState(getVol());
  const [bursts, setBursts] = useState([]);
  const [pops, setPops] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [petals, setPetals] = useState(0);
  const calmRef = useRef(calm);
  const idRef = useRef(0);
  const streak = useRef(0);

  calmRef.current = calm;
  useEffect(() => write("bb-calm", calm), [calm]);

  const burst = useCallback((x, y, big = false) => {
    if (calmRef.current) return;
    const n = big ? 18 : 8;
    const parts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = (big ? 90 : 50) + Math.random() * (big ? 80 : 40);
      return {
        dx: Math.cos(a) * d, dy: Math.sin(a) * d, rot: (Math.random() - 0.5) * 360 + "deg",
        shape: pick(SHAPES), color: pick(COLORS), size: 12 + Math.random() * (big ? 14 : 8),
      };
    });
    const id = ++idRef.current;
    setBursts((b) => [...b, { id, x, y, parts }]);
    setTimeout(() => setBursts((b) => b.filter((i) => i.id !== id)), 800);
  }, []);

  const popFx = useCallback(
    (x, y, size, hue) => {
      if (calmRef.current) return;
      const drops = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
        const d = size * 0.55 + Math.random() * size * 0.5;
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, s: 5 + Math.random() * 7 };
      });
      const id = ++idRef.current;
      setPops((p) => [...p, { id, x, y, size, hue, drops }]);
      setTimeout(() => setPops((p) => p.filter((i) => i.id !== id)), 750);
      setPetals((s) => s + 1);
      burst(x, y, false);
    },
    [burst]
  );

  const reward = useCallback((text, pts = 10) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-2), { id, text, pts }]);
    if (pts) setPetals((s) => s + pts);
    setTimeout(() => setToasts((t) => t.filter((i) => i.id !== id)), 1700);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      const t = e.target;
      if (!t.closest) return;
      const { clientX: x, clientY: y } = e;
      if (t.closest(".fc-rate .fc-good")) {
        streak.current += 1;
        sfx.good();
        burst(x, y, true);
        reward(streak.current >= 3 ? `🔥 ${streak.current} in a row!` : pick(PRAISE), 10);
      } else if (t.closest(".fc-rate .fc-warn")) {
        streak.current = 0;
        sfx.oops();
        reward("Keep going, you'll get it! 💪", 0);
      } else if (t.closest(".fc-scene, .fc-main")) {
        sfx.flip();
        burst(x, y);
      } else if (t.closest("button, [role=button], .ap-sent")) {
        sfx.pop();
        burst(x, y);
      }
    };
    let last = null;
    const onOver = (e) => {
      const b = e.target.closest?.("button, .fc-scene");
      if (b && b !== last && !b.disabled) sfx.tick();
      last = b || null;
    };
    const mo = new MutationObserver((muts) => {
      for (const m of muts)
        for (const n of m.addedNodes)
          if (n.nodeType === 1 && (n.matches?.(".fc-summary") || n.querySelector?.(".fc-summary"))) {
            sfx.fanfare();
            burst(window.innerWidth / 2, window.innerHeight / 3, true);
            reward("Deck complete! 🎉", 50);
          }
    });
    document.addEventListener("click", onClick);
    document.addEventListener("mouseover", onOver);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("mouseover", onOver);
      mo.disconnect();
    };
  }, [burst, reward]);

  return (
    <Ctx.Provider value={{ reward, burst }}>
      <div className={"bubbly" + (calm ? " calm" : "")}>
        <Branch />
        <Branch right />
        {!calm && <Petals />}
        <div className="bb-content">{children}</div>
        {!calm && <FloatingBackground onPop={popFx} />}

        <div className="bb-fx" aria-hidden="true">
          {bursts.map((b) => (
            <div key={b.id} className="bb-burst" style={{ left: b.x, top: b.y }}>
              {b.parts.map((p, i) => (
                <span key={i} className="bb-p"
                  style={{ "--dx": p.dx + "px", "--dy": p.dy + "px", "--rot": p.rot, color: p.color, fontSize: p.size }}>
                  {p.shape}
                </span>
              ))}
            </div>
          ))}
          {pops.map((p) => (
            <div key={p.id} className="bb-pop" style={{ left: p.x, top: p.y, "--size": p.size + "px", "--h": p.hue }}>
              <span className="bb-ring" />
              {p.drops.map((d, i) => (
                <span key={i} className="bb-drop" style={{ "--dx": d.dx + "px", "--dy": d.dy + "px", width: d.s, height: d.s }} />
              ))}
            </div>
          ))}
        </div>

        <div className="bb-toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="bb-toast">
              {t.text} {t.pts > 0 && <span className="bb-pts">+{t.pts} 🌸</span>}
            </div>
          ))}
        </div>

        <div className="bb-controls">
          <span className="bb-stars" title="Petals collected">🌸 {petals}</span>
          <button className="bb-ctl" aria-pressed={sound} aria-label="Toggle sound"
            onClick={() => { const v = !sound; setSound(v); setSfxOn(v); }}>
            {sound ? "🔊" : "🔇"}
          </button>
          {sound && (
            <input type="range" min="0" max="1" step="0.05" value={vol} aria-label="Volume"
              onChange={(e) => { setVolState(+e.target.value); setVol(+e.target.value); }}
              onPointerUp={() => sfx.pop()} />
          )}
          <button className="bb-ctl" aria-pressed={calm} onClick={() => setCalm((c) => !c)}>
            {calm ? "🌿 Calm: on" : "🌿 Calm"}
          </button>
        </div>
      </div>
    </Ctx.Provider>
  );
}