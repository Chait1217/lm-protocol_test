import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "LM Protocol - Real Demo",
  description: "Real onchain leveraged prediction market prototype",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#050505] text-gray-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
