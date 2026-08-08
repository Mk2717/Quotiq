import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(await response.text(), developmentPreviewMeta);
});

test("keeps Quotiq controls out of printed estimates", async () => {
  const [css, navigation] = await Promise.all([
    readFile(
      new URL("../quotiq/document-upgrade-v2.css", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../quotiq/components/GlobalNavigator.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(
    css,
    /@media print[\s\S]*\.qMobileNav[\s\S]*display:none!important/,
  );
  assert.match(css, /body\.printingEstimate \.ev2Quote/);
  assert.match(navigation, /qMobileNav noPrint/);
});

test("offers seven document themes and a non-empty signature fallback", async () => {
  const [types, branding, estimates] = await Promise.all([
    readFile(new URL("../quotiq/types.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../quotiq/components/BusinessBranding.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../quotiq/components/EstimatesV2.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  for (const theme of [
    "modern",
    "classic",
    "minimal",
    "emerald",
    "sunset",
    "industrial",
    "royal",
  ]) {
    assert.match(types, new RegExp(`'${theme}'`));
    assert.match(branding, new RegExp(`id:'${theme}'`));
  }
  assert.match(branding, /Upload signature/);
  assert.match(
    estimates,
    /business\.authorizedName\|\|business\.name\|\|'Authorised representative'/,
  );
});

test("opens the mobile More menu without forcing the keyboard", async () => {
  const [navigation, css] = await Promise.all([
    readFile(
      new URL("../quotiq/components/GlobalNavigator.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../quotiq/mobile-command-menu.css", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(navigation, /autoFocus=\{!mobileSheet\}/);
  assert.match(navigation, /matchMedia\('\(max-width:760px\)'\)/);
  assert.match(
    css,
    /@media\(max-width:760px\)[\s\S]*\.qCommand\{position:absolute;inset:auto 0 0/,
  );
  assert.match(css, /\.qCommandLinks\{grid-template-columns:repeat\(2/);
});

test("keeps the workspace drawer above mobile controls and groups its panels", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../quotiq/App.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../quotiq/workspace-navigation-v2.css", import.meta.url),
      "utf8",
    ),
  ]);

  for (const group of [
    "Workspace",
    "Sales",
    "Operations",
    "Insights",
    "Account",
  ]) {
    assert.match(app, new RegExp(`label: "${group}"`));
  }
  assert.match(app, /className="sideBackdrop"/);
  assert.match(app, /document\.body\.classList\.add\("sideMenuOpen"\)/);
  assert.match(css, /\.side\s*\{[\s\S]*?z-index:\s*120/);
  assert.match(css, /body\.sideMenuOpen \.qMobileNav/);
  assert.match(css, /\.invModal,[\s\S]*\.prjModal,[\s\S]*\.autoModal/);
});

test("connects choice estimates to secure client approval", async () => {
  const [estimates, portal, types, css] = await Promise.all([
    readFile(
      new URL("../quotiq/components/EstimatesV2.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../quotiq/components/ClientApprovalPortal.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../quotiq/types.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../quotiq/quote-intelligence.css", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(types, /pricingStyle\?:'standard'\|'choices'/);
  assert.match(estimates, /Good \/ Better \/ Best packages/);
  assert.match(estimates, /Private profit guard/);
  assert.match(estimates, /shareWhatsApp/);
  assert.match(portal, /Selected package:/);
  assert.match(portal, /Preferred start date:/);
  assert.match(css, /\.qiPrintChoices/);
  assert.match(css, /\.cpPackageChoices/);
});

test("adds an offline field pack with labour costing and inspections", async () => {
  const [projects, types, css] = await Promise.all([
    readFile(
      new URL("../quotiq/components/ProjectsV2.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../quotiq/types.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../quotiq/field-operations.css", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(types, /ProjectTimeEntry/);
  assert.match(types, /ProjectInspection/);
  assert.match(projects, /FIELD OPERATIONS PACK/);
  assert.match(projects, /Load inspection pack/);
  assert.match(projects, /Live gross profit/);
  assert.match(css, /\.fieldOpsColumns/);
  assert.match(css, /@media\(max-width:680px\)/);
});

test("connects public service booking to an owner-protected lead pipeline", async () => {
  const [client, booking, pipeline, migration, edge] = await Promise.all([
    readFile(new URL("../app/QuotiqClient.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../quotiq/components/PublicBookingPage.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../quotiq/components/LeadsPipeline.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/20260808102608_create_booking_pages_and_service_leads.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../supabase/functions/service-booking/index.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(client, /#\\\/book\\\//);
  assert.match(booking, /No account required/);
  assert.match(booking, /Send request/);
  assert.match(pipeline, /Turn requests into paying jobs/);
  assert.match(pipeline, /Create estimate/);
  assert.match(pipeline, /FOLLOW-UP QUEUE/);
  assert.match(migration, /alter table public\.booking_pages enable row level security/);
  assert.match(migration, /revoke all on table public\.service_leads from anon, public/);
  assert.match(edge, /request_fingerprint/);
  assert.match(edge, /Too many requests/);
});

test("adds an offline-ready, owner-protected ClientHub", async () => {
  const [clientHub, types, migration, navigation, css] = await Promise.all([
    readFile(new URL("../quotiq/components/ClientHub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260808111649_create_client_hub_communications.sql", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/components/GlobalNavigator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/client-hub.css", import.meta.url), "utf8"),
  ]);

  assert.match(types, /ClientCommunication/);
  assert.match(clientHub, /Every client conversation, connected/);
  assert.match(clientHub, /Opened app/);
  assert.match(clientHub, /Saved offline/);
  assert.match(clientHub, /New enquiry reply/);
  assert.match(navigation, /ClientHub/);
  assert.match(migration, /alter table public\.client_communications enable row level security/);
  assert.match(migration, /revoke all on table public\.client_communications from anon, public/);
  assert.match(css, /@media\(max-width:820px\)/);
});

test("adds owner-protected workforce time tracking and job labour costing", async () => {
  const [team, types, migration, navigation, projects, css] = await Promise.all([
    readFile(new URL("../quotiq/components/TeamOperations.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260808114658_create_workforce_time_entries.sql", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/components/GlobalNavigator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/components/ProjectsV2.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/team-operations.css", import.meta.url), "utf8"),
  ]);

  assert.match(types, /WorkforceTimeEntry/);
  assert.match(types, /sourceEntryId/);
  assert.match(team, /Know who is working—and what every hour costs/);
  assert.match(team, /Payroll-ready labour summary/);
  assert.match(team, /projectTimeFromEntry/);
  assert.match(team, /Saved offline/);
  assert.match(navigation, /Team & timesheets/);
  assert.match(projects, /timeEntries/);
  assert.match(migration, /alter table public\.workforce_time_entries enable row level security/);
  assert.match(migration, /workforce_time_entries_one_open_shift_idx/);
  assert.match(migration, /revoke all on table public\.workforce_time_entries from anon, public/);
  assert.match(css, /@media\(max-width:760px\)/);
});

test("adds owner-protected purchase orders with idempotent stock receiving", async () => {
  const [purchasing, types, migration, navigation, offline, css] = await Promise.all([
    readFile(new URL("../quotiq/components/PurchaseOrders.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260808123315_create_purchase_orders.sql", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/components/GlobalNavigator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/components/MobileOffline.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/purchase-orders.css", import.meta.url), "utf8"),
  ]);

  assert.match(types, /PurchaseOrderLine/);
  assert.match(types, /Partially Received/);
  assert.match(purchasing, /Order materials, receive stock/);
  assert.match(purchasing, /Reorder low stock/);
  assert.match(purchasing, /Received on \$\{selected\.orderNumber\}/);
  assert.match(purchasing, /targetPosted-selected\.postedCost/);
  assert.match(purchasing, /Materials \/ Purchasing/);
  assert.match(purchasing, /printingPurchaseOrder/);
  assert.match(navigation, /Purchase orders/);
  assert.match(offline, /q-purchase-orders/);
  assert.match(migration, /alter table public\.purchase_orders enable row level security/);
  assert.match(migration, /purchase_orders_owner_status_expected_idx/);
  assert.match(migration, /revoke all on table public\.purchase_orders from anon, public/);
  assert.match(css, /@media print[\s\S]*printingPurchaseOrder/);
  assert.match(css, /@media\(max-width:680px\)/);
});

test("adds owner-protected live GPS, precision takeoffs and route planning", async () => {
  const [fieldTools, types, migration, takeoffMigration, navigation, offline, css] = await Promise.all([
    readFile(new URL("../quotiq/components/FieldTools.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260808131031_create_site_measurements.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260808160350_add_site_takeoff_lines.sql", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/components/GlobalNavigator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/components/MobileOffline.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/field-tools.css", import.meta.url), "utf8"),
  ]);

  assert.match(types, /SiteMeasurementMode='distance'\|'area'/);
  assert.match(fieldTools, /Your position and the real site boundary/);
  assert.match(fieldTools, /watchPosition/);
  assert.match(fieldTools, /You are here/);
  assert.match(fieldTools, /Use as point/);
  assert.match(fieldTools, /Concrete slab/);
  assert.match(fieldTools, /Solar panel layout/);
  assert.match(fieldTools, /Cable voltage drop/);
  assert.match(fieldTools, /Pipe fall \/ drainage/);
  assert.match(fieldTools, /Create itemized estimate/);
  assert.match(fieldTools, /q-site-takeoff-draft/);
  assert.match(fieldTools, /Optimize order/);
  assert.match(fieldTools, /https:\/\/tile\.openstreetmap\.org/);
  assert.match(fieldTools, /https:\/\/www\.google\.com\/maps\/dir/);
  assert.match(navigation, /Field tools & maps/);
  assert.match(offline, /q-site-measurements/);
  assert.match(migration, /alter table public\.site_measurements enable row level security/);
  assert.match(migration, /Owners can view site measurements/);
  assert.match(migration, /site_measurements_owner_project_idx/);
  assert.match(takeoffMigration, /takeoff_lines jsonb/);
  assert.match(takeoffMigration, /location_accuracy_m/);
  assert.match(types, /SiteTakeoffLine/);
  assert.match(css, /@media\(max-width:760px\)/);
});

test("adds recurring service agreements, equipment and automatic visit billing", async () => {
  const [servicePlans, types, migration, navigation, offline, css] = await Promise.all([
    readFile(new URL("../quotiq/components/ServicePlans.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/types.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260808162850_create_service_agreements.sql", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/components/GlobalNavigator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/components/MobileOffline.tsx", import.meta.url), "utf8"),
    readFile(new URL("../quotiq/service-plans.css", import.meta.url), "utf8"),
  ]);

  assert.match(types, /ServiceAgreementStatus/);
  assert.match(types, /ServiceVisitChecklistItem/);
  assert.match(servicePlans, /CCTV Preventive Care/);
  assert.match(servicePlans, /Solar Performance Plan/);
  assert.match(servicePlans, /Automatic visit invoicing/);
  assert.match(servicePlans, /createInvoice/);
  assert.match(servicePlans, /Visit completed\. Next service/);
  assert.match(servicePlans, /printingServicePlan/);
  assert.match(navigation, /Service plans/);
  assert.match(offline, /q-service-agreements/);
  assert.match(migration, /alter table public\.service_agreements enable row level security/);
  assert.match(migration, /service_agreements_owner_next_visit_idx/);
  assert.match(migration, /revoke all on table public\.service_assets, public\.service_agreements, public\.service_visits from anon, public/);
  assert.match(css, /@media print[\s\S]*printingServicePlan/);
  assert.match(css, /@media\(max-width:600px\)/);
});
