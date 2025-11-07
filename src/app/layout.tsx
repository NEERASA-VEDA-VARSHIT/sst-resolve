import { ClerkProvider } from "@clerk/nextjs";
import ClientNav from "@/components/layout/ClientNav";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/provider/ThemeProvider";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "SST Resolve - Ticket Management System",
  description: "Manage and track tickets efficiently",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ClientNav />
            {children}
            <Toaster 
              position="bottom-right"
              closeButton
              richColors
              expand={true}
              duration={4000}
              gap={12}
              offset={20}
              toastOptions={{
                classNames: {
                  toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:shadow-black/10 dark:group-[.toaster]:shadow-black/30 group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:p-4 group-[.toaster]:min-w-[320px] group-[.toaster]:max-w-[420px]",
                  title: "font-semibold text-sm mb-1",
                  description: "text-sm text-muted-foreground",
                  actionButton: "bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  cancelButton: "bg-muted text-muted-foreground hover:bg-muted/80 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  closeButton: "bg-transparent hover:bg-muted rounded-md p-1.5 transition-colors text-muted-foreground hover:text-foreground",
                  success: "group-[.toaster]:bg-emerald-50 dark:group-[.toaster]:bg-emerald-950/20 group-[.toaster]:text-emerald-900 dark:group-[.toaster]:text-emerald-100 group-[.toaster]:border-emerald-200 dark:group-[.toaster]:border-emerald-800 group-[.toaster]:shadow-emerald-500/10",
                  error: "group-[.toaster]:bg-red-50 dark:group-[.toaster]:bg-red-950/20 group-[.toaster]:text-red-900 dark:group-[.toaster]:text-red-100 group-[.toaster]:border-red-200 dark:group-[.toaster]:border-red-800 group-[.toaster]:shadow-red-500/10",
                  info: "group-[.toaster]:bg-blue-50 dark:group-[.toaster]:bg-blue-950/20 group-[.toaster]:text-blue-900 dark:group-[.toaster]:text-blue-100 group-[.toaster]:border-blue-200 dark:group-[.toaster]:border-blue-800 group-[.toaster]:shadow-blue-500/10",
                  warning: "group-[.toaster]:bg-amber-50 dark:group-[.toaster]:bg-amber-950/20 group-[.toaster]:text-amber-900 dark:group-[.toaster]:text-amber-100 group-[.toaster]:border-amber-200 dark:group-[.toaster]:border-amber-800 group-[.toaster]:shadow-amber-500/10",
                  default: "group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border",
                },
                style: {
                  borderRadius: "0.75rem",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                  padding: "1rem",
                  minWidth: "320px",
                  maxWidth: "420px",
                },
              }}
            />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
