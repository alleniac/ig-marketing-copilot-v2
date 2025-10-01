TITAN FORGE SF IG/FB Engagement Extension

Overview
- Chrome Extension (MV3, TypeScript) to compose on-brand replies for IG/FB using screenshots plus mode-specific corpora.
- Popup-only UI with screenshot tray, mode/model/corpus pickers, manual prompt, and 3 candidates → composer → copy.
- Local-only storage (IndexedDB); no telemetry. Optional blur (applies mild blur to screenshots for privacy).

Non-Goals
- No auto-posting, CRM/analytics, OCR/image editing, or auto-like/follow.

Project Structure
- `src/manifest.json` – MV3 manifest
- `src/popup/` – UI (`popup.html`, `popup.ts`, `styles.css`)
- `src/state/` – IndexedDB wrapper
- `src/capture/` – Screenshot utils (downscale >2000px width)
- `src/openai/` – Client with model rules and fallback chain
- `src/corpora/loader.ts` – Load/validate JSON corpora (and defaults per mode)
- `corpus/` – Editable JSON corpora (5 files)

Build & Load
1) Prereqs: Node 18+
2) Install dev deps: `npm install`
3) Build: `npm run build`
   - Outputs to `dist/` (copies manifest, popup HTML/CSS, corpora; compiles TS → JS)
4) In Chrome: `chrome://extensions` → Enable Developer mode → Load unpacked → select `dist/`.

Permissions
- `activeTab`, `tabs`, `storage`, `scripting`, `clipboardWrite`.
- Host: `https://api.openai.com/*`.
- CSP allows `connect-src https://api.openai.com`.

Using the Extension
- Open popup on an IG/FB tab.
- Choose Mode (exactly one), Model (default `gpt-5`), Corpus (auto by mode; can override path), and optionally type a manual prompt.
- Capture up to 8 screenshots; delete/reorder in the tray. Each capture auto-downscales if width > 2000px.
- Enter your OpenAI API key in the field (stored in memory of popup only; not persisted by default).
- Click Send → waits for 1 in-flight request per tab; fallback chain: `gpt-5` → `gpt-5-mini` → `gpt-4o` (UI notes fallback use).
- Returns exactly 3 candidates. Click “Insert to composer” to mix/mesh, then Copy.

Validation & Guardrails
- Mode-specific corpora are validated at load; invalid JSON surfaces a UI error.
- Lengths: Comments ≤220 chars; DMs ≤600 chars (UI trims if longer).
- Price mentions are disallowed unless the manual prompt explicitly asks (communicated in system/developer prompts).
- Screenshot cap: 8 per request. Warns on oversized payload; suggests optimizing by reducing shots.

OpenAI Client Notes
- Default uses GPT‑5 family with `max_completion_tokens` and no temperature for GPT‑5 models, per spec.
- Endpoint currently uses the Responses API (`/v1/responses`). If your organization uses a different endpoint or schema, adjust `src/openai/client.ts` accordingly (see `callOpenAI`).
- The client always normalizes output to 3 candidates.

Privacy
- No telemetry; local-only storage. Optional blur option applies a mild full-image blur before sending.

Troubleshooting
- If network errors occur, confirm API key and that host permissions + CSP are correct.
- If the OpenAI API shape differs, update `callOpenAI` to match official docs (and keep the GPT‑5 rules intact).

Development Tips
- Popup reloads on code changes after rebuilding. Use the Activity Log to track events.
- The DB schema is minimal; feel free to extend `PerTabSession` but keep per-tab isolation.

