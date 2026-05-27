import { chatInsert } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const Body = z.object({ body: z.string().min(1).max(4000) });

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const msg = chatInsert("user", parsed.body.trim());
  return Response.json({ ok: true, message: msg });
}
