import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { sleep, humanDelay } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const COOKIES_FILE = join(PROJECT_ROOT, 'data', 'cookies.json');

// Add stealth plugin
puppeteer.use(StealthPlugin());

/**
 * Launch browser with stealth and persistent profile
 */
export async function launchBrowser() {
  const userDataDir = join(PROJECT_ROOT, config.browser.userDataDir);

  // Ensure user data directory exists
  if (!existsSync(userDataDir)) {
    mkdirSync(userDataDir, { recursive: true });
  }

  console.log('Launching browser...');

  const browser = await puppeteer.launch({
    headless: config.browser.headless,
    userDataDir: userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      `--window-size=${config.browser.viewport.width},${config.browser.viewport.height}`
    ],
    defaultViewport: config.browser.viewport
  });

  return browser;
}

/**
 * Save cookies to file
 */
export async function saveCookies(page) {
  try {
    const cookies = await page.cookies();
    const dataDir = join(PROJECT_ROOT, 'data');

    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log('Cookies saved successfully');
  } catch (error) {
    console.error('Error saving cookies:', error.message);
  }
}

/**
 * Load cookies from file
 */
export async function loadCookies(page) {
  try {
    if (existsSync(COOKIES_FILE)) {
      const cookiesData = readFileSync(COOKIES_FILE, 'utf8');
      const cookies = JSON.parse(cookiesData);
      await page.setCookie(...cookies);
      console.log('Cookies loaded successfully');
      return true;
    }
  } catch (error) {
    console.error('Error loading cookies:', error.message);
  }
  return false;
}

/**
 * Login to LinkedIn
 */
export async function loginToLinkedIn(page) {
  console.log('Navigating to LinkedIn...');
  await page.goto('https://www.linkedin.com/login', {
    waitUntil: 'networkidle2'
  });

  await sleep(2000);

  // Check if already logged in
  const currentUrl = page.url();
  if (currentUrl.includes('/feed') || currentUrl.includes('/mynetwork')) {
    console.log('Already logged in!');
    await saveCookies(page);
    return true;
  }

  console.log('Logging in...');

  // Enter email
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.type('#username', config.linkedin.email, { delay: 100 });
  await sleep(500);

  // Enter password
  await page.type('#password', config.linkedin.password, { delay: 100 });
  await sleep(500);

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for navigation
  await sleep(5000);

  // Check for verification or captcha
  const pageContent = await page.content();
  if (
    pageContent.includes('verification') ||
    pageContent.includes('Let\'s do a quick security check')
  ) {
    console.log('\n⚠️  LinkedIn is asking for verification!');
    console.log('Please complete the verification in the browser window.');
    console.log('Waiting for you to complete verification...\n');

    // Wait up to 2 minutes for user to complete verification
    await page.waitForNavigation({ timeout: 120000, waitUntil: 'networkidle2' }).catch(() => {
      console.log('Verification timeout - continuing anyway...');
    });
  }

  // Verify login was successful
  await sleep(3000);
  const loggedInUrl = page.url();

  if (loggedInUrl.includes('/feed') || loggedInUrl.includes('/mynetwork')) {
    console.log('Login successful!');
    await saveCookies(page);
    return true;
  } else {
    console.error('Login may have failed. Current URL:', loggedInUrl);
    return false;
  }
}

/**
 * Ensure user is logged in
 */
export async function ensureLoggedIn(page) {
  // Try to load existing cookies first
  const cookiesLoaded = await loadCookies(page);

  if (cookiesLoaded) {
    // Test if cookies are still valid
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    }).catch(() => {});

    await sleep(2000);
    const url = page.url();

    if (url.includes('/feed') || url.includes('/mynetwork')) {
      console.log('Session restored from cookies');
      return true;
    }
  }

  // Need to login
  return await loginToLinkedIn(page);
}
