import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { google } from 'googleapis';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ARTIFACTS_DIR = path.join(__dirname, 'artifacts');
const STATE_PATH = path.join(__dirname, '.suno-auth-state.json');

const DEFAULT_TIMEOUT_MS = Number(process.env.SUNO_TIMEOUT_MS || 30 * 60 * 1000);
const DEFAULT_POLL_INTERVAL_MS = Number(process.env.SUNO_POLL_INTERVAL_MS || 10 * 1000);

function getPromptFromArgv() {
  const cliPrompt = process.argv.slice(2).join(' ').trim();
  if (cliPrompt) return cliPrompt;
  return process.env.SUNO_PROMPT?.trim() || '';
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function ensureSunoLogin(page, context) {
  await page.goto('https://suno.com/create', { waitUntil: 'domcontentloaded' });

  // If a create textarea exists, we are already logged in.
  const promptInput = page.locator('textarea').first();
  if (await promptInput.isVisible().catch(() => false)) {
    await context.storageState({ path: STATE_PATH });
    return;
  }

  console.log('Suno login required. Complete login in the opened browser window.');
  await page.goto('https://suno.com/sign-in', { waitUntil: 'domcontentloaded' });

  // Wait up to 5 minutes for user to complete manual login.
  await page.waitForURL(/suno\.com\/(create|home|library)/, { timeout: 5 * 60 * 1000 });
  await page.goto('https://suno.com/create', { waitUntil: 'domcontentloaded' });

  await context.storageState({ path: STATE_PATH });
  console.log('Saved Suno auth session to .suno-auth-state.json');
}

async function clickFirstVisible(page, selectors) {
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible().catch(() => false)) {
      await loc.click();
      return true;
    }
  }
  return false;
}

async function fillPromptAndCreate(page, prompt) {
  await page.goto('https://suno.com/create', { waitUntil: 'domcontentloaded' });

  const textareaSelectors = [
    'textarea[placeholder*="Describe"]',
    'textarea[placeholder*="song"]',
    'textarea'
  ];

  let inputFound = false;
  for (const selector of textareaSelectors) {
    const area = page.locator(selector).first();
    if (await area.isVisible().catch(() => false)) {
      await area.fill(prompt);
      inputFound = true;
      break;
    }
  }

  if (!inputFound) {
    throw new Error('Could not locate Suno prompt textarea. Update selectors in fillPromptAndCreate().');
  }

  const clickedCreate = await clickFirstVisible(page, [
    'button:has-text("Create")',
    'button:has-text("Generate")',
    '[role="button"]:has-text("Create")'
  ]);

  if (!clickedCreate) {
    throw new Error('Could not locate Suno Create button. Update selectors in fillPromptAndCreate().');
  }
}

async function waitForDownload(page, timeoutMs, pollMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const downloadReady = await clickFirstVisible(page, [
      'button:has-text("Download")',
      '[role="button"]:has-text("Download")',
      'button[aria-label*="Download"]'
    ]);

    if (downloadReady) {
      return true;
    }

    await page.waitForTimeout(pollMs);
  }

  return false;
}

async function generateAndDownloadSong(prompt) {
  await ensureDir(ARTIFACTS_DIR);

  const browser = await chromium.launch({ headless: false });

  const context = await browser.newContext({
    acceptDownloads: true,
    storageState: fs.existsSync(STATE_PATH) ? STATE_PATH : undefined
  });

  const page = await context.newPage();

  try {
    await ensureSunoLogin(page, context);
    await fillPromptAndCreate(page, prompt);

    const download = await Promise.race([
      page.waitForEvent('download', { timeout: DEFAULT_TIMEOUT_MS }),
      (async () => {
        const found = await waitForDownload(page, DEFAULT_TIMEOUT_MS, DEFAULT_POLL_INTERVAL_MS);
        if (!found) {
          throw new Error('Song did not finish within timeout window.');
        }
        return page.waitForEvent('download', { timeout: 2 * 60 * 1000 });
      })()
    ]);

    const suggestedName = download.suggestedFilename();
    const outputPath = path.join(ARTIFACTS_DIR, suggestedName);
    await download.saveAs(outputPath);

    return outputPath;
  } finally {
    await context.storageState({ path: STATE_PATH }).catch(() => {});
    await browser.close();
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function uploadToGoogleDrive(filePath) {
  const clientId = requiredEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requiredEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob';
  const refreshToken = requiredEnv('GOOGLE_REFRESH_TOKEN');

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  const fileName = path.basename(filePath);
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      ...(parentFolderId ? { parents: [parentFolderId] } : {})
    },
    media: {
      mimeType: 'audio/mpeg',
      body: fs.createReadStream(filePath)
    },
    fields: 'id,webViewLink,webContentLink'
  });

  return response.data;
}

async function main() {
  const prompt = getPromptFromArgv();

  if (!prompt) {
    throw new Error('Missing song prompt. Usage: npm run song -- "make a song about ..."');
  }

  console.log('Starting Suno browser automation...');
  const downloadedFile = await generateAndDownloadSong(prompt);
  console.log(`Downloaded song to: ${downloadedFile}`);

  console.log('Uploading to Google Drive...');
  const driveFile = await uploadToGoogleDrive(downloadedFile);
  console.log('Upload complete.');
  console.log('Google Drive file:', driveFile);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
