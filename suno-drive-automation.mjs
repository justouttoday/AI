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

const PRESETS = {
  'psalm16-neuro': {
    name: 'Psalm 16 Neuro-Acoustic Matrix',
    stylePrompt: [
      'Minimalist analog drone, ambient worship soundscape, 60 BPM, A=432Hz tuning, Lydian mode.',
      'Sustained sub-bass texture centered near 30Hz feel, crystal overtone textures around 528Hz color,',
      'gentle pulsing pad texture evoking gamma-like rhythmic shimmer, warm tape saturation, cathedral reverb tails, ultra-wide airy field.',
      'Exclude: pop hooks, EDM drops, aggressive percussion, trap hats, autotune artifacts, harsh transients.'
    ].join(' '),
    lyricsPrompt: [
      '[Intro: breathy pad, stillness, intimate whisper]',
      '[Verse 1] Preserve me, O God, in You I find my refuge / I say to the Lord, You are my Lord, my good is found in You',
      '[Pre-Chorus] The holy ones in the land are glorious / my heart will not chase another god',
      '[Chorus] You are my chosen portion and my cup / You hold my lot, You steady every line / In pleasant places my inheritance falls / My heart is safe because You are mine',
      '[Verse 2] I bless the Lord who gives me counsel / even at night You teach my heart / I keep the Lord before me always / with You at my right hand I will not be shaken',
      '[Bridge: dynamic swell, luminous overtones, widen stereo field]',
      '[Bridge Lyrics] My heart is glad, my whole being rejoices / my flesh rests secure in hope / You will not abandon me to the grave / nor let Your Holy One see decay',
      '[Final Chorus] Show me the path of life in Your presence / fullness of joy forevermore / at Your right hand are pleasures forever / I will dwell in Your joy forevermore',
      '[Outro: return to low drone, soft amen-like hum, long decay]'
    ].join('\n')
  }
};

function parseArgs(argv) {
  const parsed = {
    prompt: '',
    preset: process.env.SUNO_PRESET || '',
    dryRun: false,
    noUpload: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--preset') {
      parsed.preset = argv[i + 1] || '';
      i += 1;
    } else if (token === '--dry-run') {
      parsed.dryRun = true;
    } else if (token === '--no-upload') {
      parsed.noUpload = true;
    } else {
      parsed.prompt += `${parsed.prompt ? ' ' : ''}${token}`;
    }
  }

  parsed.prompt = parsed.prompt.trim();
  return parsed;
}

function buildSongInput(args) {
  if (args.preset) {
    const preset = PRESETS[args.preset];
    if (!preset) {
      throw new Error(`Unknown preset: ${args.preset}. Available presets: ${Object.keys(PRESETS).join(', ')}`);
    }

    const overrideLyrics = process.env.SUNO_LYRICS?.trim();
    const overrideStyle = args.prompt || process.env.SUNO_STYLE_PROMPT?.trim();

    return {
      presetName: preset.name,
      stylePrompt: overrideStyle || preset.stylePrompt,
      lyricsPrompt: overrideLyrics || preset.lyricsPrompt
    };
  }

  const stylePrompt = args.prompt || process.env.SUNO_PROMPT?.trim() || process.env.SUNO_STYLE_PROMPT?.trim() || '';
  const lyricsPrompt = process.env.SUNO_LYRICS?.trim() || '';

  if (!stylePrompt) {
    throw new Error(
      'Missing prompt. Use `npm run song -- --preset psalm16-neuro` or `npm run song -- "your style prompt"`.'
    );
  }

  return { presetName: '', stylePrompt, lyricsPrompt };
}

async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

async function ensureSunoLogin(page, context) {
  await page.goto('https://suno.com/create', { waitUntil: 'domcontentloaded' });

  if (await page.locator('textarea').first().isVisible().catch(() => false)) {
    await context.storageState({ path: STATE_PATH });
    return;
  }

  console.log('Suno login required. Complete login in the opened browser window.');
  await page.goto('https://suno.com/sign-in', { waitUntil: 'domcontentloaded' });
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

async function fillFirstVisible(page, selectors, value) {
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible().catch(() => false)) {
      await loc.fill(value);
      return true;
    }
  }
  return false;
}

async function enableCustomMode(page) {
  await clickFirstVisible(page, [
    'button:has-text("Custom")',
    '[role="button"]:has-text("Custom")',
    'label:has-text("Custom")'
  ]);
}

async function fillPromptsAndCreate(page, songInput) {
  await page.goto('https://suno.com/create', { waitUntil: 'domcontentloaded' });

  await enableCustomMode(page);

  const styleFilled = await fillFirstVisible(page, [
    'textarea[placeholder*="Describe"]',
    'textarea[placeholder*="style"]',
    'textarea[aria-label*="style"]',
    'textarea'
  ], songInput.stylePrompt);

  if (!styleFilled) {
    throw new Error('Could not locate Suno style/prompt textarea. Update selectors in fillPromptsAndCreate().');
  }

  if (songInput.lyricsPrompt) {
    const lyricsFilled = await fillFirstVisible(page, [
      'textarea[placeholder*="Lyrics"]',
      'textarea[aria-label*="Lyrics"]',
      '[data-testid*="lyrics"] textarea'
    ], songInput.lyricsPrompt);

    if (!lyricsFilled) {
      console.log('Warning: lyrics textarea was not found; continuing with style prompt only.');
    }
  }

  const clickedCreate = await clickFirstVisible(page, [
    'button:has-text("Create")',
    'button:has-text("Generate")',
    '[role="button"]:has-text("Create")'
  ]);

  if (!clickedCreate) {
    throw new Error('Could not locate Suno Create button. Update selectors in fillPromptsAndCreate().');
  }
}

async function waitForDownload(page, timeoutMs, pollMs) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await clickFirstVisible(page, [
      'button:has-text("Download")',
      '[role="button"]:has-text("Download")',
      'button[aria-label*="Download"]'
    ])) {
      return true;
    }

    await page.waitForTimeout(pollMs);
  }

  return false;
}

async function generateAndDownloadSong(songInput) {
  await ensureDir(ARTIFACTS_DIR);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    acceptDownloads: true,
    storageState: fs.existsSync(STATE_PATH) ? STATE_PATH : undefined
  });

  const page = await context.newPage();

  try {
    await ensureSunoLogin(page, context);
    await fillPromptsAndCreate(page, songInput);

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

    const fileName = download.suggestedFilename();
    const outputPath = path.join(ARTIFACTS_DIR, fileName);
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
  const oauth2Client = new google.auth.OAuth2(
    requiredEnv('GOOGLE_CLIENT_ID'),
    requiredEnv('GOOGLE_CLIENT_SECRET'),
    process.env.GOOGLE_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
  );

  oauth2Client.setCredentials({ refresh_token: requiredEnv('GOOGLE_REFRESH_TOKEN') });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const response = await drive.files.create({
    requestBody: {
      name: path.basename(filePath),
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
  const args = parseArgs(process.argv.slice(2));
  const songInput = buildSongInput(args);

  if (args.dryRun) {
    console.log(JSON.stringify(songInput, null, 2));
    return;
  }

  if (songInput.presetName) {
    console.log(`Using preset: ${songInput.presetName}`);
  }

  console.log('Starting Suno browser automation...');
  const downloadedFile = await generateAndDownloadSong(songInput);
  console.log(`Downloaded song to: ${downloadedFile}`);

  if (args.noUpload) {
    console.log('Skipping Google Drive upload (--no-upload set).');
    return;
  }

  console.log('Uploading to Google Drive...');
  const driveFile = await uploadToGoogleDrive(downloadedFile);
  console.log('Upload complete.');
  console.log('Google Drive file:', driveFile);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
