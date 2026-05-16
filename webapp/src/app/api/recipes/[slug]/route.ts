import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { RECIPES_DIR } from "@/lib/repo-paths";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.markdown !== "string") return NextResponse.json({ error: "markdown required" }, { status: 400 });

  const readme = path.join(RECIPES_DIR, slug, "README.md");
  if (!fs.existsSync(readme)) return NextResponse.json({ error: "recipe not found" }, { status: 404 });

  fs.writeFileSync(readme, body.markdown, "utf8");
  return NextResponse.json({ ok: true });
}
