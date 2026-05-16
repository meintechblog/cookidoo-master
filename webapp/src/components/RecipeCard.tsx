import Link from "next/link";
import type { Recipe } from "@/lib/recipes";

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <Link href={`/r/${recipe.slug}`} className="recipe-card block bg-white rounded-2xl overflow-hidden shadow-card group">
      <div className="aspect-[4/3] bg-charcoal-100 relative overflow-hidden">
        {recipe.hasOwnHero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/recipes/${recipe.slug}/hero`}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-charcoal-300 text-6xl">🍳</div>
        )}
        {recipe.hfCardNumber && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-3 py-1 rounded-full text-xs font-semibold text-charcoal-700 shadow">
            HF #{recipe.hfCardNumber}
          </div>
        )}
        {recipe.cookidooPublicUrl && (
          <div className="absolute top-3 right-3 bg-hero-600 text-white px-3 py-1 rounded-full text-xs font-semibold shadow">
            ✓ Live
          </div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-display text-xl font-bold text-charcoal-900 mb-1 line-clamp-2 group-hover:text-hero-700 transition-colors">
          {recipe.title}
        </h3>
        {recipe.subtitle && (
          <p className="text-sm text-charcoal-500 mb-4 line-clamp-2">{recipe.subtitle}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-charcoal-600">
          {recipe.totalMin && <span>🕐 {recipe.totalMin} Min.</span>}
          {recipe.servings && <span>👥 {recipe.servings} P</span>}
          {recipe.stepCount > 0 && <span>📋 {recipe.stepCount} Steps</span>}
          {recipe.diet && (
            <span className="ml-auto px-2 py-0.5 bg-hero-50 text-hero-700 rounded-full text-xs font-medium border border-hero-200">
              {recipe.diet}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
