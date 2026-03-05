"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface DataPoint {
  t: number;
  p: number;
}

interface Props {
  refreshMs?: number;
}

const INTERVALS = [
  { label: "6H", value: "6h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "MAX", value: "max" },
];

export default function PolymarketLiveChart({ refreshMs = 5000 }: Props) {
  const [history, setHistory] = useState<DataPoint[]>([]);
  const [interval, setInterval_] = useState("1d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<DataPoint | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/polymarket-history?interval=${interval}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.history) && data.history.length > 0) {
        setHistory(data.history);
        setError(null);
      } else {
        setError(data.error || "No data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    }
    setLoading(false);
  }, [interval]);

  const fetchRef = useRef(fetchHistory);
  fetchRef.current = fetchHistory;

  useEffect(() => {
    setLoading(true);
    fetchRef.current();
    const id = setInterval(() => fetchRef.current(), refreshMs);
    return () => clearInterval(id);
  }, [interval, refreshMs]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const PAD_TOP = 10;
    const PAD_BOTTOM = 20;
    const PAD_LEFT = 0;
    const PAD_RIGHT = 0;

    const prices = history.map((d) => d.p);
    const minP = Math.min(...prices) - 0.01;
    const maxP = Math.max(...prices) + 0.01;
    const rangeP = maxP - minP || 0.01;

    const xScale = (i: number) => PAD_LEFT + (i / (history.length - 1)) * (W - PAD_LEFT - PAD_RIGHT);
    const yScale = (p: number) => PAD_TOP + (1 - (p - minP) / rangeP) * (H - PAD_TOP - PAD_BOTTOM);

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = PAD_TOP + (i / 4) * (H - PAD_TOP - PAD_BOTTOM);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, PAD_TOP, 0, H - PAD_BOTTOM);
    gradient.addColorStop(0, "rgba(0, 255, 136, 0.15)");
    gradient.addColorStop(1, "rgba(0, 255, 136, 0.0)");

    ctx.beginPath();
    ctx.moveTo(xScale(0), H - PAD_BOTTOM);
    for (let i = 0; i < history.length; i++) {
      ctx.lineTo(xScale(i), yScale(history[i].p));
    }
    ctx.lineTo(xScale(history.length - 1), H - PAD_BOTTOM);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(history[0].p));
    for (let i = 1; i < history.length; i++) {
      ctx.lineTo(xScale(i), yScale(history[i].p));
    }
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Current price dot
    const lastIdx = history.length - 1;
    const lastX = xScale(lastIdx);
    const lastY = yScale(history[lastIdx].p);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#00ff88";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 255, 136, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Price labels on Y axis
    ctx.fillStyle = "#555";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    for (let i = 0; i <= 4; i++) {
      const p = minP + (rangeP * (4 - i)) / 4;
      const y = PAD_TOP + (i / 4) * (H - PAD_TOP - PAD_BOTTOM);
      ctx.fillText((p * 100).toFixed(0) + "¢", 4, y - 3);
    }

    // Hover crosshair
    if (hover) {
      const hIdx = history.findIndex((d) => d.t === hover.t);
      if (hIdx >= 0) {
        const hx = xScale(hIdx);
        const hy = yScale(hover.p);

        // Vertical line
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hx, PAD_TOP);
        ctx.lineTo(hx, H - PAD_BOTTOM);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dot
        ctx.beginPath();
        ctx.arc(hx, hy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#00ff88";
        ctx.fill();

        // Tooltip
        const date = new Date(hover.t * 1000);
        const label = `${(hover.p * 100).toFixed(1)}¢ — ${date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        const tw = ctx.measureText(label).width + 16;
        const tx = Math.min(hx - tw / 2, W - tw - 4);
        ctx.fillRect(Math.max(4, tx), hy - 28, tw, 20);
        ctx.fillStyle = "#00ff88";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(label, Math.max(12, tx + 8), hy - 14);
      }
    }
  }, [history, hover]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (history.length < 2) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const idx = Math.round((x / rect.width) * (history.length - 1));
      const clamped = Math.max(0, Math.min(history.length - 1, idx));
      setHover(history[clamped]);
    },
    [history]
  );

  const lastPrice = history.length > 0 ? history[history.length - 1].p : null;
  const firstPrice = history.length > 0 ? history[0].p : null;
  const change =
    lastPrice != null && firstPrice != null && firstPrice > 0
      ? ((lastPrice - firstPrice) / firstPrice) * 100
      : null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Price Chart</h3>
          {lastPrice != null && (
            <span className="text-sm font-bold mono text-[#00ff88]">
              {(lastPrice * 100).toFixed(1)}¢
            </span>
          )}
          {change != null && (
            <span
              className={`text-[10px] font-bold mono px-1.5 py-0.5 rounded ${
                change >= 0
                  ? "bg-[#00ff88]/10 text-[#00ff88]"
                  : "bg-red-500/10 text-red-400"
              }`}
            >
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setInterval_(iv.value)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                interval === iv.value
                  ? "bg-[#00ff88]/15 text-[#00ff88] border border-[#00ff88]/30"
                  : "text-[#666] hover:text-[#999] border border-transparent"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 py-4">
        {loading && history.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="flex items-center gap-2 text-[#555] text-sm">
              <div className="spinner" />
              Loading chart...
            </div>
          </div>
        ) : error && history.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-red-400 text-xs">
            {error}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-[200px] cursor-crosshair"
            style={{ width: "100%", height: "200px" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHover(null)}
          />
        )}
      </div>
    </div>
  );
}
