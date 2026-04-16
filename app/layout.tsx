import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mbembembe Downloader",
  description:
    "A Next.js control panel for late-night yt-dlp downloads inspired by the original Mbembembe batch script.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
