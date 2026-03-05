"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Live chart fetching from /api/polymarket-history which calls:
 *   GET https://clob.polymarket.com/prices-history?market={YES_TOKEN}&interval={interval}&fidelity={fidelity}
 *   Response: { history: [{ t: unix_seconds, p: decimal_price }, ...] }
 *
 * Verified data points:
 *   1h  → ~2 points   (too few, use 6h minimum for short view)
 *   1d  → ~25 points
 *   1w  → ~169 points
 *   max → ~404 points
 */

type Interval = "6h" | "1d" | "1w" | "max";

const INTERVALS: { key: Interval; label: string; fidelity: number; refreshMs: number }[] = [
  { key: "6h",  label: "6H",  fidelity: 60,  refreshMs: 3000 },
  { key: "1d",  label: "1D",  fidelity: 60,  refreshMs: 5000 },
  { key: "1w",  label: "1W",  fidelity: 60,  refreshMs: 10000 },
  { key: "max", label: "ALL", fidelity: 100, refreshMs: 30000 },
];

interface DataPoint {
  t: number; // unix seconds
  p: number; // price decimal (e.g. 0.385 = 38.5%)
}

export default function PolymarketLiveChart() {
  const [interval, setInterval_] = useState<Interval>("1d");
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; point: DataPoint } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const intervalConfig = INTERVALS.find((i) => i.key === interval) || INTERVALS[1];

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/polymarket-history?interval=${interval}&fidelity=${intervalConfig.fidelity}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed");
      if (json.history && json.history.length > 0) {
        setData(json.history);
        setError(null);
      } else if (data.length === 0) {
        setError("No chart data available");
      }
    } catch (err) {
      if (data.length === 0) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    setLoading(false);
  }, [interval, intervalConfig.fidelity]);

  // Fetch on mount and on interval change
  useEffect(() => {
    setLoading(true);
    fetchHistory();
  }, [interval]);

  // Auto-refresh
  useEffect(() => {
    const id = window.setInterval(fetchHistory, intervalConfig.refreshMs);
    return () => window.clearInterval(id);
  }, [fetchHistory, intervalConfig.refreshMs]);

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || data.length < 2) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = 280;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Compute bounds
    const prices = data.map((d) => d.p);
    const minP = Math.min(...prices);
    const maxP = Math.max(...prices);
    const range = maxP - minP || 0.01;
    const pad = range * 0.15;
    const yMin = minP - pad;
    const yMax = maxP + pad;

    const marginLeft = 50;
    const marginRight = 15;
    const marginTop = 15;
    const marginBottom = 30;
    const chartW = w - marginLeft - marginRight;
    const chartH = h - marginTop - marginBottom;

    const toX = (i: number) => marginLeft + (i / (data.length - 1)) * chartW;
    const toY = (p: number) => marginTop + (1 - (p - yMin) / (yMax - yMin)) * chartH;

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = marginTop + (i / gridLines) * chartH;
      ctx.beginPath();
      ctx.moveTo(marginLeft, y);
      ctx.lineTo(w - marginRight, y);
      ctx.stroke();

      // Y-axis labels
      const price = yMax - (i / gridLines) * (yMax - yMin);
      ctx.fillStyle = "#555";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText((price * 100).toFixed(1) + "¢", marginLeft - 8, y + 3);
    }

    // X-axis labels
    const labelCount = Math.min(5, data.length);
    ctx.fillStyle = "#555";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.floor((i / (labelCount - 1)) * (data.length - 1));
      const x = toX(idx);
      const date = new Date(data[idx].t * 1000);
      let label: string;
      if (interval === "6h") {
        label = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (interval === "1d") {
        label = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else {
        label = date.toLocaleDateString([], { month: "short", day: "numeric" });
      }
      ctx.fillText(label, x, h - 8);
    }

    // Line path
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = toX(i);
      const y = toY(d.p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Glow effect
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00ff88";
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, marginTop, 0, marginTop + chartH);
    gradient.addColorStop(0, "rgba(0,255,136,0.12)");
    gradient.addColorStop(1, "rgba(0,255,136,0)");
    ctx.lineTo(toX(data.length - 1), marginTop + chartH);
    ctx.lineTo(toX(0), marginTop + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Current price dot
    const lastPoint = data[data.length - 1];
    const lastX = toX(data.length - 1);
    const lastY = toY(lastPoint.p);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#00ff88";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0,255,136,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hover crosshair
    if (hover) {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(hover.x, marginTop);
      ctx.lineTo(hover.x, marginTop + chartH);
      ctx.stroke();
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(marginLeft, hover.y);
      ctx.lineTo(w - marginRight, hover.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tooltip
      const tooltipW = 120;
      const tooltipH = 40;
      let tx = hover.x + 10;
      let ty = hover.y - 45;
      if (tx + tooltipW > w) tx = hover.x - tooltipW - 10;
      if (ty < 0) ty = hover.y + 10;

      ctx.fillStyle = "rgba(10,10,10,0.9)";
      ctx.strokeStyle = "rgba(0,255,136,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tx, ty, tooltipW, tooltipH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#00ff88";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "left";
      ctx.fillText((hover.point.p * 100).toFixed(1) + "¢", tx + 8, ty + 16);

      ctx.fillStyle = "#888";
      ctx.font = "10px monospace";
      const hoverDate = new Date(hover.point.t * 1000);
      ctx.fillText(
        hoverDate.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        tx + 8,
        ty + 32
      );
    }
  }, [data, hover, interval]);

  // Mouse handlers
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (data.length < 2 || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const marginLeft = 50;
      const marginRight = 15;
      const chartW = rect.width - marginLeft - marginRight;

      const ratio = (x - marginLeft) / chartW;
      const idx = Math.max(0, Math.min(data.length - 1, Math.round(ratio * (data.length - 1))));
      const point = data[idx];

      const marginTop = 15;
      const marginBottom = 30;
      const chartH = 280 - marginTop - marginBottom;
      const prices = data.map((d) => d.p);
      const minP = Math.min(...prices);
      const maxP = Math.max(...prices);
      const range = maxP - minP || 0.01;
      const pad = range * 0.15;
      const yMin = minP - pad;
      const yMax = maxP + pad;
      const y = marginTop + (1 - (point.p - yMin) / (yMax - yMin)) * chartH;

      setHover({ x: marginLeft + (idx / (data.length - 1)) * chartW, y, point });
    },
    [data]
  );

  const handleMouseLeave = useCallback(() => setHover(null), []);

  // Current price and change
  const currentPrice = data.length > 0 ? data[data.length - 1].p : null;
  const startPrice = data.length > 0 ? data[0].p : null;
  const priceChange = currentPrice != null && startPrice != null ? currentPrice - startPrice : null;
  const priceChangePct = priceChange != null && startPrice != null && startPrice > 0 ? (priceChange / startPrice) * 100 : null;

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">YES Price</h3>
          {currentPrice != null && (
            <span className="text-lg font-bold text-[#00ff88] mono">{(currentPrice * 100).toFixed(1)}¢</span>
          )}
          {priceChange != null && (
            <span className={`text-xs font-semibold mono ${priceChange >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
              {priceChange >= 0 ? "+" : ""}{(priceChange * 100).toFixed(1)}¢
              ({priceChangePct != null ? (priceChangePct >= 0 ? "+" : "") + priceChangePct.toFixed(1) + "%" : ""})
            </span>
          )}
        </div>

        {/* Interval Selector */}
        <div className="flex items-center gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.key}
              onClick={() => setInterval_(iv.key)}
              className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                interval === iv.key
                  ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30"
                  : "text-[#666] hover:text-[#999] border border-transparent"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} className="relative px-2 py-4" style={{ minHeight: 280 }}>
        {loading && data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px]">
            <div className="flex items-center gap-2 text-[#666] text-sm">
              <div className="spinner" />
              Loading chart...
            </div>
          </div>
        ) : error && data.length === 0 ? (
          <div className="flex items-center justify-center h-[280px]">
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="cursor-crosshair w-full"
            style={{ height: 280 }}
          />
        )}
      </div>
    </div>
  );
}
