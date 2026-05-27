import { chatUndeliveredUserMessages, chatMarkDelivered } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const AUTH_TOKEN = process.env.CHAT_BRIDGE_TOKEN || "";

function authOk(req: Request): boolean {
  if (!AUTH_TOKEN) return true; // open in dev
  const got = req.headers.get("authorization") || "";
  return got === `Bearer ${AUTH_TOKEN}`;
}

// GET — poll endpoint for the Mac-Daemon. Returns pending user messages.
export async function GET(req: Request) {
  if (!authOk(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const msgs = chatUndeliveredUserMessages();
  return Response.json({ messages: msgs });
}

// POST — daemon ACKs which messages it forwarded to the broker.
const AckBody = z.object({ ids: z.array(z.number().int().positive()) });

export async function POST(req: Request) {
  if (!authOk(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let parsed;
  try {
    parsed = AckBody.parse(await req.json());
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  chatMarkDelivered(parsed.ids);
  return Response.json({ ok: true, acked: parsed.ids.length });
}
