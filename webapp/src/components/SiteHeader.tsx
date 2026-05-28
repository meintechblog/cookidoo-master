"use client";

import { useState } from "react";

const NAV = [
  { href: "/", label: "Rezepte" },
  { href: "/pinned", label: "Queue" },
  { href: "/settings", label: "Einstellungen" },
];

function WalkieButton() {
  return (
    <a
      href="/chat"
      aria-label="Walkie-Talkie"
      title="Walkie-Talkie öffnen"
      className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full bg-purple-600 text-white shadow hover:bg-purple-700 transition active:scale-95"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zm5 10a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2z" />
      </svg>
    </a>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="bg-white border-b border-charcoal-100 sticky top-0 z-50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <a href="/" className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-hero-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            T
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg sm:text-2xl font-bold text-charcoal-900 leading-none truncate">
              Thermomix Master
            </div>
            <div className="text-[10px] sm:text-xs text-charcoal-500 truncate">
              HelloFresh × Cookidoo · native-quality
            </div>
          </div>
        </a>

        {/* Walkie-Talkie (always visible, primary CTA) */}
        <WalkieButton />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-charcoal-700">
          {NAV.map(n => (
            <a key={n.href} href={n.href} className="hover:text-hero-700 transition flex items-center gap-1.5">
              {n.label}
            </a>
          ))}
          <a
            href="https://github.com/meintechblog/thermomix-master"
            target="_blank"
            rel="noopener"
            className="px-3 py-1.5 rounded-md border border-charcoal-200 hover:border-hero-500 hover:text-hero-700 transition"
          >
            GitHub ↗
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden p-2 -mr-2 text-charcoal-700 hover:text-hero-700 transition"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <nav className="md:hidden border-t border-charcoal-100 bg-white">
          <ul className="max-w-7xl mx-auto px-4 py-2 flex flex-col">
            {NAV.map(n => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="block px-2 py-3 text-base text-charcoal-800 hover:bg-cream-100 rounded-lg flex items-center gap-2"
                  onClick={() => setOpen(false)}
                >
                  {n.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="https://github.com/meintechblog/thermomix-master"
                target="_blank"
                rel="noopener"
                className="block px-2 py-3 text-base text-charcoal-600 hover:bg-cream-100 rounded-lg"
                onClick={() => setOpen(false)}
              >
                GitHub ↗
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
