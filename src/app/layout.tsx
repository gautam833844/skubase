import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout";
import "./globals.css";

// =============================================================================
// Root Layout — HTML shell for the entire application
// =============================================================================

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KMR Group — Tyre & Automotive Business Management",
    template: "%s | KMR Group",
  },
  description:
    "KMR Group — Comprehensive tyre business management, inventory, sales, alignment services, and customer care.",
  icons: {
    icon: [
      { url: "/kmr-logo.png", href: "/kmr-logo.png" },
      { url: "/logo.png", href: "/logo.png" },
    ],
    shortcut: "/kmr-logo.png",
    apple: "/kmr-logo.png",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
