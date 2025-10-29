import { launchBrowserWithAuth } from './auth.js';
import { sleep, humanDelay } from './utils.js';

/**
 * Send connection request to a LinkedIn profile via Sales Navigator
 */
export async function sendConnectionRequest(profileUrl) {
  console.log(`\n=== Sending Connection Request ===\n`);
  console.log(`Profile URL: ${profileUrl}`);

  // Launch browser with authentication
  const { browser, page, cookies } = await launchBrowserWithAuth();

  if (!cookies) {
    await browser.close();
    throw new Error('No cookies found. Please run "npm run login" first to authenticate.');
  }

  try {

    // Navigate to the profile
    console.log('Navigating to profile...');
    await page.goto(profileUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await sleep(2000);

    // Look for the 3-dot menu button (Sales Navigator pattern)
    console.log('Looking for 3-dot menu button...');

    // Try multiple possible selectors for the 3-dot menu on Sales Navigator
    const menuButtonSelectors = [
      'button[aria-label*="overflow menu"]',
      'button[aria-label="Open actions overflow menu"]',
      'button._overflow-menu--trigger_1xow7n',
      'button[aria-label*="More"]',
      'button[aria-label*="more actions"]',
      'button.artdeco-dropdown__trigger',
      'button[data-control-name="overflow_actions"]',
      '.artdeco-dropdown__trigger--placement-bottom'
    ];

    let menuButton = null;
    let foundWithSelector = false;

    for (const selector of menuButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        menuButton = await page.$(selector);
        if (menuButton) {
          console.log(`Found menu button using selector: ${selector}`);
          foundWithSelector = true;
          break;
        }
      } catch (error) {
        // Try next selector
      }
    }

    // If no menu button found with selectors, try finding by aria-label
    if (!menuButton) {
      console.log('Trying to find menu button by aria-label...');
      menuButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(button => {
          const ariaLabel = button.getAttribute('aria-label');
          return ariaLabel && (
            ariaLabel.toLowerCase().includes('overflow') ||
            ariaLabel.toLowerCase().includes('more') ||
            ariaLabel.toLowerCase().includes('actions')
          );
        });
      });
    }

    if (!foundWithSelector && (!menuButton || menuButton._remoteObject?.value === undefined)) {
      throw new Error('Could not find 3-dot menu button on the page. The page layout may have changed.');
    }

    // Click the 3-dot menu button to open the dropdown
    console.log('Clicking 3-dot menu button...');
    await menuButton.click();
    await sleep(1000);

    // Now look for the Connect option in the dropdown menu
    console.log('Looking for Connect option in menu...');

    const connectOptionSelectors = [
      'button._item_1xnv7i',  // Sales Navigator dropdown menu item
      'button[class*="_item_"]',  // Fallback for similar class names
      'div[role="menu"] button:has-text("Connect")',
      'ul[role="menu"] li:has-text("Connect")',
      '.artdeco-dropdown__content button:has-text("Connect")',
      '[data-control-name="connect"]'
    ];

    let connectButton = null;
    let foundConnectWithSelector = false;

    for (const selector of connectOptionSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        connectButton = await page.$(selector);
        if (connectButton) {
          console.log(`Found Connect option using selector: ${selector}`);
          foundConnectWithSelector = true;
          break;
        }
      } catch (error) {
        // Try next selector
      }
    }

    // If no Connect option found with selectors, try finding by text in the dropdown
    if (!connectButton) {
      console.log('Trying to find Connect option by text in dropdown...');
      connectButton = await page.evaluateHandle(() => {
        // Look for buttons in dropdown menus
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const text = btn.textContent?.trim();
          // Check if this button contains "Connect" text and is likely visible (in the dropdown)
          if (text && text.includes('Connect') && !text.includes('Connected')) {
            // Additional check: button should be visible (part of an open dropdown)
            const rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }
          return false;
        });
      });
    }

    if (!foundConnectWithSelector && (!connectButton || connectButton._remoteObject?.value === undefined)) {
      throw new Error('Could not find Connect option in the menu. Profile may already be connected.');
    }

    // Click the Connect option
    console.log('Clicking Connect option...');
    await connectButton.click();

    await sleep(2000);

    // Look for the Send button in the connection modal
    console.log('Looking for Send button...');

    const sendButtonSelectors = [
      'button.connect-cta-form__send',
      'button.button-primary-medium',
      'button[type="button"]:has-text("Send Invitation")'
    ];

    let sendButton = null;
    let foundSendWithSelector = false;

    for (const selector of sendButtonSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        sendButton = await page.$(selector);
        if (sendButton) {
          console.log(`Found Send button using selector: ${selector}`);
          foundSendWithSelector = true;
          break;
        }
      } catch (error) {
        // Try next selector
      }
    }

    // Fallback: find by text content
    if (!sendButton) {
      console.log('Trying to find Send button by text...');
      sendButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const text = btn.textContent?.trim();
          if (text && text.includes('Send Invitation')) {
            const rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          }
          return false;
        });
      });
    }

    if (!foundSendWithSelector && (!sendButton || sendButton._remoteObject?.value === undefined)) {
      throw new Error('Could not find Send button in the connection modal.');
    }

    // Click the Send button
    console.log('Clicking Send Invitation button...');
    await sendButton.click();
    await sleep(2000);

    console.log('\n✓ Connection request sent successfully!\n');
    console.log('Browser staying open for debugging. Press Ctrl+C to close when ready.\n');

    await humanDelay();

    // Keep browser open indefinitely for debugging
    await new Promise(() => {});

    return { success: true };

  } catch (error) {
    console.error(`\n✗ Error sending connection request:`, error.message);
    console.log('\nBrowser staying open for debugging. Press Ctrl+C to close when ready.\n');

    // Keep browser open indefinitely for debugging
    await new Promise(() => {});

    return { success: false, error: error.message };
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
