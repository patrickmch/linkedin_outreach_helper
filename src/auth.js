import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sleep } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const COOKIES_PATH = join(PROJECT_ROOT, 'cookies.json');

puppeteer.use(StealthPlugin());

/**
 * Launch browser with authentication
 * Returns { browser, page, cookies }
 */
export async function launchBrowserWithAuth() {
  console.log('Launching browser...');

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const page = await browser.newPage();

  // Try to load existing cookies
  if (existsSync(COOKIES_PATH)) {
    console.log('Loading saved cookies...');
    const cookies = JSON.parse(readFileSync(COOKIES_PATH, 'utf8'));
    await page.setCookie(...cookies);
    return { browser, page, cookies };
  }

  // No cookies found - user needs to login
  console.log('No cookies found - please login manually...');
  return { browser, page, cookies: null };
}

/**
 * Save cookies from current page
 */
export async function saveCookies(page) {
  const cookies = await page.cookies();
  writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log('Cookies saved successfully!');
  return cookies;
}

/**
 * Check if user is logged in to LinkedIn
 */
export async function isLoggedIn(page) {
  try {
    const currentUrl = page.url();

    // Check if we're on a LinkedIn page and not on the login page
    if (currentUrl.includes('linkedin.com') &&
        !currentUrl.includes('/login') &&
        !currentUrl.includes('/uas/login')) {

      // Additional check: look for common logged-in elements
      const loggedInElements = await page.evaluate(() => {
        // Check for common elements that only appear when logged in
        return !!(
          document.querySelector('[data-control-name="identity_profile_photo"]') ||
          document.querySelector('.global-nav__me') ||
          document.querySelector('.feed-identity-module') ||
          document.querySelector('[data-test-global-nav-me]')
        );
      });

      return loggedInElements;
    }

    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Interactive login session - opens browser and waits for user to login
 */
export async function interactiveLogin() {
  console.log('\n=== LinkedIn Authentication ===\n');
  console.log('Opening browser for login...');

  const { browser, page, cookies } = await launchBrowserWithAuth();

  if (cookies) {
    // Test if existing cookies still work
    console.log('Testing existing cookies...');
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await sleep(2000);

    if (await isLoggedIn(page)) {
      console.log('✓ Existing cookies are valid!');
      await browser.close();
      return { success: true, message: 'Already authenticated' };
    } else {
      console.log('Existing cookies expired - need to login again...');
    }
  }

  // Navigate to LinkedIn login page
  console.log('Navigating to LinkedIn...');
  await page.goto('https://www.linkedin.com/login', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  console.log('\n===========================================');
  console.log('Please login to LinkedIn in the browser window');
  console.log('Once logged in, navigate to Sales Navigator');
  console.log('Press ENTER here when you\'re ready...');
  console.log('===========================================\n');

  // Wait for user to login and press enter
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  // Check if logged in
  if (await isLoggedIn(page)) {
    console.log('\n✓ Login successful!');

    // Save cookies
    await saveCookies(page);

    console.log('✓ Authentication complete!\n');
    await browser.close();

    return { success: true, message: 'Authentication successful' };
  } else {
    console.log('\n✗ Login failed or not completed');
    await browser.close();
    return { success: false, message: 'Login not detected' };
  }
}

/**
 * Command-line interface for interactive login
 */
async function main() {
  const result = await interactiveLogin();

  if (!result.success) {
    console.error('Authentication failed');
    process.exit(1);
  }

  console.log('You can now use the scraper and outreach automation!');
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}
