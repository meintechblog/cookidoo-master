import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { RECIPES_DIR } from "@/lib/repo-paths";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
  const dir = path.join(RECIPES_DIR, slug);
  for (const name of ["hero.jpg", "hero.png", "hero.jpeg"]) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      const buf = fs.readFileSync(p);
      const ext = name.split(".").pop();
      const ct = ext === "png" ? "image/png" : "image/jpeg";
      return new NextResponse(buf, { headers: { "Content-Type": ct, "Cache-Control": "public, max-age=3600" } });
    }
  }
  return NextResponse.json({ error: "no hero image" }, { status: 404 });
}
