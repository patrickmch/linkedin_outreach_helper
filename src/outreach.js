import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sleep, humanDelay } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const COOKIES_PATH = join(PROJECT_ROOT, 'cookies.json');

puppeteer.use(StealthPlugin());

/**
 * Send connection request to a LinkedIn profile via Sales Navigator
 */
export async function sendConnectionRequest(profileUrl) {
  console.log(`\n=== Sending Connection Request ===\n`);
  console.log(`Profile URL: ${profileUrl}`);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: false, // Keep visible so you can see what's happening
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  try {
    const page = await browser.newPage();

    // Load cookies if they exist
    if (existsSync(COOKIES_PATH)) {
      console.log('Loading saved cookies...');
      const cookies = JSON.parse(readFileSync(COOKIES_PATH, 'utf8'));
      await page.setCookie(...cookies);
    } else {
      throw new Error('No cookies found. Please run the scraper first to login.');
    }

    // Navigate to the profile
    console.log('Navigating to profile...');
    await page.goto(profileUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await sleep(2000);

    // Look for the "Connect" button
    console.log('Looking for Connect button...');

    // Try multiple possible selectors for the Connect button on Sales Navigator
    const connectButtonSelectors = [
      'button[data-control-name="connect"]',
      'button:has-text("Connect")',
      'button[aria-label*="Connect"]',
      'button.artdeco-button:has-text("Connect")',
      '.artdeco-button--primary:has-text("Connect")'
    ];

    let connectButton = null;

    for (const selector of connectButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        connectButton = await page.$(selector);
        if (connectButton) {
          console.log(`Found Connect button using selector: ${selector}`);
          break;
        }
      } catch (error) {
        // Try next selector
      }
    }

    // If no button found with selectors, try finding by text
    if (!connectButton) {
      console.log('Trying to find Connect button by text...');
      connectButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(button =>
          button.textContent.trim().toLowerCase().includes('connect') &&
          !button.textContent.trim().toLowerCase().includes('connected')
        );
      });
    }

    if (!connectButton || connectButton._remoteObject?.value === undefined) {
      throw new Error('Could not find Connect button on the page. Profile may already be connected.');
    }

    // Click the Connect button
    console.log('Clicking Connect button...');
    await connectButton.click();

    await sleep(2000);

    // Check if a modal appeared asking for a message (and close it if it does)
    try {
      const skipButton = await page.waitForSelector('button[aria-label="Send without a note"]', { timeout: 3000 });
      if (skipButton) {
        console.log('Modal appeared - clicking "Send without a note"...');
        await skipButton.click();
        await sleep(1000);
      }
    } catch (error) {
      // No modal appeared, connection request sent directly
      console.log('No modal appeared - connection request sent directly');
    }

    console.log('\n✓ Connection request sent successfully!\n');

    await humanDelay();

    return { success: true };

  } catch (error) {
    console.error(`\n✗ Error sending connection request:`, error.message);
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

/**
 * Send connection request via command line
 */
async function main() {
  const profileUrl = process.argv[2];

  if (!profileUrl) {
    console.error('Usage: node src/outreach.js <profile-url>');
    console.error('Example: node src/outreach.js "https://www.linkedin.com/sales/lead/..."');
    process.exit(1);
  }

  const result = await sendConnectionRequest(profileUrl);

  if (!result.success) {
    process.exit(1);
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
