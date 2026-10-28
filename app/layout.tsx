import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import MatrixRain from "@/components/matrix-rain";
import { I18nProvider } from "@/components/providers";
import { StealthProvider } from "@/components/stealth";
import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jb", display: "swap" });

export const metadata: Metadata = {
  title: "رموز الحق | Symbols of Truth",
  description: "Secure command network",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={mono.variable}>
      <body className="min-h-dvh antialiased">
        <MatrixRain />
        <div className="crt" aria-hidden />
        <I18nProvider>
          <StealthProvider>{children}</StealthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
