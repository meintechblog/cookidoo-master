import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thermomix Master — HelloFresh × Cookidoo",
  description: "Sexy Rezept-Browser für HelloFresh-Kreationen als native-quality Cookidoo Eigene Rezepte.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-cream-50 text-charcoal-800">
        <header className="bg-white border-b border-charcoal-100 sticky top-0 z-50 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-hero-600 flex items-center justify-center text-white font-bold text-lg">T</div>
              <div>
                <div className="font-display text-2xl font-bold text-charcoal-900 leading-none">Thermomix Master</div>
                <div className="text-xs text-charcoal-500">HelloFresh × Cookidoo · native-quality</div>
              </div>
            </a>
            <nav className="flex items-center gap-6 text-sm font-medium text-charcoal-700">
              <a href="/" className="hover:text-hero-700 transition">Rezepte</a>
              <a href="/pinned" className="hover:text-hero-700 transition">Queue</a>
              <a href="/settings" className="hover:text-hero-700 transition">Einstellungen</a>
              <a href="https://github.com/meintechblog/cookidoo-master" target="_blank" rel="noopener" className="px-3 py-1.5 rounded-md border border-charcoal-200 hover:border-hero-500 hover:text-hero-700 transition">GitHub ↗</a>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
        <footer className="border-t border-charcoal-100 mt-16 py-8 text-center text-sm text-charcoal-500">
          <div className="max-w-7xl mx-auto px-6">
            Thermomix Master · <a href="https://github.com/meintechblog/cookidoo-master" className="hover:text-hero-700">Open Source</a> · MIT
          </div>
        </footer>
      </body>
    </html>
  );
}
