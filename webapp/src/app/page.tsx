import Link from "next/link";
import { listRecipes } from "@/lib/recipes";
import { PinForm } from "@/components/PinForm";
import { RecipeCard } from "@/components/RecipeCard";

export const dynamic = "force-dynamic";

export default function Home() {
  const recipes = listRecipes().sort((a, b) => {
    // Sort by HF card number if both have one, else by title
    const an = a.hfCardNumber ? parseInt(a.hfCardNumber) : 9999;
    const bn = b.hfCardNumber ? parseInt(b.hfCardNumber) : 9999;
    return an - bn;
  });

  return (
    <div className="animate-fade-in">
      {/* Hero pin-URL form */}
      <section className="mb-12">
        <div className="bg-gradient-to-br from-hero-600 to-hero-700 rounded-3xl p-8 md:p-12 text-white shadow-card">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">
            HelloFresh-Rezept pinnen
          </h1>
          <p className="text-hero-100 mb-6 text-lg max-w-2xl">
            Paste eine HelloFresh-URL — der Worker scrapet die Karte, adaptiert sie auf native Thermomix-Style mit Koch-Befehl-Chips und publisht sie auf Cookidoo.
          </p>
          <PinForm />
        </div>
      </section>

      {/* Recipe grid */}
      <section>
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display text-3xl font-bold text-charcoal-900">
            Unsere Kollektion <span className="text-charcoal-400 font-normal text-2xl">({recipes.length})</span>
          </h2>
          <Link href="/pinned" className="text-sm text-charcoal-600 hover:text-hero-700 transition">
            Queue ansehen →
          </Link>
        </div>

        {recipes.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-charcoal-100">
            <p className="text-charcoal-500">Noch keine Rezepte. Pinne oben eine HelloFresh-URL.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map(r => <RecipeCard key={r.slug} recipe={r} />)}
          </div>
        )}
      </section>
    </div>
  );
}
