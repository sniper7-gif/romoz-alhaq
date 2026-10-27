import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import MatrixRain from "@/components/matrix-rain";
import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jb", display: "swap" });

export const metadata: Metadata = {
  title: "L.I.S | Symbols of Truth",
  description: "Encrypted tactical comms and situational awareness",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={mono.variable}>
      <body className="min-h-screen antialiased">
        <MatrixRain />
        <div className="crt" aria-hidden />
        {children}
      </body>
    </html>
  );
}
