import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { RECIPES_DIR } from "@/lib/repo-paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 16 * 1024 * 1024; // 16 MB

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  if (!/^[a-z0-9-]+$/.test(slug)) return NextResponse.json({ error: "bad slug" }, { status: 400 });
  const dir = path.join(RECIPES_DIR, slug);
  if (!fs.existsSync(dir)) return NextResponse.json({ error: "recipe not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("hero");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file uploaded" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `file > ${MAX_BYTES} bytes` }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "not an image" }, { status: 400 });

  // Always write as hero.jpg — even if upload is PNG (the recipe convention
  // is hero.jpg + Cookidoo accepts JPEG/PNG via its widget regardless).
  const dest = path.join(dir, "hero.jpg");
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(dest, buf);

  return NextResponse.json({
    ok: true,
    size: file.size,
    name: file.name,
    type: file.type,
    note: "Local hero replaced. To push to Cookidoo, run automation/02_upload_image.py via the /thermomix-master skill or the embedded Claude chat (Session 4).",
  });
}
