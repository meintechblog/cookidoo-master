import { listPinned } from "@/lib/db";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, { label: string; color: string }> = {
  queued: { label: "Wartet", color: "bg-charcoal-100 text-charcoal-700" },
  processing: { label: "Wird verarbeitet", color: "bg-cream-300 text-charcoal-800" },
  done: { label: "Fertig", color: "bg-hero-100 text-hero-800" },
  error: { label: "Fehler", color: "bg-red-100 text-red-800" },
  skipped: { label: "Übersprungen", color: "bg-charcoal-100 text-charcoal-600" },
};

export default function PinnedPage() {
  const pinned = listPinned();
  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-3xl font-bold mb-6">Queue</h1>
      {pinned.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-charcoal-100">
          <p className="text-charcoal-500">Keine gepinnten URLs.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-charcoal-500">
              <tr>
                <th className="px-5 py-3">URL</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Slug</th>
                <th className="px-5 py-3">Gepinnt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-100">
              {pinned.map(p => {
                const s = statusLabel[p.status] || { label: p.status, color: "bg-charcoal-100 text-charcoal-700" };
                return (
                  <tr key={p.id} className="hover:bg-cream-50">
                    <td className="px-5 py-3 max-w-md truncate">
                      <a href={p.url} target="_blank" rel="noopener" className="text-charcoal-700 hover:text-hero-700 text-sm">
                        {p.url.replace("https://www.hellofresh.de/recipes/", "")}
                      </a>
                      {p.error && <div className="text-xs text-red-600 mt-1 truncate">{p.error}</div>}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-charcoal-600">
                      {p.slug ? <a href={`/r/${p.slug}`} className="hover:text-hero-700">{p.slug}</a> : "—"}
                    </td>
                    <td className="px-5 py-3 text-sm text-charcoal-500">
                      {new Date(p.pinned_at * 1000).toLocaleString("de-DE")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
