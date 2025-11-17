import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

/**
 * Load and validate configuration
 * Supports both environment variables (Railway) and config.json (local)
 */
export function loadConfig() {
  // Try environment variables first (Railway deployment)
  if (process.env.HEYREACH_API_KEY) {
    return {
      minScore: parseInt(process.env.MIN_SCORE) || 60,
      heyreach: {
        apiKey: process.env.HEYREACH_API_KEY,
        listId: process.env.HEYREACH_LIST_ID,
        baseUrl: process.env.HEYREACH_BASE_URL || 'https://api.heyreach.io/api/public',
        campaignId: process.env.HEYREACH_CAMPAIGN_ID
      }
    };
  }

  // Fall back to config.json (local development)
  const configPath = join(PROJECT_ROOT, 'config.json');

  if (!existsSync(configPath)) {
    console.warn('Warning: No config.json or environment variables found');
    console.warn('Heyreach integration will be disabled');
    return {
      minScore: 60,
      heyreach: null
    };
  }

  try {
    const configData = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    return {
      minScore: config.minScore || 60,
      heyreach: config.heyreach || null
    };
  } catch (error) {
    console.error('Error loading config.json:', error.message);
    return {
      minScore: 60,
      heyreach: null
    };
  }
}

export const config = loadConfig();
