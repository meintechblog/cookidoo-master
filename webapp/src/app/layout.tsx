import "./globals.css";
import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Thermomix Master — HelloFresh × Cookidoo",
  description: "Sexy Rezept-Browser für HelloFresh-Kreationen als native-quality Cookidoo Eigene Rezepte.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="h-screen overflow-hidden flex flex-col bg-cream-50 text-charcoal-800">
        <SiteHeader />
        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 min-h-full">
            {children}
          </div>
        </main>
        <footer className="hidden md:block shrink-0 border-t border-charcoal-100 py-2 text-center text-xs text-charcoal-500">
          Thermomix Master · <a href="https://github.com/meintechblog/thermomix-master" className="hover:text-hero-700">Open Source</a> · MIT
        </footer>
      </body>
    </html>
  );
}
