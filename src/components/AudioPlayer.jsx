import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./AudioPlayer.css";

const MAX_CHUNK = 220; // long sentences are split so the browser doesn't cut them off

function buildSegments(text) {
  const segs = [];
  for (const m of text.matchAll(/[^.!?\n]+[.!?]*/g)) {
    if (!m[0].trim()) continue;
    const base = m.index;
    if (m[0].length <= MAX_CHUNK) {
      segs.push({ start: base, end: base + m[0].length });
      continue;
    }
    let cur = null;
    for (const p of m[0].matchAll(/[^,;:]+[,;:]?/g)) {
      const s = base + p.index;
      const e = s + p[0].length;
      if (cur && e - cur.start > MAX_CHUNK) {
        segs.push(cur);
        cur = null;
      }
      cur = cur ? { start: cur.start, end: e } : { start: s, end: e };
    }
    if (cur) segs.push(cur);
  }
  return segs;
}

function pickDefaultVoice(voices, text) {
  const lang = /[\u0900-\u097F]/.test(text) ? "hi" : "en";
  const pool = voices.filter((v) => v.lang.toLowerCase().startsWith(lang));
  const list = pool.length ? pool : voices;
  return (
    list.find((v) => /natural|online|google/i.test(v.name)) ||
    list.find((v) => /en-IN/i.test(v.lang)) ||
    list[0]
  );
}

export default function AudioPlayer({ text = "" }) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const segs = useMemo(() => buildSegments(text), [text]);

  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [status, setStatus] = useState("idle"); // idle | playing | paused
  const [active, setActive] = useState(-1);
  const [word, setWord] = useState(null);

  const tokenRef = useRef(0);
  const activeRef = useRef(-1);
  const statusRef = useRef("idle");
  const dirtyRef = useRef(false);
  const settingsRef = useRef({});
  const voicesRef = useRef([]);
  const boxRef = useRef(null);
  const activeEl = useRef(null);
  const firstRun = useRef(true);

  settingsRef.current = { voiceURI, rate, pitch, volume };
  voicesRef.current = voices;
  statusRef.current = status;

  // load voices (they arrive asynchronously)
  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => {
      const v = synth.getVoices();
      if (v.length) setVoices(v);
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, [supported]);

  useEffect(() => {
    if (voices.length && !voiceURI) {
      const v = pickDefaultVoice(voices, text);
      if (v) setVoiceURI(v.voiceURI);
    }
  }, [voices, voiceURI, text]);

  const sortedVoices = useMemo(() => {
    const pref = /[\u0900-\u097F]/.test(text) ? "hi" : "en";
    return [...voices].sort((a, b) => {
      const pa = a.lang.toLowerCase().startsWith(pref) ? 0 : 1;
      const pb = b.lang.toLowerCase().startsWith(pref) ? 0 : 1;
      return pa - pb || a.name.localeCompare(b.name);
    });
  }, [voices, text]);

  const stop = useCallback(() => {
    tokenRef.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    activeRef.current = -1;
    dirtyRef.current = false;
    setStatus("idle");
    setActive(-1);
    setWord(null);
  }, []);

  // stop when the text changes or the component unmounts
  useEffect(() => stop, [text, stop]);

  const speakFrom = useCallback(
    (from) => {
      if (!segs.length) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const token = ++tokenRef.current;
      const s = settingsRef.current;
      const voice = voicesRef.current.find((v) => v.voiceURI === s.voiceURI);
      dirtyRef.current = false;

      for (let i = from; i < segs.length; i++) {
        const seg = segs[i];
        const raw = text.slice(seg.start, seg.end);
        const spoken = raw.trimStart();
        const lead = raw.length - spoken.length;
        const u = new SpeechSynthesisUtterance(spoken);
        if (voice) {
          u.voice = voice;
          u.lang = voice.lang;
        }
        u.rate = s.rate;
        u.pitch = s.pitch;
        u.volume = s.volume;

        u.onstart = () => {
          if (token !== tokenRef.current) return;
          activeRef.current = i;
          setActive(i);
          setWord(null);
        };
        u.onboundary = (e) => {
          if (token !== tokenRef.current) return;
          if (e.name && e.name !== "word") return;
          const abs = seg.start + lead + e.charIndex;
          const m = text.slice(abs).match(/^[^\s]+/);
          const len = e.charLength || (m ? m[0].replace(/[.,;:!?]+$/, "").length : 0);
          if (len) setWord({ start: abs, end: abs + len });
        };
        if (i === segs.length - 1) {
          u.onend = () => {
            if (token !== tokenRef.current) return;
            stop();
          };
        }
        u.onerror = (e) => {
          if (token !== tokenRef.current) return;
          if (e.error === "interrupted" || e.error === "canceled") return;
          stop();
        };
        synth.speak(u);
      }
      activeRef.current = from;
      setActive(from);
      setWord(null);
      setStatus("playing");
    },
    [segs, text, stop]
  );

  const pause = () => {
    window.speechSynthesis.pause();
    setStatus("paused");
  };
  const resume = () => {
    if (dirtyRef.current) speakFrom(Math.max(activeRef.current, 0));
    else {
      window.speechSynthesis.resume();
      setStatus("playing");
    }
  };
  const mainClick = () => {
    if (status === "idle") speakFrom(0);
    else if (status === "playing") pause();
    else resume();
  };
  const jump = (d) => {
    const n = Math.min(segs.length - 1, Math.max(0, (activeRef.current < 0 ? 0 : activeRef.current) + d));
    speakFrom(n);
  };

  // changing voice / speed / pitch / volume while speaking: restart this sentence with new settings
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (statusRef.current === "playing") {
      const t = setTimeout(() => speakFrom(Math.max(activeRef.current, 0)), 300);
      return () => clearTimeout(t);
    }
    if (statusRef.current === "paused") dirtyRef.current = true;
  }, [voiceURI, rate, pitch, volume, speakFrom]);

  // keep the active sentence in view inside the text box
  useEffect(() => {
    const box = boxRef.current;
    const el = activeEl.current;
    if (!box || !el) return;
    if (el.offsetTop < box.scrollTop || el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: Math.max(0, el.offsetTop - box.clientHeight / 3), behavior: "smooth" });
    }
  }, [active]);

  const loudAndClear = () => {
    setVolume(1);
    setRate(0.9);
    setPitch(1);
  };

  if (!supported) return <p className="ap-warn">Your browser doesn't support text-to-speech. Try Chrome or Edge.</p>;

  // build the highlighted text
  const pieces = [];
  let pos = 0;
  segs.forEach((s, i) => {
    if (s.start > pos) pieces.push(<span key={"g" + i}>{text.slice(pos, s.start)}</span>);
    const isActive = i === active;
    const w = isActive && word && word.start >= s.start && word.end <= s.end ? word : null;
    pieces.push(
      <span
        key={"s" + i}
        ref={isActive ? activeEl : null}
        className={"ap-sent" + (isActive ? " is-active" : "")}
        onClick={() => speakFrom(i)}
        title="Click to read from here"
      >
        {w ? (
          <>
            {text.slice(s.start, w.start)}
            <mark className="ap-word">{text.slice(w.start, w.end)}</mark>
            {text.slice(w.end, s.end)}
          </>
        ) : (
          text.slice(s.start, s.end)
        )}
      </span>
    );
    pos = s.end;
  });
  if (pos < text.length) pieces.push(<span key="tail">{text.slice(pos)}</span>);

  const pct = segs.length && active >= 0 ? ((active + 1) / segs.length) * 100 : 0;

  return (
    <div className="ap">
      <div className="ap-controls">
        <button className="ap-btn" onClick={() => jump(-1)} disabled={status === "idle"} aria-label="Previous sentence">⏮</button>
        <button className="ap-btn ap-main" onClick={mainClick}>
          {status === "playing" ? "⏸ Pause" : status === "paused" ? "▶ Resume" : "▶ Listen"}
        </button>
        <button className="ap-btn" onClick={() => jump(1)} disabled={status === "idle"} aria-label="Next sentence">⏭</button>
        <button className="ap-btn" onClick={stop} disabled={status === "idle"}>⏹ Stop</button>
      </div>

      <div className="ap-progress"><div style={{ width: pct + "%" }} /></div>

      <div className="ap-text" ref={boxRef}>{pieces}</div>

      <div className="ap-settings">
        <label className="ap-field ap-wide">
          Voice
          <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
            {sortedVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
            ))}
          </select>
        </label>
        <label className="ap-field">
          Speed {rate.toFixed(1)}x
          <input type="range" min="0.5" max="1.5" step="0.1" value={rate} onChange={(e) => setRate(+e.target.value)} />
        </label>
        <label className="ap-field">
          Pitch {pitch.toFixed(1)}
          <input type="range" min="0.5" max="1.5" step="0.1" value={pitch} onChange={(e) => setPitch(+e.target.value)} />
        </label>
        <label className="ap-field">
          Volume {Math.round(volume * 100)}%
          <input type="range" min="0" max="1" step="0.05" value={volume} onChange={(e) => setVolume(+e.target.value)} />
        </label>
        <button className="ap-btn ap-loud" onClick={loudAndClear}>🔊 Loud & clear</button>
      </div>
    </div>
  );
}