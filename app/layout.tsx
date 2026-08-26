import type { Metadata } from "next";
import { Big_Shoulders, DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from 'sonner'
import { PublicAgeGate } from '@/components/layout/PublicAgeGate'
import { CallShell } from '@/components/call/CallShell'
import "./globals.css";

const displayFont = Big_Shoulders({
  variable: "--font-ahawc-display",
  subsets: ["latin"],
  display: "swap",
});

const interfaceFont = DM_Sans({
  variable: "--font-ahawc-interface",
  subsets: ["latin"],
  display: "swap",
});

const dataFont = IBM_Plex_Mono({
  variable: "--font-ahawc-data",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
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
        className={`${displayFont.variable} ${interfaceFont.variable} ${dataFont.variable} antialiased`}
      >
        <CallShell>
          <PublicAgeGate>{children}</PublicAgeGate>
        </CallShell>
        <Toaster
          closeButton
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "ahawc-toast",
              title: "ahawc-toast-title",
              description: "ahawc-toast-description",
              actionButton: "ahawc-toast-action",
              cancelButton: "ahawc-toast-cancel",
            },
          }}
        />
      </body>
    </html>
  );
}
