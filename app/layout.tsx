import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "رموز الحق | Symbols of Truth",
  description: "Encrypted tactical comms and situational awareness",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#05080a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
