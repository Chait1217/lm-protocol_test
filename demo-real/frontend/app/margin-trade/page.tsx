"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MarginTradeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/transactions");
  }, [router]);
  return (
    <div className="flex min-h-[200px] items-center justify-center text-gray-400 text-sm">
      Redirecting to Transactions…
    </div>
  );
}
