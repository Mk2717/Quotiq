import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const PUBLIC_COLUMNS = [
  "id",
  "estimate_number",
  "customer_name",
  "customer_email",
  "project_name",
  "currency",
  "total",
  "deposit_percent",
  "estimate_payload",
  "business_payload",
  "status",
  "response_name",
  "response_email",
  "response_message",
  "signature_text",
  "responded_at",
  "expires_at",
  "created_at",
  "updated_at",
].join(",");

const MAX_BODY_BYTES = 32_768;
const ACTIVE_STATUSES = ["pending", "changes_requested"];
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,96}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed =
    origin === "https://quotiq-app.mikeezym.chatgpt.site" ||
    origin === "http://terminal.local:4173" ||
    origin === "http://localhost:4173";
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://quotiq-app.mikeezym.chatgpt.site",
    "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getSecretKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      if (parsed?.default) return String(parsed.default);
    } catch {
      // Fall back to the legacy server-only key below.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Method not allowed." });

  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return json(req, 413, { error: "Request is too large." });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const secretKey = getSecretKey();
  if (!supabaseUrl || !secretKey) {
    console.error("Client portal server configuration is incomplete.");
    return json(req, 503, { error: "The approval service is temporarily unavailable." });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "Invalid request." });
  }

  const token = clean(body.token, 96);
  if (!TOKEN_PATTERN.test(token)) {
    return json(req, 404, { error: "This approval link is invalid or no longer available." });
  }

  const action = clean(body.action, 32) || "view";
  const tokenHash = await sha256(token);
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: portal, error: portalError } = await admin
    .from("client_portals")
    .select("*")
    .eq("share_token_hash", tokenHash)
    .maybeSingle();

  if (portalError) {
    console.error("Portal lookup failed", portalError.message);
    return json(req, 503, { error: "The approval service is temporarily unavailable." });
  }
  if (!portal) {
    return json(req, 404, { error: "This approval link is invalid or no longer available." });
  }

  const expired = new Date(portal.expires_at).getTime() <= Date.now();
  if (expired && ACTIVE_STATUSES.includes(portal.status)) {
    const now = new Date().toISOString();
    await admin.from("client_portals").update({ status: "expired", updated_at: now }).eq("id", portal.id);
    await admin.from("client_portal_events").insert({
      portal_id: portal.id,
      owner_id: portal.owner_id,
      event_type: "expired",
      metadata: { reason: "link_expired" },
    });
    portal.status = "expired";
    portal.updated_at = now;
  }

  const publicPortal = () => {
    const result: Record<string, unknown> = {};
    for (const column of PUBLIC_COLUMNS.split(",")) result[column] = portal[column];
    return result;
  };

  if (action === "view") {
    if (portal.status === "revoked") {
      return json(req, 410, { error: "This approval link has been withdrawn." });
    }
    if (portal.status === "expired") {
      return json(req, 410, { error: "This approval link has expired.", portal: publicPortal() });
    }

    const now = new Date().toISOString();
    const nextViewCount = Math.min(Number(portal.view_count || 0) + 1, 2_147_483_647);
    await admin
      .from("client_portals")
      .update({ last_viewed_at: now, view_count: nextViewCount, updated_at: now })
      .eq("id", portal.id);
    portal.updated_at = now;
    return json(req, 200, { portal: publicPortal() });
  }

  if (!["accept", "request_changes", "decline"].includes(action)) {
    return json(req, 400, { error: "Unsupported approval action." });
  }

  if (portal.status === "revoked" || portal.status === "expired") {
    return json(req, 410, { error: "This approval link is no longer active.", portal: publicPortal() });
  }
  if (portal.status === "accepted" || portal.status === "declined") {
    return json(req, 409, { error: "A final response has already been recorded.", portal: publicPortal() });
  }

  const name = clean(body.name, 120);
  const email = clean(body.email, 180).toLowerCase();
  const message = clean(body.message, 2000);
  const consent = body.consent === true;

  if (name.length < 2) return json(req, 400, { error: "Enter the authorized person's full name." });
  if (email && !EMAIL_PATTERN.test(email)) return json(req, 400, { error: "Enter a valid email address." });
  if (action === "accept" && !consent) {
    return json(req, 400, { error: "Confirm that you are authorized and accept the estimate terms." });
  }
  if (action === "request_changes" && message.length < 3) {
    return json(req, 400, { error: "Describe the changes you need." });
  }

  const nextStatus =
    action === "accept" ? "accepted" :
    action === "request_changes" ? "changes_requested" :
    "declined";
  const now = new Date().toISOString();
  const update = {
    status: nextStatus,
    response_name: name,
    response_email: email || null,
    response_message: message || null,
    signature_text: action === "accept" ? name : null,
    responded_at: now,
    updated_at: now,
  };

  const { data: updated, error: updateError } = await admin
    .from("client_portals")
    .update(update)
    .eq("id", portal.id)
    .eq("status", portal.status)
    .select("*")
    .maybeSingle();

  if (updateError) {
    console.error("Portal response failed", updateError.message);
    return json(req, 503, { error: "We could not record the response. Please try again." });
  }
  if (!updated) {
    return json(req, 409, { error: "This estimate was updated elsewhere. Refresh and try again." });
  }

  const userAgent = clean(req.headers.get("user-agent"), 220);
  const { error: eventError } = await admin.from("client_portal_events").insert({
    portal_id: portal.id,
    owner_id: portal.owner_id,
    event_type: nextStatus,
    actor_name: name,
    actor_email: email || null,
    message: message || null,
    metadata: { consent, user_agent: userAgent, previous_status: portal.status },
  });
  if (eventError) console.error("Portal audit event failed", eventError.message);

  Object.assign(portal, updated);
  return json(req, 200, { portal: publicPortal(), recorded: true });
});
