"use client";

import { useEffect, useState } from "react";
import HomeLanding from "@/components/HomeLanding";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return <HomeLanding />;
}
