import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const MAX_BODY_BYTES = 24_576;
const SLUG_PATTERN = /^q-[a-z0-9]{16,40}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PUBLIC_COLUMNS = "id,slug,business_name,business_phone,business_email,service_area,welcome_message,services,accent_color,active";

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
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function getSecretKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      if (parsed?.default) return String(parsed.default);
    } catch {
      // Fall back to the legacy server-only key.
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
    console.error("Service booking server configuration is incomplete.");
    return json(req, 503, { error: "Online booking is temporarily unavailable." });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "Invalid request." });
  }

  const slug = clean(body.slug, 48).toLowerCase();
  if (!SLUG_PATTERN.test(slug)) return json(req, 404, { error: "This booking page is not available." });

  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: page, error: pageError } = await admin
    .from("booking_pages")
    .select(`${PUBLIC_COLUMNS},owner_id`)
    .eq("slug", slug)
    .maybeSingle();

  if (pageError) {
    console.error("Booking page lookup failed", pageError.message);
    return json(req, 503, { error: "Online booking is temporarily unavailable." });
  }
  if (!page || !page.active) return json(req, 404, { error: "This booking page is not available." });

  const publicPage = () => {
    const safe: Record<string, unknown> = {};
    for (const column of PUBLIC_COLUMNS.split(",")) safe[column] = page[column];
    return safe;
  };
  const action = clean(body.action, 24) || "page";
  if (action === "page") return json(req, 200, { page: publicPage() });
  if (action !== "submit") return json(req, 400, { error: "Unsupported booking action." });

  // A filled hidden field is treated as a bot. Return a neutral response without storing it.
  if (clean(body.website, 120)) return json(req, 200, { received: true, reference: "REQUESTED" });

  const customerName = clean(body.customerName, 160);
  const phone = clean(body.phone, 80);
  const email = clean(body.email, 180).toLowerCase();
  const serviceType = clean(body.serviceType, 120);
  const siteAddress = clean(body.siteAddress, 320);
  const preferredDate = clean(body.preferredDate, 10);
  const preferredTime = clean(body.preferredTime, 80);
  const budgetRange = clean(body.budgetRange, 100);
  const urgency = clean(body.urgency, 12) || "normal";
  const details = clean(body.details, 4000);

  if (customerName.length < 2) return json(req, 400, { error: "Enter your full name." });
  if (!phone && !email) return json(req, 400, { error: "Enter a phone number or email address." });
  if (phone && phone.length < 6) return json(req, 400, { error: "Enter a valid phone number." });
  if (email && !EMAIL_PATTERN.test(email)) return json(req, 400, { error: "Enter a valid email address." });
  if (!Array.isArray(page.services) || !page.services.includes(serviceType)) {
    return json(req, 400, { error: "Choose one of the available services." });
  }
  if (siteAddress.length < 3) return json(req, 400, { error: "Enter the job or site address." });
  if (!["normal", "soon", "urgent"].includes(urgency)) return json(req, 400, { error: "Choose a valid urgency." });

  let normalizedDate: string | null = null;
  if (preferredDate) {
    const date = new Date(`${preferredDate}T12:00:00Z`);
    const today = new Date();
    const latest = new Date();
    today.setUTCHours(0, 0, 0, 0);
    latest.setUTCFullYear(latest.getUTCFullYear() + 2);
    if (!DATE_PATTERN.test(preferredDate) || Number.isNaN(date.getTime()) || date < today || date > latest) {
      return json(req, 400, { error: "Choose a valid preferred date." });
    }
    normalizedDate = preferredDate;
  }

  const ip = clean(req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for"), 120);
  const userAgent = clean(req.headers.get("user-agent"), 220);
  const fingerprint = await sha256(`${page.id}|${ip}|${userAgent}`);
  const windowStart = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count, error: countError } = await admin
    .from("service_leads")
    .select("id", { count: "exact", head: true })
    .eq("booking_page_id", page.id)
    .eq("request_fingerprint", fingerprint)
    .gte("created_at", windowStart);
  if (countError) {
    console.error("Booking rate limit check failed", countError.message);
    return json(req, 503, { error: "We could not submit your request. Please try again." });
  }
  if ((count || 0) >= 5) return json(req, 429, { error: "Too many requests. Please wait a few minutes and try again." });

  const followUpAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const { data: lead, error: insertError } = await admin
    .from("service_leads")
    .insert({
      owner_id: page.owner_id,
      booking_page_id: page.id,
      source: "booking_page",
      customer_name: customerName,
      phone: phone || null,
      email: email || null,
      service_type: serviceType,
      site_address: siteAddress,
      preferred_date: normalizedDate,
      preferred_time: preferredTime || null,
      budget_range: budgetRange || null,
      urgency,
      details: details || null,
      status: "new",
      follow_up_at: followUpAt,
      request_fingerprint: fingerprint,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Booking request insert failed", insertError.message);
    return json(req, 503, { error: "We could not submit your request. Please try again." });
  }

  return json(req, 201, {
    received: true,
    reference: String(lead.id).split("-")[0].toUpperCase(),
    message: "Your request has been sent. The contractor will contact you with the next steps.",
  });
});
