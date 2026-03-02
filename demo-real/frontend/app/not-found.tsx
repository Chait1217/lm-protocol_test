"use client";

import TradeDemoPage from "./trade-demo/page";

export default function NotFound() {
  // Fallback: if Next.js routes to the app's not-found boundary for any URL
  // (including "/" or "/trade-demo"), render the main Trade Demo experience
  // instead of a dead-end 404 screen.
  return <TradeDemoPage />;
}
