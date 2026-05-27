import { chatInsert } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const AUTH_TOKEN = process.env.CHAT_BRIDGE_TOKEN || "";

function authOk(req: Request): boolean {
  if (!AUTH_TOKEN) return true;
  const got = req.headers.get("authorization") || "";
  return got === `Bearer ${AUTH_TOKEN}`;
}

const Body = z.object({ body: z.string().min(1).max(20000) });

// POST — assistant (Mac-side) drops a reply that the browser will pick up via SSE.
export async function POST(req: Request) {
  if (!authOk(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const msg = chatInsert("assistant", parsed.body);
  return Response.json({ ok: true, message: msg });
}
