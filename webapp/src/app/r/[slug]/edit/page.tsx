import { notFound } from "next/navigation";
import { readRecipe } from "@/lib/recipes";
import { EditForm } from "@/components/EditForm";
import { HeroUploader } from "@/components/HeroUploader";
import { PublishPanel } from "@/components/PublishPanel";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = readRecipe(slug);
  if (!recipe) notFound();

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-8">
      <div>
        <div className="mb-4 text-sm">
          <a href={`/r/${slug}`} className="text-charcoal-500 hover:text-hero-700">← Zurück zum Rezept</a>
        </div>
        <h1 className="font-display text-3xl font-bold mb-2">Bearbeiten: {recipe.title}</h1>
        <p className="text-sm text-charcoal-600">Änderungen speichern direkt in <code className="text-xs bg-cream-100 px-1.5 py-0.5 rounded">recipes/{recipe.slug}/</code>. Auto-Commit zu GitHub erfolgt via Worker bzw. manuell.</p>
      </div>

      <HeroUploader slug={recipe.slug} hasOwnHero={recipe.hasOwnHero} hfUrl={recipe.hfUrl} />

      <PublishPanel
        slug={recipe.slug}
        hasOwnHero={recipe.hasOwnHero}
        cookidooRecipeId={recipe.cookidooRecipeId}
        cookidooPublicUrl={recipe.cookidooPublicUrl}
      />

      <div className="bg-white rounded-2xl p-6 shadow-card">
        <h3 className="font-display text-xl font-bold text-charcoal-900 mb-4">Markdown</h3>
        <EditForm slug={recipe.slug} initialMarkdown={recipe.rawMarkdown} />
      </div>
    </div>
  );
}
