import { launchBrowserWithAuth } from './auth.js';
import { sleep, humanDelay } from './utils.js';
import readline from 'readline';

/**
 * Interactive batch outreach - keeps browser open between requests
 */
async function batchOutreach() {
  console.log('\n=== Batch LinkedIn Outreach (Interactive Mode) ===\n');
  console.log('This will keep your browser open so you can navigate naturally.');
  console.log('You can send connection requests as you browse.\n');

  // Launch browser with authentication
  const { browser, page, cookies } = await launchBrowserWithAuth();

  if (!cookies) {
    await browser.close();
    throw new Error('No cookies found. Please run "npm run login" first to authenticate.');
  }

  console.log('Browser opened! Navigate to Sales Navigator and profiles as you normally would.');
  console.log('\nCommands:');
  console.log('  connect - Send connection request on current profile page');
  console.log('  quit    - Close browser and exit');
  console.log('  help    - Show this help message\n');

  // Navigate to Sales Navigator home
  await page.goto('https://www.linkedin.com/sales/homepage', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Setup readline for interactive commands
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'batch-outreach> '
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const command = line.trim().toLowerCase();

    try {
      switch (command) {
        case 'connect':
          await sendConnectionOnCurrentPage(page);
          break;

        case 'quit':
        case 'exit':
          console.log('\nClosing browser...');
          await browser.close();
          rl.close();
          process.exit(0);
          break;

        case 'help':
          console.log('\nCommands:');
          console.log('  connect - Send connection request on current profile page');
          console.log('  quit    - Close browser and exit');
          console.log('  help    - Show this help message\n');
          break;

        case '':
          // Just prompt again
          break;

        default:
          console.log(`Unknown command: ${command}. Type "help" for available commands.`);
          break;
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    console.log('\nClosing browser...');
    await browser.close();
    process.exit(0);
  });
}

/**
 * Send connection request on the current page
 */
async function sendConnectionOnCurrentPage(page) {
  console.log('\n→ Attempting to send connection request...');

  try {
    const currentUrl = page.url();

    // Check if we're on a profile page
    if (!currentUrl.includes('/sales/lead/')) {
      console.log('✗ Not on a profile page. Navigate to a profile first.');
      return;
    }

    // Wait a moment for page to be ready
    await sleep(1000);

    // Look for the 3-dot overflow menu button
    console.log('  Looking for overflow menu...');

    const menuButtonSelectors = [
      'button[aria-label*="overflow menu"]',
      'button[aria-label="Open actions overflow menu"]',
      'button._overflow-menu--trigger_1xow7n'
    ];

    let menuButton = null;

    for (const selector of menuButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        menuButton = await page.$(selector);
        if (menuButton) {
          console.log('  ✓ Found overflow menu');
          break;
        }
      } catch (error) {
        // Try next selector
      }
    }

    if (!menuButton) {
      console.log('✗ Could not find overflow menu button');
      return;
    }

    // Click the overflow menu
    console.log('  Opening menu...');
    await menuButton.click();
    await sleep(1000);

    // Look for Connect button in the dropdown
    console.log('  Looking for Connect option...');

    const connectButtonSelectors = [
      'button._item_1xnv7i',
      'button[class*="_item_"]'
    ];

    let connectButton = null;

    for (const selector of connectButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        connectButton = await page.$(selector);
        if (connectButton) {
          const text = await page.evaluate(el => el.textContent, connectButton);
          if (text && text.includes('Connect')) {
            console.log('  ✓ Found Connect button');
            break;
          }
          connectButton = null;
        }
      } catch (error) {
        // Try next selector
      }
    }

    // Fallback: find by text
    if (!connectButton) {
      connectButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const text = btn.textContent?.trim();
          if (text && text.includes('Connect') && !text.includes('Connected')) {
            const rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }
          return false;
        });
      });
    }

    if (!connectButton || connectButton._remoteObject?.value === undefined) {
      console.log('✗ Could not find Connect option. Profile may already be connected.');
      return;
    }

    // Click Connect
    console.log('  Clicking Connect...');
    await connectButton.click();
    await sleep(2000);

    // Handle "Send without note" modal if it appears
    try {
      const skipButton = await page.waitForSelector('button[aria-label="Send without a note"]', { timeout: 3000 });
      if (skipButton) {
        console.log('  Clicking "Send without note"...');
        await skipButton.click();
        await sleep(1000);
      }
    } catch (error) {
      // No modal appeared
    }

    console.log('✓ Connection request sent successfully!\n');
    await humanDelay();

  } catch (error) {
    console.error(`✗ Error: ${error.message}\n`);
  }
}

// Run the batch outreach
batchOutreach().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
