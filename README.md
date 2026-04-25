# AI

## Suno → Google Drive one-command automation

This project now supports your requested sequence end-to-end:

1. login to Suno
2. open Create
3. insert style + lyrics prompts
4. click Create
5. wait for completion/download
6. upload result to Google Drive

Implemented in `suno-drive-automation.mjs` using Playwright + Google Drive API.

---

## New preset: Psalm 16 + Neuro-Acoustic Matrix

A built-in preset (`psalm16-neuro`) converts Psalm 16 into structured lyrics and applies a neuro-acoustic style scaffold inspired by your framework.

### Run with the preset

```bash
npm run song:psalm16
```

Or equivalent:

```bash
npm run song -- --preset psalm16-neuro
```

### Optional flags

- `--no-upload` → generate + download only (skip Drive upload)
- `--dry-run` → print generated style/lyrics payload only
- extra text after command (without `--preset`) is treated as direct style prompt

Examples:

```bash
npm run song -- --preset psalm16-neuro --no-upload
npm run song -- --preset psalm16-neuro --dry-run
npm run song -- "cinematic worship, airy pads, male vocal"
```

---

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure `.env`

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

- `GOOGLE_DRIVE_FOLDER_ID` optional: if omitted, uploads to My Drive root.
- First run requires interactive Suno sign-in; saved to `.suno-auth-state.json`.

---

## Notes

Suno UI changes over time. If fields/buttons move, update selectors in:

- `enableCustomMode()`
- `fillPromptsAndCreate()`
- `waitForDownload()`

inside `suno-drive-automation.mjs`.

The older `suno-automation.js` helper remains available for API-driven flows.
