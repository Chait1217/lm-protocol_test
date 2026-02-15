/// Format USDC amount (6 decimals) to display string
export function formatUSDC(amount: bigint | undefined, decimals = 2): string {
  if (amount === undefined) return "0.00";
  const num = Number(amount) / 1e6;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/// Parse human-readable USDC amount to bigint (6 decimals)
export function parseUSDC(amount: string): bigint {
  const num = parseFloat(amount);
  if (isNaN(num) || num < 0) return 0n;
  return BigInt(Math.round(num * 1e6));
}

/// Format price (6 decimal mock price) to display
export function formatPrice(price: bigint | number): string {
  const num = typeof price === "bigint" ? Number(price) / 1e6 : price / 1e6;
  return `$${num.toFixed(4)}`;
}

/// Parse human-readable price to 6-decimal integer
export function parsePrice(price: string): bigint {
  const num = parseFloat(price);
  if (isNaN(num) || num < 0) return 0n;
  return BigInt(Math.round(num * 1e6));
}

/// Format bps to percentage string
export function bpsToPercent(bps: bigint | number, decimals = 2): string {
  const num = typeof bps === "bigint" ? Number(bps) : bps;
  return (num / 100).toFixed(decimals) + "%";
}

/// Shorten address
export function shortenAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}
