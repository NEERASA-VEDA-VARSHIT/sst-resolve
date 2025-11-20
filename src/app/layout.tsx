import { ClerkProvider } from "@clerk/nextjs";
import { UnifiedNav } from "@/components/layout/UnifiedNav";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/provider/ThemeProvider";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  title: "SST Resolve - Ticket Management System",
  description: "Manage and track tickets efficiently",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        layout: { unsafe_disableDevelopmentModeWarnings: true },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          suppressHydrationWarning
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <UnifiedNav />
            {children}
            <Toaster
              position="bottom-center"
              closeButton
              richColors
              expand
              duration={4000}
            />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
