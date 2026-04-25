# AI

## Suno → Google Drive one-click automation

You asked for a flow that can be triggered once and then does:

1. login to Suno
2. open Create
3. paste prompt/style
4. click Create
5. wait for completion
6. download and upload to Google Drive

This repository now includes `suno-drive-automation.mjs` to do exactly that with Playwright + Google Drive API.

---

## What was added

- `suno-drive-automation.mjs`
  - Opens a real browser with Playwright.
  - Reuses a saved Suno login session from `.suno-auth-state.json`.
  - Fills the Suno prompt field and clicks Create.
  - Waits for generation and download.
  - Uploads the downloaded audio file to Google Drive.
- `package.json`
  - Adds scripts and dependencies for automation.

---

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure Google Drive OAuth env vars

Create `.env` in repo root:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
# optional
GOOGLE_REDIRECT_URI=urn:ietf:wg:oauth:2.0:oob
GOOGLE_DRIVE_FOLDER_ID=
SUNO_TIMEOUT_MS=1800000
SUNO_POLL_INTERVAL_MS=10000
```

> `GOOGLE_DRIVE_FOLDER_ID` is optional. If omitted, files upload to My Drive root.

### 3) Run automation

```bash
npm run song -- "make a song about neon city nights with dreamy synths"
```

On first run, complete Suno login in the opened browser; session state is then saved to `.suno-auth-state.json` for future runs.

---

## Notes / selector tuning

Suno can change their UI. If Suno updates labels/placeholders, update selectors in:

- `fillPromptAndCreate()`
- `waitForDownload()`

inside `suno-drive-automation.mjs`.

---

## Optional: existing helper

The previous backend-agnostic helper (`suno-automation.js`) is still present if you want API-based integration. The new script is for browser-level end-to-end automation including Google Drive upload.
