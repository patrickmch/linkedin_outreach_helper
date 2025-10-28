import { config } from './config.js';

/**
 * Generate a random number from normal distribution using Box-Muller transform
 */
function normalRandom(mean, stdDev) {
  let u1 = 0, u2 = 0;
  // Ensure we don't get 0 which would cause Math.log(0)
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();

  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Generate a delay time using normal distribution
 * @returns {number} Delay time in milliseconds
 */
export function getRandomDelay() {
  const { minDelaySeconds, maxDelaySeconds, delayStdDev } = config.limits;
  const mean = (minDelaySeconds + maxDelaySeconds) / 2;

  let delay = normalRandom(mean, delayStdDev);

  // Clamp to min/max bounds
  delay = Math.max(minDelaySeconds, Math.min(maxDelaySeconds, delay));

  return delay * 1000; // Convert to milliseconds
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Delay with normal distribution
 */
export async function humanDelay() {
  const delay = getRandomDelay();
  console.log(`  Waiting ${(delay / 1000).toFixed(2)}s...`);
  await sleep(delay);
}

/**
 * Perform random human-like actions
 */
export async function performRandomAction(page) {
  const actions = [
    // Scroll randomly
    async () => {
      const scrollAmount = Math.floor(Math.random() * 300) + 100;
      await page.evaluate((amount) => {
        window.scrollBy(0, amount);
      }, scrollAmount);
      await sleep(500 + Math.random() * 1000);
    },

    // Move mouse randomly
    async () => {
      const x = Math.floor(Math.random() * 800) + 100;
      const y = Math.floor(Math.random() * 600) + 100;
      await page.mouse.move(x, y);
      await sleep(300 + Math.random() * 700);
    },

    // Check notifications (click bell icon if visible)
    async () => {
      try {
        const notificationButton = await page.$('[data-control-name="nav.settings"]');
        if (notificationButton && Math.random() > 0.7) {
          await notificationButton.click();
          await sleep(1000 + Math.random() * 2000);
          // Click somewhere else to close
          await page.mouse.click(100, 100);
        }
      } catch (error) {
        // Silently fail - this is just for human-like behavior
      }
    },

    // Scroll back up
    async () => {
      const scrollAmount = Math.floor(Math.random() * 200) + 50;
      await page.evaluate((amount) => {
        window.scrollBy(0, -amount);
      }, scrollAmount);
      await sleep(400 + Math.random() * 800);
    }
  ];

  // 20% chance to perform a random action
  if (Math.random() < 0.2) {
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    try {
      await randomAction();
    } catch (error) {
      // Silently fail - these are optional actions
    }
  }
}

/**
 * Format date for display
 */
export function formatDate(date) {
  return new Date(date).toLocaleString();
}

/**
 * Get today's date string (YYYY-MM-DD)
 */
export function getTodayString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}
