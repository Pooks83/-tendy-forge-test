import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goalie Forge | Real-world training game for youth hockey goalies",
  description: "A real-world training game for youth hockey goalies, built around safe off-ice development.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
