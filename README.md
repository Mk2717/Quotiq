# Quotiq Cloud + Professional Documents

A Vite, React and TypeScript contractor platform with customers, estimates, invoices, payments, receipts, branded printable PDFs, offline caching and optional Supabase authentication/cloud sync.

## Live test site

Quotiq is configured for GitHub Pages deployment at:

`https://mk2717.github.io/Quotiq/`

Every push to `main` runs the deployment workflow automatically.

Deployment retriggered after GitHub Pages was enabled.

## Run locally

```bash
npm config set registry https://registry.npmjs.org/
npm install
npm run dev
```

## Cloud setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env`.
4. Add the Supabase project URL and anonymous key.

Without credentials, Quotiq stays in local/offline mode.

## Professional documents

Open **Settings** to upload a logo and signature, add company/tax/payment details, and edit terms. Estimates and invoices can be opened through their download button, then saved as PDF using the browser print dialog. Paid or partially paid invoices also expose a **Receipt** action.

Each document contains a unique Quotiq verification code. QR images use a remote QR rendering endpoint when internet is available; the printed verification code remains visible if the QR image cannot load offline.

## Operations phase

This release adds projects, inventory, expenses, team assignments, low-stock alerts, cash-flow reporting, project profitability, and cloud synchronization for all operational records. Re-run `supabase/schema.sql` in Supabase to add the new JSONB workspace fields.

## GitHub Pages deployment

The repository includes an automatic GitHub Pages workflow. GitHub Pages must use **GitHub Actions** as its build source.

Supabase credentials are optional. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository Actions secrets to enable cloud mode on the deployed site. Without them, the deployed app runs in local/offline mode.
