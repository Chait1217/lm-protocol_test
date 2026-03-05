"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface PricePoint {
  t: number;
  p: number;
}

type Interval = "1m" | "5m" | "1h" | "6h" | "1d" | "1w";

const INTERVAL_LABELS: { key: Interval; label: string }[] = [
  { key: "1m", label: "1M" },
  { key: "5m", label: "5M" },
  { key: "1h", label: "1H" },
  { key: "6h", label: "6H" },
  { key: "1d", label: "1D" },
  { key: "1w", label: "1W" },
];

// *** 1-SECOND REFRESH for 1m and 5m, fast refresh for others ***
const REFRESH_MS: Record<Interval, number> = {
  "1m": 1000,    // every 1s
  "5m": 1000,    // every 1s
  "1h": 3000,    // every 3s
  "6h": 5000,    // every 5s
  "1d": 10000,   // every 10s
  "1w": 30000,   // every 30s
};

export default function PolymarketLiveChart() {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval_] = useState<Interval>("1h");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback(async (iv: Interval) => {
    try {
      const res = await fetch(`/api/polymarket-history?interval=${iv}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.history && data.history.length > 0) {
          setHistory(data.history);
        }
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  // Fetch on mount and on interval change, with live refresh
  useEffect(() => {
    setLoading(true);
    fetchHistory(interval);
    const id = window.setInterval(() => fetchHistory(interval), REFRESH_MS[interval]);
    return () => window.clearInterval(id);
  }, [interval, fetchHistory]);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || history.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const pad = { top: 20, right: 10, bottom: 30, left: 50 };

    const prices = history.map((p) => p.p);
    const minP = Math.max(0, Math.min(...prices) - 0.03);
    const maxP = Math.min(1, Math.max(...prices) + 0.03);
    const minT = history[0].t;
    const maxT = history[history.length - 1].t;

    const xScale = (t: number) => pad.left + ((t - minT) / (maxT - minT || 1)) * (w - pad.left - pad.right);
    const yScale = (p: number) => pad.top + ((maxP - p) / (maxP - minP || 1)) * (h - pad.top - pad.bottom);

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (i / gridLines) * (h - pad.top - pad.bottom);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      const price = maxP - (i / gridLines) * (maxP - minP);
      ctx.fillStyle = "#555";
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${(price * 100).toFixed(0)}%`, pad.left - 8, y + 3);
    }

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
    gradient.addColorStop(0, "rgba(0, 255, 136, 0.12)");
    gradient.addColorStop(1, "rgba(0, 255, 136, 0)");

    ctx.beginPath();
    ctx.moveTo(xScale(history[0].t), h - pad.bottom);
    history.forEach((p) => ctx.lineTo(xScale(p.t), yScale(p.p)));
    ctx.lineTo(xScale(history[history.length - 1].t), h - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    history.forEach((p, i) => {
      const x = xScale(p.t);
      const y = yScale(p.p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Glow
    ctx.beginPath();
    ctx.strokeStyle = "rgba(0, 255, 136, 0.3)";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.filter = "blur(4px)";
    history.forEach((p, i) => {
      const x = xScale(p.t);
      const y = yScale(p.p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.filter = "none";

    // Current price dot
    const lastP = history[history.length - 1];
    ctx.beginPath();
    ctx.arc(xScale(lastP.t), yScale(lastP.p), 4, 0, Math.PI * 2);
    ctx.fillStyle = "#00ff88";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(xScale(lastP.t), yScale(lastP.p), 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 255, 136, 0.2)";
    ctx.fill();

    // Hovered point
    if (hoveredIdx != null && hoveredIdx >= 0 && hoveredIdx < history.length) {
      const hp = history[hoveredIdx];
      const hx = xScale(hp.t);
      const hy = yScale(hp.p);

      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hx, pad.top);
      ctx.lineTo(hx, h - pad.bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pad.left, hy);
      ctx.lineTo(w - pad.right, hy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();

      const label = `${(hp.p * 100).toFixed(1)}% — ${new Date(hp.t * 1000).toLocaleString()}`;
      ctx.font = "11px 'JetBrains Mono', monospace";
      const tw = ctx.measureText(label).width + 16;
      const tx = Math.min(hx - tw / 2, w - tw - 5);
      const ty = hy - 30;
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.beginPath();
      ctx.roundRect(Math.max(5, tx), ty, tw, 22, 6);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(label, Math.max(5, tx) + tw / 2, ty + 15);
    }
  }, [history, hoveredIdx]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container || history.length < 2) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pad = { left: 50, right: 10 };
      const chartWidth = rect.width - pad.left - pad.right;
      const ratio = (x - pad.left) / chartWidth;

      if (ratio < 0 || ratio > 1) {
        setHoveredIdx(null);
        return;
      }

      const idx = Math.round(ratio * (history.length - 1));
      setHoveredIdx(Math.max(0, Math.min(idx, history.length - 1)));
    },
    [history]
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-6 min-h-[260px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#555] text-sm">
          <div className="spinner" />
          Loading chart data...
        </div>
      </div>
    );
  }

  if (history.length < 2) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-6 min-h-[260px] flex items-center justify-center">
        <span className="text-[#555] text-sm">No chart data available</span>
      </div>
    );
  }

  const currentPrice = history[history.length - 1]?.p;
  const firstPrice = history[0]?.p;
  const priceChange = currentPrice && firstPrice ? currentPrice - firstPrice : 0;
  const priceChangeColor = priceChange >= 0 ? "text-[#00ff88]" : "text-red-400";

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Price Chart</h3>
          <span className="text-[10px] text-[#666] uppercase tracking-wider font-medium">YES Token</span>
        </div>
        <div className="flex items-center gap-3">
          {currentPrice != null && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#00ff88] mono">
                {(currentPrice * 100).toFixed(1)}%
              </span>
              <span className={`text-xs mono ${priceChangeColor}`}>
                {priceChange >= 0 ? "+" : ""}{(priceChange * 100).toFixed(1)}%
              </span>
            </div>
          )}
          <div className="flex gap-1 bg-white/[0.02] rounded-lg p-0.5">
            {INTERVAL_LABELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setInterval_(key)}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                  interval === key
                    ? "bg-[#00ff88]/10 text-[#00ff88]"
                    : "text-[#666] hover:text-[#999]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        className="relative w-full h-[240px]"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIdx(null)}
        />
      </div>
    </div>
  );
}
