import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Goalie Forge | SCS Saints Goalie Development",
  description: "A real-world training game for youth hockey goalies, built for safe off-ice development across the St. Clair Shores Saints organization.",
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
