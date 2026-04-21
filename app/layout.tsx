import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from 'sonner'
import { PublicAgeGate } from '@/components/layout/PublicAgeGate'
import { CallShell } from '@/components/call/CallShell'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AHAWC Distribution Portal",
  description: "AHAWC Liquor Distributor Management Portal",
  icons: {
    icon: "/brand/logo-badge.png",
    shortcut: "/favicon.ico",
    apple: "/brand/logo-badge.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <CallShell>
          <PublicAgeGate>{children}</PublicAgeGate>
        </CallShell>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
