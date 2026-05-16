import { NextResponse } from "next/server";
import { readRecipe } from "@/lib/recipes";

export const dynamic = "force-dynamic";

/**
 * Proxy + download endpoint for the HelloFresh reference image.
 * `?download=1` forces Content-Disposition: attachment so the browser
 * shows a save dialog (useful as a research reference, not for re-publishing).
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const recipe = readRecipe(slug);
  if (!recipe?.hfUrl) return NextResponse.json({ error: "recipe has no HelloFresh URL" }, { status: 404 });

  // Fetch the HF og:image via the skill extractor (caches the JSON on disk
  // in .extracted.json if the worker ran; otherwise refetch live).
  const r = await fetch(recipe.hfUrl, { headers: { "User-Agent": "Mozilla/5.0 (thermomix-master webapp)" } });
  if (!r.ok) return NextResponse.json({ error: `HF fetch failed: ${r.status}` }, { status: 502 });
  const html = await r.text();
  const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1];
  if (!ogImg) return NextResponse.json({ error: "no og:image found on HF page" }, { status: 404 });

  const imgRes = await fetch(ogImg);
  if (!imgRes.ok) return NextResponse.json({ error: `image fetch failed: ${imgRes.status}` }, { status: 502 });
  const buf = await imgRes.arrayBuffer();
  const ct = imgRes.headers.get("content-type") || "image/jpeg";

  const url = new URL(req.url);
  const download = url.searchParams.get("download") === "1";
  const headers: Record<string, string> = {
    "Content-Type": ct,
    "Cache-Control": "public, max-age=3600",
  };
  if (download) {
    const ext = ct.includes("png") ? "png" : "jpg";
    headers["Content-Disposition"] = `attachment; filename="${slug}-hellofresh-original.${ext}"`;
  }
  return new NextResponse(Buffer.from(buf), { headers });
}
