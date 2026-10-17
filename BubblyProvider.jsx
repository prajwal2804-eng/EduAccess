import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { sfx, isSfxOn, setSfxOn, getVol, setVol, read, write } from "./sfx";
import PetalFall from "./PetalFall";
import "./bubbly.css";

const Ctx = createContext({ reward: () => {}, burst: () => {} });
export const useBubbly = () => useContext(Ctx);

const PRAISE = ["Nice!", "You got it!", "Blooming!", "Brain power!", "Petal-perfect!", "On a roll!"];
const SHAPES = ["✿", "❀", "✦", "♥", "🌸"];
const COLORS = ["#f7a1c4", "#ffb3cf", "#d9608f", "#ffd6e6", "#e2b95a"];
const BUBBLE_HUES = [335, 345, 350, 355, 5, 15, 300];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

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
        {!calm && <PetalFall />}
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