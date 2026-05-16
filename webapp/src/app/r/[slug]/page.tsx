import { notFound } from "next/navigation";
import Link from "next/link";
import { readRecipe } from "@/lib/recipes";
import { marked } from "marked";

export const dynamic = "force-dynamic";

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = readRecipe(slug);
  if (!recipe) notFound();

  // Render Zubereitung + Tipps + Warum + Quelle as HTML
  const sections = splitSections(recipe.rawMarkdown);
  const zubereitungHtml = sections.zubereitung ? await marked.parse(sections.zubereitung) : "";
  const tippsHtml = sections.tipps ? await marked.parse(sections.tipps) : "";
  const warumHtml = sections.warum ? await marked.parse(sections.warum) : "";

  return (
    <article className="animate-slide-up">
      {/* Header */}
      <div className="mb-4 text-sm">
        <Link href="/" className="text-charcoal-500 hover:text-hero-700">← Alle Rezepte</Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Hero image */}
        <div className="relative">
          <div className="aspect-[4/3] bg-charcoal-100 rounded-2xl overflow-hidden shadow-card">
            {recipe.hasOwnHero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/recipes/${recipe.slug}/hero`} alt={recipe.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-charcoal-300 text-8xl">🍳</div>
            )}
          </div>
          {recipe.hfCardNumber && (
            <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-4 py-1.5 rounded-full text-sm font-semibold text-charcoal-700 shadow">
              HelloFresh #{recipe.hfCardNumber}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-col">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-charcoal-900 mb-3 leading-tight">
            {recipe.title}
          </h1>
          {recipe.subtitle && <p className="text-lg text-charcoal-600 mb-6">{recipe.subtitle}</p>}

          <div className="grid grid-cols-3 gap-4 mb-6">
            <Stat label="Arbeitszeit" value={recipe.prepMin ? `${recipe.prepMin} Min.` : "—"} />
            <Stat label="Gesamtzeit" value={recipe.totalMin ? `${recipe.totalMin} Min.` : "—"} />
            <Stat label="Portionen" value={recipe.servings ? `${recipe.servings}` : "—"} />
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {recipe.diet && <Tag color="hero">{recipe.diet}</Tag>}
            {recipe.difficulty && <Tag color="cream">{recipe.difficulty}</Tag>}
            {recipe.stepCount > 0 && <Tag color="charcoal">{recipe.stepCount} Schritte</Tag>}
          </div>

          <div className="flex flex-col gap-2 mt-auto">
            {recipe.cookidooPublicUrl && (
              <a href={recipe.cookidooPublicUrl} target="_blank" rel="noopener"
                 className="block px-5 py-3 bg-hero-600 text-white text-center font-semibold rounded-lg hover:bg-hero-700 transition shadow-card">
                Auf Cookidoo öffnen ↗
              </a>
            )}
            {recipe.hfUrl && (
              <a href={recipe.hfUrl} target="_blank" rel="noopener"
                 className="block px-5 py-3 border-2 border-charcoal-200 text-charcoal-700 text-center font-semibold rounded-lg hover:border-charcoal-400 transition">
                Original HelloFresh-Karte ↗
              </a>
            )}
            <Link href={`/r/${recipe.slug}/edit`}
                  className="block px-5 py-2 text-charcoal-500 text-center text-sm hover:text-hero-700">
              ✎ Bearbeiten
            </Link>
          </div>
        </div>
      </div>

      {/* Two-column: Zutaten + Zubereitung */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-card sticky top-24">
            <h2 className="font-display text-2xl font-bold text-charcoal-900 mb-4">Zutaten</h2>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex items-start gap-2 text-charcoal-700">
                  <span className="text-hero-600 mt-1">●</span>
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="lg:col-span-2">
          <h2 className="font-display text-2xl font-bold text-charcoal-900 mb-4">Zubereitung</h2>
          <div className="prose-recipe text-charcoal-700" dangerouslySetInnerHTML={{ __html: zubereitungHtml }} />
        </div>
      </div>

      {/* Tipps */}
      {tippsHtml && (
        <section className="mb-12 bg-cream-100 rounded-2xl p-8">
          <h2 className="font-display text-2xl font-bold text-charcoal-900 mb-4">Tipps</h2>
          <div className="prose-recipe text-charcoal-700" dangerouslySetInnerHTML={{ __html: tippsHtml }} />
        </section>
      )}

      {/* Warum */}
      {warumHtml && (
        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold text-charcoal-900 mb-4">Warum diese Cookidoo-Adaption</h2>
          <div className="prose-recipe text-charcoal-700" dangerouslySetInnerHTML={{ __html: warumHtml }} />
        </section>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cream-100 rounded-xl p-3 text-center">
      <div className="text-xs text-charcoal-500 uppercase tracking-wide font-semibold mb-1">{label}</div>
      <div className="text-lg font-bold text-charcoal-900">{value}</div>
    </div>
  );
}

function Tag({ color, children }: { color: "hero" | "cream" | "charcoal"; children: React.ReactNode }) {
  const classes = {
    hero: "bg-hero-50 text-hero-700 border-hero-200",
    cream: "bg-cream-100 text-charcoal-700 border-cream-300",
    charcoal: "bg-charcoal-100 text-charcoal-700 border-charcoal-200",
  }[color];
  return <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${classes}`}>{children}</span>;
}

function splitSections(md: string): { zubereitung?: string; tipps?: string; warum?: string } {
  const result: { zubereitung?: string; tipps?: string; warum?: string } = {};
  const zubMatch = md.match(/##\s+Zubereitung[^\n]*\n([\s\S]+?)(?=\n##\s+|\Z)/);
  if (zubMatch) result.zubereitung = zubMatch[1].trim();
  const tippsMatch = md.match(/##\s+Tipps[^\n]*\n([\s\S]+?)(?=\n##\s+|\Z)/);
  if (tippsMatch) result.tipps = tippsMatch[1].trim();
  const warumMatch = md.match(/##\s+Warum\s+diese\s+Cookidoo-Adaption[^\n]*\n([\s\S]+?)(?=\n##\s+|\Z)/);
  if (warumMatch) result.warum = warumMatch[1].trim();
  return result;
}
