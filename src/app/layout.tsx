import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MobileNav, Sidebar } from "@/components/layout/sidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Outreach CRM",
  description: "Vícekanálový outreach a CRM se scraperem a AI personalizací",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <TooltipProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="min-w-0 flex-1">
              <MobileNav />
              <main className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</main>
            </div>
          </div>
          <Toaster richColors position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
