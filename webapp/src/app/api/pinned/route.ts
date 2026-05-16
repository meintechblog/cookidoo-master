import { NextResponse } from "next/server";
import { listPinned, pinUrl } from "@/lib/db";
import { listRecipes } from "@/lib/recipes";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PinSchema = z.object({ url: z.string().url() });

export async function GET() {
  return NextResponse.json({ pinned: listPinned() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PinSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid url" }, { status: 400 });

  const url = parsed.data.url;
  if (!url.startsWith("https://www.hellofresh.de/recipes/")) {
    return NextResponse.json({ error: "Nur HelloFresh-URLs werden unterstützt" }, { status: 400 });
  }

  // Skip if a recipe with this exact HF URL already exists
  const existing = listRecipes().find(r => r.hfUrl === url);
  if (existing) {
    return NextResponse.json({
      message: `Rezept '${existing.title}' existiert bereits.`,
      slug: existing.slug,
      duplicate: true,
    });
  }

  const pinned = pinUrl(url);
  return NextResponse.json({
    message: `Gepinnt — wird vom Worker verarbeitet (Status: ${pinned.status}).`,
    pinned,
  });
}
