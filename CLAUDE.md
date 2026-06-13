# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Deploy

There is no build step. Deploy is:
```
git add <files>
git commit -m "..."
git push origin master
```
Vercel picks up the push automatically and publishes. Environment variables changed in the Vercel dashboard only take effect after a Redeploy.

There are no tests, linters, or local dev servers. Changes are validated in production via the browser DevTools console and Vercel function logs.

## Architecture

**Frontend:** Single file — `index.html` at the repo root. Pure HTML/CSS/JS, no bundler. External dependencies loaded via CDN (Chart.js, jsPDF, Supabase JS via esm.sh). All frontend state is in plain `var` globals.

**Backend:** Vercel serverless functions in `api/`. Each file exports a default `handler(req, res)` and optionally `export const config = { maxDuration: N }`. All use native `fetch` (Node 18+, ESM `import`/`export`). Helpers live in `lib/` (not `api/`) to avoid Vercel creating spurious routes.

**`vercel.json`** routes everything that isn't a file or API function to `CAMPANHAS/index.html` (legacy fallback — the main app is `index.html` at root, served by the filesystem rule first).

## Key patterns

### Multi-client Meta config (`lib/meta-config.js`)
`getMetaConfig(req)` resolves which Meta ad account to use. It checks the Bearer token → Supabase `clientes` → `meta_config` table. Falls back silently to env vars (`META_AD_ACCOUNT_ID`, `META_PAGE_ID`) on any error or missing data. All endpoints that touch the Meta account use this.

### Status gate (`lib/verificar-status.js`)
`verificarStatus(req)` checks client subscription status before write operations. **Fallback-first principle:** any ambiguity (no token, infra error, unknown client) → `{ permitido: true }`. Only blocks when it positively identifies a `suspenso` client. Returns `{ error: st.motivo }` (key is `error`, not `erro`) on 403.

Used only on the 4 write endpoints: `criar-campanha`, `campanha-acao`, `escalar-campanha`, `anuncio-acao`. Read endpoints (`listar-campanhas`, `insights-*`) are intentionally ungated.

### Error key inconsistency
Backend write endpoints use `{ error: ... }` on status-gate failures but `{ erro: ... }` on business logic failures. Frontend handlers must read **both**: `data.erro || data.error`.

### Campaign status rendering (`estadoDaCampanha` in `index.html`)
Reads `c.status` (configured on/off) AND `c.effective_status` (from the ad's review state). Priority order: DISAPPROVED/WITH_ISSUES → "Reprovada"; `c.status !== ACTIVE` → "Pausada"; PENDING_REVIEW/IN_PROCESS/PREAPPROVED/PENDING_BILLING_INFO → "Em análise"; ACTIVE → "No ar".

`listar-campanhas` sets `effective_status` to the **worst** ad status (via `agregateAds` with `AD_RANK`), not the campaign's own effective_status. Budget is in **centavos** from the API; divide by 100 for BRL display.

### Optimistic activation flow
After a successful `ativar` call, the frontend does **not** call `carregarCampanhas()` immediately (Meta propagation delay would return PAUSED). Instead it calls `renderCampanhas(_ultimasCampanhas.map(...))` with the campaign patched to `{ status: 'ACTIVE', effective_status: 'PENDING_REVIEW' }`. This keeps `_temEmAnalise() === true` so the auto-refresh timer arms.

### Auto-refresh (`_agendarAutoRefresh` in `index.html`)
`setTimeout`-based (one-shot, never `setInterval`). Re-arms itself because `_agendarAutoRefresh()` is called at the **end** of `renderCampanhas`. Pauses when `document.hidden`; resumes on `visibilitychange`. Modal guard: won't fire while `modal-ativar`, `modal-escalar`, or `modalCampanha` is open (`el.style.display !== 'none'`). The `_autoRefreshBound` flag prevents duplicate `visibilitychange` listeners.

"Em análise" → "No ar" depends on Facebook review, which can take minutes to hours. The 45 s timer is not a guarantee of prompt update.

### Video upload flow
`blob-upload` → client uploads directly to Vercel Blob → `video-start` (uploads Blob URL to Meta) → `video-status` (poll until ready) → `criar-campanha` (uses the Meta video ID, then deletes the Blob in `finally`).

### Scaling (`escalar-campanha`)
Detects CBO (budget on campaign) vs ABO (budget on adset) automatically. Accepts either `pct` (percentage increase) or `valor` (absolute value in BRL).

## Environment variables

Backend (Vercel):
- `META_ACCESS_TOKEN` — system user token, does not expire
- `META_AD_ACCOUNT_ID` — `act_908604161717895` (agency default)
- `META_PAGE_ID` — `949892491548927`
- `META_WHATSAPP_NUMBER` — `5517991414397`
- `SUPABASE_URL` — `https://hboghsnggybnwvunnqju.supabase.co`
- `SUPABASE_SECRET_KEY` — service role key (bypasses RLS); use for all backend Supabase calls
- `BLOB_*` — Vercel Blob credentials (auto-injected)

Frontend (`config.js`, committed, public):
- Supabase URL + publishable key (`sb_publishable_…`) — never the secret key
