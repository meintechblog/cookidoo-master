import { notFound } from "next/navigation";
import { readRecipe } from "@/lib/recipes";
import { EditForm } from "@/components/EditForm";

export const dynamic = "force-dynamic";

export default async function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recipe = readRecipe(slug);
  if (!recipe) notFound();

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="mb-4 text-sm">
        <a href={`/r/${slug}`} className="text-charcoal-500 hover:text-hero-700">← Zurück zum Rezept</a>
      </div>
      <h1 className="font-display text-3xl font-bold mb-2">Bearbeiten: {recipe.title}</h1>
      <p className="text-sm text-charcoal-600 mb-6">Editor speichert direkt in <code className="text-xs bg-cream-100 px-1.5 py-0.5 rounded">recipes/{recipe.slug}/README.md</code>. Auto-Commit ist deaktiviert — push via Worker.</p>
      <EditForm slug={recipe.slug} initialMarkdown={recipe.rawMarkdown} />
    </div>
  );
}
