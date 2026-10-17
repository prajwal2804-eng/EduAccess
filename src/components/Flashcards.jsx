import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./Flashcards.css";

const shuffleArr = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const sizeFor = (s) => (s.length > 400 ? "0.95rem" : s.length > 200 ? "1.1rem" : s.length > 90 ? "1.3rem" : "1.55rem");

export default function Flashcards({ cards }) {
  const valid = useMemo(() => (cards || []).filter((c) => c && c.q && c.a), [cards]);
  const [deck, setDeck] = useState(valid);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [status, setStatus] = useState({});

  const reset = (d) => { setDeck(d); setI(0); setFlipped(false); setStatus({}); };
  useEffect(() => { reset(valid); }, [valid]);

  const total = deck.length;
  const done = i >= total;
  const go = (n) => { setFlipped(false); setI(Math.max(0, Math.min(total, n))); };
  const mark = (s) => { setStatus((p) => ({ ...p, [i]: s })); go(i + 1); };

  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget || done) return;
    if (e.key === "ArrowRight") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); }
  };

  if (!total) return <p className="fc-empty">No flashcards yet.</p>;

  if (done) {
    const known = Object.values(status).filter((s) => s === "known").length;
    const missed = deck.filter((_, idx) => status[idx] !== "known");
    return (
      <div className="fc">
        <div className="fc-summary">
          <h3>Deck complete 🎉</h3>
          <p><strong>{known}</strong> of {total} marked as known</p>
          <div className="fc-controls">
            {missed.length > 0 && <button className="fc-btn fc-warn" onClick={() => reset(missed)}>Review {missed.length} missed</button>}
            <button className="fc-btn" onClick={() => reset(valid)}>Restart all</button>
          </div>
        </div>
      </div>
    );
  }

  const card = deck[i];
  return (
    <div className="fc" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="fc-top">
        <span>Card {i + 1} / {total}</span>
        <button className="fc-link" onClick={() => reset(shuffleArr(deck))}>🔀 Shuffle</button>
      </div>
      <div className="fc-bar"><div style={{ width: `${(i / total) * 100}%` }} /></div>

      <AnimatePresence mode="wait">
        <motion.div
          key={i + "-" + card.q}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.25 }}
        >
          <div className="fc-scene" role="button" aria-label="Flip card" onClick={() => setFlipped((f) => !f)}>
            <motion.div
              className="fc-card"
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
            >
              <div className="fc-face fc-front">
                <span className="fc-tag">Question</span>
                <div className="fc-text" style={{ fontSize: sizeFor(card.q) }}>{card.q}</div>
              </div>
              <div className="fc-face fc-back">
                <span className="fc-tag fc-tag-b">Answer</span>
                <div className="fc-text" style={{ fontSize: sizeFor(card.a) }}>{card.a}</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      <p className="fc-hint">Click the card or press Space to flip · ← → to move</p>

      <div className="fc-controls">
        <button className="fc-btn" onClick={() => go(i - 1)} disabled={i === 0}>← Prev</button>
        <button className="fc-btn fc-main" onClick={() => setFlipped((f) => !f)}>Flip</button>
        <button className="fc-btn" onClick={() => go(i + 1)}>Next →</button>
      </div>

      {flipped && (
        <motion.div className="fc-controls fc-rate" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <button className="fc-btn fc-warn" onClick={() => mark("review")}>✗ Review again</button>
          <button className="fc-btn fc-good" onClick={() => mark("known")}>✓ Got it</button>
        </motion.div>
      )}
    </div>
  );
}