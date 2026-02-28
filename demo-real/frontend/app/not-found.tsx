import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-white mb-2">404 – Page not found</h1>
      <p className="text-gray-400 mb-6">The page you’re looking for doesn’t exist or failed to load.</p>
      <Link
        href="/"
        className="text-emerald-400 hover:underline"
      >
        ← Back to Home
      </Link>
      <Link
        href="/trade-demo"
        className="mt-3 text-emerald-400 hover:underline block"
      >
        Go to Trade Demo →
      </Link>
    </div>
  );
}
