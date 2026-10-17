import { useEffect, useRef, useState, useCallback } from "react";
import mermaid from "mermaid";
import "./MermaidView.css";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  themeVariables: {
    fontFamily: "inherit",
    primaryColor: "#eef2ff",
    primaryBorderColor: "#6366f1",
    primaryTextColor: "#1e1b4b",
    lineColor: "#818cf8",
    secondaryColor: "#ecfeff",
    tertiaryColor: "#ffffff",
  },
  flowchart: { curve: "basis", htmlLabels: true, useMaxWidth: false, padding: 12, nodeSpacing: 40, rankSpacing: 50 },
});

const clean = (s = "") =>
  s.replace(/```mermaid|```/gi, "").replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

export default function MermaidView({ code, onRetry }) {
  const rootRef = useRef(null);
  const viewRef = useRef(null);
  const canvasRef = useRef(null);
  const drag = useRef(null);
  const size = useRef({ w: 0, h: 0 });

  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [errMsg, setErrMsg] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [full, setFull] = useState(false);
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });

  const fit = useCallback(() => {
    const el = viewRef.current;
    const { w, h } = size.current;
    if (!el || !w) return;
    const cw = el.clientWidth, ch = el.clientHeight;
    const k = Math.max(0.3, Math.min(1, (cw - 32) / w, (ch - 32) / h));
    setT({ k, x: (cw - w * k) / 2, y: h * k < ch ? (ch - h * k) / 2 : 16 });
  }, []);

  // render the diagram
  useEffect(() => {
    const src = clean(code);
    if (!src) {
      setErrMsg("No diagram received.");
      setStatus("error");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    const id = "mmd-" + Math.random().toString(36).slice(2);
    mermaid
      .render(id, src)
      .then(({ svg }) => {
        if (cancelled) return;
        const host = canvasRef.current;
        host.innerHTML = svg;
        const el = host.querySelector("svg");
        const vb = el.viewBox.baseVal;
        const w = vb.width || el.getBoundingClientRect().width;
        const h = vb.height || el.getBoundingClientRect().height;
        el.setAttribute("width", w);
        el.setAttribute("height", h);
        el.style.maxWidth = "none";
        size.current = { w, h };
        setStatus("ok");
        requestAnimationFrame(fit);
      })
      .catch((e) => {
        if (cancelled) return;
        document.getElementById("d" + id)?.remove(); // mermaid leaves a stray error box
        if (canvasRef.current) canvasRef.current.innerHTML = "";
        setErrMsg(String(e?.message || e).split("\n")[0]);
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, [code, fit]);

  // fullscreen state
  useEffect(() => {
    const h = () => { setFull(!!document.fullscreenElement); setTimeout(fit, 120); };
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, [fit]);

  const zoomAt = (f, cx, cy) =>
    setT((p) => {
      const k = Math.min(4, Math.max(0.1, p.k * f));
      const r = k / p.k;
      return { k, x: cx - (cx - p.x) * r, y: cy - (cy - p.y) * r };
    });
  const zoomCenter = (f) => {
    const el = viewRef.current;
    zoomAt(f, el.clientWidth / 2, el.clientHeight / 2);
  };

  // Ctrl/Cmd + wheel zoom (needs a non-passive listener)
  useEffect(() => {
    const el = viewRef.current;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onDown = (e) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    setT((p) => ({ ...p, x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }));
  };
  const onUp = () => { drag.current = null; };

  const toggleFull = () =>
    document.fullscreenElement ? document.exitFullscreen() : rootRef.current?.requestFullscreen?.();

  return (
    <div className="mv" ref={rootRef}>
      <div className="mv-bar">
        <span className="mv-title">Concept map</span>
        <div className="mv-actions">
          <button onClick={() => zoomCenter(0.8)} aria-label="Zoom out">−</button>
          <span className="mv-zoom">{Math.round(t.k * 100)}%</span>
          <button onClick={() => zoomCenter(1.25)} aria-label="Zoom in">+</button>
          <button onClick={fit}>Fit</button>
          <button onClick={() => setShowCode((s) => !s)}>{showCode ? "Hide code" : "Code"}</button>
          <button onClick={toggleFull} aria-label="Fullscreen">{full ? "Exit" : "⛶"}</button>
        </div>
      </div>

      <div
        className="mv-viewport"
        ref={viewRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div
          ref={canvasRef}
          className={"mv-canvas" + (status === "ok" ? " ready" : "")}
          style={{
            transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`,
            visibility: status === "ok" ? "visible" : "hidden",
          }}
        />
        {status === "loading" && <div className="mv-center"><div className="mv-spinner" />Drawing…</div>}
        {status === "error" && (
          <div className="mv-center mv-error" onPointerDown={(e) => e.stopPropagation()}>
            <strong>Couldn't draw the diagram</strong>
            <small>{errMsg}</small>
            <div>
              {onRetry && <button onClick={onRetry}>Retry</button>}
              <button onClick={() => setShowCode(true)}>Show code</button>
            </div>
          </div>
        )}
        {status === "ok" && <div className="mv-hint">Drag to pan · Ctrl + scroll to zoom</div>}
      </div>

      {showCode && (
        <div className="mv-codewrap">
          <button onClick={() => navigator.clipboard?.writeText(clean(code))}>Copy</button>
          <pre className="mv-code">{clean(code)}</pre>
        </div>
      )}
    </div>
  );
}