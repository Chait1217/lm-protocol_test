"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface PricePoint {
  t: number;
  p: number;
}

const INTERVALS = [
  { label: "6H", value: "6h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "ALL", value: "max" },
];

export default function PolymarketLiveChart() {
  const [interval, setInterval_] = useState("1d");
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    point: PricePoint;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/polymarket-history?interval=${interval}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.history) && data.history.length > 0) {
        setHistory(data.history);
        setError(null);
      } else {
        setError("No chart data available");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chart");
    }
    setLoading(false);
  }, [interval]);

  // Fetch on mount and interval change
  useEffect(() => {
    setLoading(true);
    fetchHistory();
    // Auto-refresh: 5s for short intervals, 30s for long
    const refreshMs = interval === "6h" ? 5000 : interval === "1d" ? 10000 : 30000;
    const id = window.setInterval(fetchHistory, refreshMs);
    return () => window.clearInterval(id);
  }, [fetchHistory, interval]);

  // Draw chart on canvas
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
    const PAD_TOP = 20;
    const PAD_BOTTOM = 30;
    const PAD_LEFT = 50;
    const PAD_RIGHT = 20;
    const chartW = W - PAD_LEFT - PAD_RIGHT;
    const chartH = H - PAD_TOP - PAD_BOTTOM;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Price range
    const prices = history.map((h) => h.p);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 0.01;
    const padRange = range * 0.1;
    const yMin = minP - padRange;
    const yMax = maxP + padRange;

    const toX = (i: number) => PAD_LEFT + (i / (history.length - 1)) * chartW;
    const toY = (p: number) =>
      PAD_TOP + (1 - (p - yMin) / (yMax - yMin)) * chartH;

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = PAD_TOP + (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, y);
      ctx.lineTo(W - PAD_RIGHT, y);
      ctx.stroke();

      // Y-axis labels
      const price = yMax - (i / gridLines) * (yMax - yMin);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${(price * 100).toFixed(1)}¢`, PAD_LEFT - 6, y + 3);
    }

    // X-axis labels
    const xLabels = Math.min(6, history.length);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < xLabels; i++) {
      const idx = Math.floor((i / (xLabels - 1)) * (history.length - 1));
      const x = toX(idx);
      const date = new Date(history[idx].t * 1000);
      let label: string;
      if (interval === "6h" || interval === "1d") {
        label = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      } else {
        label = date.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        });
      }
      ctx.fillText(label, x, H - 8);
    }

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, PAD_TOP, 0, H - PAD_BOTTOM);
    gradient.addColorStop(0, "rgba(16, 185, 129, 0.15)");
    gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");

    ctx.beginPath();
    ctx.moveTo(toX(0), H - PAD_BOTTOM);
    for (let i = 0; i < history.length; i++) {
      ctx.lineTo(toX(i), toY(history[i].p));
    }
    ctx.lineTo(toX(history.length - 1), H - PAD_BOTTOM);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < history.length; i++) {
      const x = toX(i);
      const y = toY(history[i].p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Current price dot
    const lastPoint = history[history.length - 1];
    const lastX = toX(history.length - 1);
    const lastY = toY(lastPoint.p);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#10b981";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hover crosshair
    if (hover) {
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(hover.x, PAD_TOP);
      ctx.lineTo(hover.x, H - PAD_BOTTOM);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PAD_LEFT, hover.y);
      ctx.lineTo(W - PAD_RIGHT, hover.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tooltip
      const tooltipW = 120;
      const tooltipH = 40;
      let tx = hover.x + 12;
      let ty = hover.y - tooltipH - 8;
      if (tx + tooltipW > W) tx = hover.x - tooltipW - 12;
      if (ty < 0) ty = hover.y + 12;

      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.beginPath();
      ctx.roundRect(tx, ty, tooltipW, tooltipH, 6);
      ctx.fill();
      ctx.strokeStyle = "rgba(16, 185, 129, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#10b981";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "left";
      ctx.fillText(
        `${(hover.point.p * 100).toFixed(1)}¢`,
        tx + 8,
        ty + 16
      );

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "10px monospace";
      const hoverDate = new Date(hover.point.t * 1000);
      ctx.fillText(
        hoverDate.toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        tx + 8,
        ty + 32
      );

      // Hover dot
      ctx.beginPath();
      ctx.arc(hover.x, hover.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#10b981";
      ctx.fill();
    }
  }, [history, hover, interval]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || history.length < 2) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const W = rect.width;
      const H = rect.height;
      const PAD_LEFT = 50;
      const PAD_RIGHT = 20;
      const PAD_TOP = 20;
      const PAD_BOTTOM = 30;
      const chartW = W - PAD_LEFT - PAD_RIGHT;
      const chartH = H - PAD_TOP - PAD_BOTTOM;

      const relX = (mouseX - PAD_LEFT) / chartW;
      if (relX < 0 || relX > 1) {
        setHover(null);
        return;
      }

      const idx = Math.round(relX * (history.length - 1));
      const point = history[Math.max(0, Math.min(idx, history.length - 1))];

      const prices = history.map((h) => h.p);
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const range = maxP - minP || 0.01;
      const padRange = range * 0.1;
      const yMin = minP - padRange;
      const yMax = maxP + padRange;

      const x = PAD_LEFT + (idx / (history.length - 1)) * chartW;
      const y = PAD_TOP + (1 - (point.p - yMin) / (yMax - yMin)) * chartH;

      setHover({ x, y, point });
    },
    [history]
  );

  return (
    <div className="rounded-xl border border-emerald-900/30 bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-emerald-900/20">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">YES Price</span>
          {history.length > 0 && (
            <span className="text-emerald-400 font-bold text-sm font-mono">
              {(history[history.length - 1].p * 100).toFixed(1)}¢
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.value}
              onClick={() => setInterval_(iv.value)}
              className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                interval === iv.value
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-gray-500 hover:text-gray-300 border border-transparent"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: 280 }}>
        {loading && history.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="spinner" />
              Loading chart…
            </div>
          </div>
        ) : error && history.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-red-400 text-xs">
            {error}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-crosshair"
            style={{ width: "100%", height: 280 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHover(null)}
          />
        )}
      </div>
    </div>
  );
}
